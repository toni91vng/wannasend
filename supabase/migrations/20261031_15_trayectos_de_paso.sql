-- 15 · Búsqueda de trayectos "de paso" (decisión del 31/10/2026).
-- Un trayecto Barcelona → Madrid aparece al buscar Barcelona → Lleida si pasa cerca de los dos puntos
-- (a menos de 10 km de la ruta) y en el orden correcto. La ruta real se guarda al publicar (Google Routes);
-- en trayectos sin ruta se usa la línea recta entre origen y destino.
alter table public.route_quotes add column if not exists path extensions.geography(LineString, 4326);
alter table public.trips add column if not exists route extensions.geography(LineString, 4326);
create index if not exists trips_route_gix on public.trips using gist (route);

create or replace function private.trip_line(t public.trips) returns extensions.geography language sql stable set search_path = '' as $$
  select coalesce(t.route, extensions.st_makeline(t.from_point::extensions.geometry, t.to_point::extensions.geometry)::extensions.geography);
$$;

-- validate_trip: además de la distancia por carretera, guarda la ruta
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
  if v_km is not null then
    new.distance_km := v_km; new.distance_source := 'carretera';
  else
    new.distance_km := greatest(1, round(extensions.st_distance(new.from_point, new.to_point) / 1000 * 1.2))::integer;
    new.distance_source := 'estimada';
  end if;
  new.route := v_path;
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

-- ¿Encaja el trayecto con la búsqueda? Por los extremos (radio) o de paso (10 km de la ruta, en orden)
create or replace function private.trip_matches(t public.trips, o extensions.geography, d extensions.geography, p_radius_km integer)
returns boolean language sql stable set search_path = '' as $$
  select (extensions.st_dwithin(t.from_point, o, least(p_radius_km, 100) * 1000)
          and extensions.st_dwithin(t.to_point, d, least(p_radius_km, 100) * 1000))
      or (extensions.st_dwithin(private.trip_line(t), o, 10000)
          and extensions.st_dwithin(private.trip_line(t), d, 10000)
          and extensions.st_linelocatepoint(private.trip_line(t)::extensions.geometry, o::extensions.geometry)
            < extensions.st_linelocatepoint(private.trip_line(t)::extensions.geometry, d::extensions.geometry));
$$;

create or replace function public.search_trips(p_from_lat double precision, p_from_lng double precision, p_to_lat double precision,
  p_to_lng double precision, p_day date, p_radius_km integer default 20)
returns table(id uuid, carrier_id uuid, carrier_name text, carrier_rating numeric, carrier_reviews integer, from_label text, from_city text,
  to_label text, to_city text, departure_at timestamptz, arrival_at timestamptz, max_size public.package_size, max_weight_kg numeric,
  price_cents integer, total_cents integer, seats_left integer, from_km numeric, to_km numeric, carrier_verified boolean,
  require_verified_sender boolean)
language sql stable security definer set search_path = '' as $$
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_from_lng, p_from_lat), 4326)::extensions.geography g),
       d as (select extensions.st_setsrid(extensions.st_makepoint(p_to_lng, p_to_lat), 4326)::extensions.geography g)
  select t.id, t.carrier_id, p.name,
    coalesce((select round(avg(r.stars)::numeric, 1) from public.reviews r where r.about_id = t.carrier_id), 0),
    (select count(*) from public.reviews r where r.about_id = t.carrier_id)::integer,
    t.from_label, t.from_city, t.to_label, t.to_city, t.departure_at, t.arrival_at,
    t.max_size, t.max_weight_kg, t.price_cents, public.total_for_carrier_cents(t.price_cents),
    t.capacity - private.trip_booked(t.id),
    -- distancia desde lo buscado hasta donde puede recogerlo/entregarlo (extremo o punto de la ruta)
    round((least(extensions.st_distance(t.from_point, o.g), extensions.st_distance(private.trip_line(t), o.g)) / 1000)::numeric, 1),
    round((least(extensions.st_distance(t.to_point, d.g), extensions.st_distance(private.trip_line(t), d.g)) / 1000)::numeric, 1),
    p.verified, t.require_verified_sender
  from public.trips t join public.profiles p on p.id = t.carrier_id, o, d
  where (select auth.uid()) is not null and t.status = 'publicado' and t.carrier_id <> (select auth.uid())
    and t.started_at is null
    and t.departure_at > now() and (t.departure_at at time zone 'Europe/Madrid')::date = p_day
    and private.trip_matches(t, o.g, d.g, p_radius_km)
    and t.capacity - private.trip_booked(t.id) > 0
  order by t.departure_at limit 50;
$$;

create or replace function public.nearby_trip_days(p_from_lat double precision, p_from_lng double precision, p_to_lat double precision,
  p_to_lng double precision, p_radius_km integer default 20)
returns table(day date, trips integer)
language sql stable security definer set search_path = '' as $$
  select (t.departure_at at time zone 'Europe/Madrid')::date, count(*)::integer
  from public.trips t
  where (select auth.uid()) is not null and t.status = 'publicado' and t.carrier_id <> (select auth.uid())
    and t.departure_at > now() and t.departure_at < now() + interval '30 days'
    and private.trip_matches(t,
      extensions.st_setsrid(extensions.st_makepoint(p_from_lng, p_from_lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(p_to_lng, p_to_lat), 4326)::extensions.geography, p_radius_km)
  group by 1 order by 1 limit 6;
$$;
