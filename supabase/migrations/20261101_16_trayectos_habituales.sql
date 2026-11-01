-- 16 · Trayectos habituales (decisión del 01/11/2026).
-- El carrier publica un trayecto y lo marca como habitual (días de la semana). WannaSend mantiene publicados
-- los próximos 7 días; un día cancelado no se vuelve a crear. Pausar o borrar retira los días futuros
-- que no tengan paquetes.
create table if not exists public.trip_routines (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references auth.users(id) on delete cascade,
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  departure_time time not null,
  duration interval not null check (duration > interval '0' and duration <= interval '24 hours'),
  from_label text not null, from_city text not null, from_point extensions.geography(Point, 4326) not null,
  to_label text not null, to_city text not null, to_point extensions.geography(Point, 4326) not null,
  capacity smallint not null, max_size public.package_size not null, max_weight_kg numeric not null, price_cents integer not null,
  distance_km integer not null, distance_source text not null, route extensions.geography(LineString, 4326),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists trip_routines_carrier_idx on public.trip_routines (carrier_id);
alter table public.trip_routines enable row level security;
create policy "Mis trayectos habituales" on public.trip_routines for select to authenticated using (carrier_id = (select auth.uid()));
revoke all on public.trip_routines from anon, authenticated;
grant select on public.trip_routines to authenticated;

alter table public.trips add column if not exists routine_id uuid references public.trip_routines(id) on delete set null;
create index if not exists trips_routine_idx on public.trips (routine_id, departure_at);

-- Crea los trayectos que falten de los próximos 7 días (de una rutina o de todas)
create or replace function private.generate_routine_trips(p_routine uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.trip_routines; d date; v_dep timestamptz; n integer := 0;
begin
  for r in select * from public.trip_routines where active and (p_routine is null or id = p_routine) loop
    for d in select generate_series((now() at time zone 'Europe/Madrid')::date, (now() at time zone 'Europe/Madrid')::date + 6, interval '1 day')::date loop
      continue when not (extract(isodow from d)::smallint = any (r.weekdays));
      v_dep := (d + r.departure_time) at time zone 'Europe/Madrid';
      continue when v_dep < now() + interval '30 minutes';
      continue when exists (select 1 from public.trips t where t.routine_id = r.id
                            and (t.departure_at at time zone 'Europe/Madrid')::date = d);
      begin
        insert into public.trips (carrier_id, routine_id, from_label, from_city, from_point, to_label, to_city, to_point,
          departure_at, arrival_at, capacity, max_size, max_weight_kg, price_cents)
        values (r.carrier_id, r.id, r.from_label, r.from_city, r.from_point, r.to_label, r.to_city, r.to_point,
          v_dep, v_dep + r.duration, r.capacity, r.max_size, r.max_weight_kg, r.price_cents);
        n := n + 1;
      exception when others then
        raise warning 'Rutina %: no se pudo crear el trayecto del %: %', r.id, d, sqlerrm;
      end;
    end loop;
  end loop;
  return n;
end $$;

-- El carrier convierte un trayecto que acaba de publicar en habitual
create or replace function public.make_trip_routine(p_trip uuid, p_weekdays smallint[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.trips; v_id uuid;
begin
  select * into t from public.trips where id = p_trip;
  if not found or t.carrier_id <> auth.uid() then raise exception 'No autorizado'; end if;
  if t.routine_id is not null then return t.routine_id; end if;
  if p_weekdays is null or cardinality(p_weekdays) = 0 then raise exception 'Elige al menos un día de la semana'; end if;
  if (select count(*) from public.trip_routines where carrier_id = auth.uid() and active) >= 5 then
    raise exception 'Puedes tener como máximo 5 trayectos habituales';
  end if;
  insert into public.trip_routines (carrier_id, weekdays, departure_time, duration, from_label, from_city, from_point,
    to_label, to_city, to_point, capacity, max_size, max_weight_kg, price_cents, distance_km, distance_source, route)
  values (t.carrier_id, (select array_agg(distinct x order by x) from unnest(p_weekdays) x), (t.departure_at at time zone 'Europe/Madrid')::time,
    t.arrival_at - t.departure_at, t.from_label, t.from_city, t.from_point, t.to_label, t.to_city, t.to_point,
    t.capacity, t.max_size, t.max_weight_kg, t.price_cents, t.distance_km, t.distance_source, t.route)
  returning id into v_id;
  update public.trips set routine_id = v_id where id = p_trip;
  perform private.generate_routine_trips(v_id);
  return v_id;
end $$;
revoke execute on function public.make_trip_routine(uuid, smallint[]) from public, anon;
grant execute on function public.make_trip_routine(uuid, smallint[]) to authenticated;

-- Pausar / reanudar / borrar. Al pausar o borrar se retiran los días futuros sin paquetes.
create or replace function public.set_trip_routine(p_routine uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.trip_routines where id = p_routine and carrier_id = auth.uid()) then raise exception 'No autorizado'; end if;
  if p_action = 'reanudar' then
    update public.trip_routines set active = true where id = p_routine;
    perform private.generate_routine_trips(p_routine);
    return;
  end if;
  if p_action not in ('pausar', 'borrar') then raise exception 'Acción no válida'; end if;
  update public.trips t set status = 'cancelado'
   where t.routine_id = p_routine and t.status = 'publicado' and t.started_at is null and t.departure_at > now()
     and not exists (select 1 from public.shipments s where s.trip_id = t.id
                     and s.status in ('pendiente_pago', 'solicitado', 'aceptado', 'recogido', 'en_camino'));
  if p_action = 'pausar' then
    update public.trip_routines set active = false where id = p_routine;
  else
    delete from public.trip_routines where id = p_routine;
  end if;
end $$;
revoke execute on function public.set_trip_routine(uuid, text) from public, anon;
grant execute on function public.set_trip_routine(uuid, text) to authenticated;

-- validate_trip: los días de un trayecto habitual usan la distancia y la ruta del habitual
create or replace function public.validate_trip()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sugg integer; v_min integer; v_max integer; cfg public.app_config; v_type public.carrier_type; v_km integer;
  v_path extensions.geography;
begin
  if tg_op = 'UPDATE' then
    return new;
  end if;
  select * into cfg from public.app_config;

  if new.departure_at < now() then raise exception 'La salida debe ser en el futuro'; end if;
  if new.departure_at > now() + interval '90 days' then raise exception 'Solo puedes publicar con 90 días de antelación'; end if;
  new.status := 'publicado';
  new.started_at := null;

  if cfg.carrier_verification_required and not private.is_verified(new.carrier_id) then
    raise exception 'Completa tu alta de cobros para publicar trayectos';
  end if;

  select q.distance_km, q.path into v_km, v_path from public.route_quotes q
   where q.user_id = new.carrier_id and q.created_at > now() - interval '2 hours'
     and extensions.st_dwithin(q.from_point, new.from_point, 300)
     and extensions.st_dwithin(q.to_point, new.to_point, 300)
   order by q.created_at desc limit 1;
  if new.routine_id is not null then
    -- Día de un trayecto habitual: distancia y ruta guardadas al crear el habitual
    select r.distance_km, r.distance_source, r.route into new.distance_km, new.distance_source, new.route
      from public.trip_routines r where r.id = new.routine_id;
  elsif v_km is not null then
    new.distance_km := v_km; new.distance_source := 'carretera'; new.route := v_path;
  else
    new.distance_km := greatest(1, round(extensions.st_distance(new.from_point, new.to_point) / 1000 * 1.2))::integer;
    new.distance_source := 'estimada'; new.route := v_path;
  end if;
  if new.distance_km < 5 then raise exception 'El origen y el destino están demasiado cerca'; end if;

  v_sugg := public.suggested_price_cents(new.distance_km, new.max_size);
  v_min := greatest(300, round(v_sugg * 0.7 / 10.0) * 10);
  v_max := greatest(v_min, round(v_sugg * 1.3 / 10.0) * 10);
  if coalesce((select carrier_type from public.profile_private where id = new.carrier_id), 'particular') = 'particular'
     and new.distance_km * cfg.trip_cap_cents_per_km < v_min then
    raise exception 'Este trayecto es demasiado corto para compartir gastos (mínimo unos % km)', ceil(v_min::numeric / cfg.trip_cap_cents_per_km);
  end if;
  if new.price_cents < v_min or new.price_cents > v_max then
    raise exception 'El precio debe estar entre % y % céntimos', v_min, v_max;
  end if;

  select carrier_type into v_type from public.profile_private where id = new.carrier_id;
  if coalesce(v_type, 'particular') = 'particular' then
    new.earnings_cap_cents := new.distance_km * cfg.trip_cap_cents_per_km;
    if new.price_cents > new.earnings_cap_cents then
      raise exception 'En este trayecto puedes pedir como máximo % € por paquete', replace(to_char(new.earnings_cap_cents / 100.0, 'FM990.00'), '.', ',');
    end if;
    if new.price_cents * new.capacity > new.earnings_cap_cents then
      raise exception 'Con este precio puedes llevar como máximo % paquetes', new.earnings_cap_cents / new.price_cents;
    end if;
  else
    new.earnings_cap_cents := null;
  end if;
  return new;
end $$;

-- Cada día a las 3:10 se publican los días que falten de la semana siguiente
select cron.schedule('trayectos-habituales', '10 2 * * *', $$select private.generate_routine_trips()$$);
