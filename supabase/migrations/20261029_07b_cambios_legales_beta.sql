-- =====================================================================================
-- 07b · Cambios legales para la beta (decisiones del 29/10/2026)
--   1. Tope de gastos compartidos: 0,26 €/km sobre lo que recibe el carrier; plazas limitadas al publicar.
--   2. Distancia por carretera (Google Routes, calculada en el servidor) con estimación de respaldo.
--   3. Estados Aceptado → Recogido (revisión con foto) → En camino (botón por trayecto) → Entregado.
--   4. Declaración del contenido: foto, casilla de prohibidos (versionada) y valor declarado (máx. 300 €).
--   5. Identidad: carrier verificado con su alta de cobros; sender si el carrier lo exige o si declara > 100 €.
--   6. Solo base de datos: tipo de carrier, urgencia y seguro.
--   7. Fotos privadas con limpieza a las 24 h (sin usar) y a los 120 días del cierre.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Configuración
-- -------------------------------------------------------------------------------------
alter table public.app_config
  add column trip_cap_cents_per_km          integer not null default 26 check (trip_cap_cents_per_km between 1 and 100),
  add column max_declared_value_cents       integer not null default 30000 check (max_declared_value_cents > 0),
  add column identity_value_threshold_cents integer not null default 10000 check (identity_value_threshold_cents > 0),
  add column prohibited_list_version        text    not null default '2026-10-29',
  add column carrier_verification_required  boolean not null default false, -- se activa cuando la app lo soporte
  add column sender_verification_enabled    boolean not null default false, -- se activa con Stripe Identity
  add column photo_retention_days           integer not null default 120 check (photo_retention_days >= 30);
grant select (trip_cap_cents_per_km, max_declared_value_cents, identity_value_threshold_cents, prohibited_list_version,
              carrier_verification_required, sender_verification_enabled) on public.app_config to authenticated;

-- -------------------------------------------------------------------------------------
-- Tipo de carrier e identidad (en profile_private: el usuario los lee pero no puede cambiarlos)
-- -------------------------------------------------------------------------------------
create type public.carrier_type as enum ('particular', 'pro');
create type public.identity_status as enum ('sin_verificar', 'pendiente', 'verificado', 'fallido');

alter table public.profile_private
  add column carrier_type          public.carrier_type    not null default 'particular',
  add column identity_status       public.identity_status not null default 'sin_verificar',
  add column identity_session_id   text,
  add column identity_verified_at  timestamptz;

-- Verificado = identidad comprobada con Stripe Identity o alta de cobros completada en Stripe
create or replace function private.is_verified(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pp.identity_status = 'verificado' or pp.stripe_transfers_enabled
                   from public.profile_private pp where pp.id = p_user), false);
$$;

-- La insignia pública "Identidad verificada" sigue al estado privado
create or replace function private.sync_verified_badge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set verified = (new.identity_status = 'verificado' or new.stripe_transfers_enabled)
   where id = new.id;
  return new;
end $$;
create trigger profile_private_verified_badge
  after update of identity_status, stripe_transfers_enabled on public.profile_private
  for each row execute function private.sync_verified_badge();

-- -------------------------------------------------------------------------------------
-- Distancia por carretera: la calcula la función "places" (Google Routes) y la guarda aquí.
-- Los usuarios no pueden leer ni escribir esta tabla (sin políticas); solo el servidor.
-- -------------------------------------------------------------------------------------
create table public.route_quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  from_point  extensions.geography(point, 4326) not null,
  to_point    extensions.geography(point, 4326) not null,
  distance_km integer not null check (distance_km > 0),
  created_at  timestamptz not null default now()
);
alter table public.route_quotes enable row level security;
revoke all on public.route_quotes from anon, authenticated;
create index route_quotes_user_idx on public.route_quotes (user_id, created_at desc);

-- -------------------------------------------------------------------------------------
-- Trayectos: tope, origen de la distancia, inicio del viaje y exigencia de senders verificados
-- -------------------------------------------------------------------------------------
alter table public.trips
  add column earnings_cap_cents      integer,                       -- null = sin tope (carrier "pro")
  add column distance_source         text not null default 'estimada' check (distance_source in ('carretera', 'estimada')),
  add column started_at              timestamptz,                   -- "Empiezo el trayecto"
  add column require_verified_sender boolean not null default true; -- "Solo acepto paquetes de usuarios verificados"

-- Lo que el carrier ya tiene comprometido en el trayecto
create or replace function private.trip_committed_cents(p_trip uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(carrier_amount_cents), 0)::integer from public.shipments
  where trip_id = p_trip and status in ('aceptado', 'recogido', 'en_camino', 'entregado');
$$;

create or replace function private.trip_booked(p_trip uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.shipments
  where trip_id = p_trip and status in ('aceptado', 'recogido', 'en_camino', 'entregado');
$$;

-- Validación al publicar (sustituye a la anterior)
create or replace function public.validate_trip() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sugg integer; v_min integer; v_max integer; cfg public.app_config; v_type public.carrier_type; v_km integer;
begin
  if tg_op = 'UPDATE' then
    -- Solo se puede cambiar el estado; la distancia, el precio y el tope quedan fijados al publicar
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

  -- Distancia por carretera si hay un cálculo reciente del mismo usuario para los mismos puntos (±300 m)
  select q.distance_km into v_km from public.route_quotes q
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
  if new.distance_km < 5 then raise exception 'El origen y el destino están demasiado cerca'; end if;

  v_sugg := public.suggested_price_cents(new.distance_km, new.max_size);
  v_min := greatest(300, round(v_sugg * 0.7 / 10.0) * 10);
  v_max := greatest(v_min, round(v_sugg * 1.3 / 10.0) * 10);
  -- Trayecto demasiado corto: el tope no llega ni al precio mínimo
  if coalesce((select carrier_type from public.profile_private where id = new.carrier_id), 'particular') = 'particular'
     and new.distance_km * cfg.trip_cap_cents_per_km < v_min then
    raise exception 'Este trayecto es demasiado corto para compartir gastos (mínimo unos % km)', ceil(v_min::numeric / cfg.trip_cap_cents_per_km);
  end if;
  if new.price_cents < v_min or new.price_cents > v_max then
    raise exception 'El precio debe estar entre % y % céntimos', v_min, v_max;
  end if;

  -- Tope de gastos compartidos (solo particulares)
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

-- Un trayecto con paquetes ya recogidos no se puede cancelar
create or replace function public.on_trip_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    if exists (select 1 from public.shipments where trip_id = new.id and status in ('recogido', 'en_camino')) then
      raise exception 'Tienes paquetes recogidos en este trayecto: entrégalos antes de cancelarlo';
    end if;
    update public.shipments set status = 'cancelado', cancelled_at = now()
     where trip_id = new.id and status in ('pendiente_pago', 'solicitado', 'aceptado');
  end if;
  return new;
end $$;

-- -------------------------------------------------------------------------------------
-- Envíos: declaración, revisión en la recogida, urgencia y seguro
-- -------------------------------------------------------------------------------------
create type public.shipment_urgency as enum ('urgente', 'en_el_dia', 'programado');

alter table public.shipments
  add column declared_value_cents   integer not null check (declared_value_cents > 0),
  add column photo_path             text    not null,
  add column prohibited_ack_at      timestamptz not null,
  add column prohibited_ack_version text    not null,
  add column pickup_photo_path      text,
  add column rejection_stage        text check (rejection_stage in ('solicitud', 'recogida')),
  add column rejection_reason       text check (char_length(rejection_reason) <= 300),
  add column urgency                public.shipment_urgency not null default 'programado',
  add column insurance_cents        integer not null default 0 check (insurance_cents >= 0),
  add constraint shipments_total_breakdown check (total_cents = carrier_amount_cents + fee_cents + insurance_cents);

-- -------------------------------------------------------------------------------------
-- Fotos de paquetes (privadas)
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-photos', 'package-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.can_view_package_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shipments s
    where (s.photo_path = p_name or s.pickup_photo_path = p_name)
      and (s.sender_id = (select auth.uid()) or private.is_trip_carrier(s.trip_id))
  );
$$;

create or replace function private.own_photo(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from storage.objects o
                 where o.bucket_id = 'package-photos' and o.name = p_path
                   and o.owner_id = (select auth.uid())::text);
$$;

create policy "Subir fotos de paquetes a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'package-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Ver mis fotos o las de mis envíos" on storage.objects for select to authenticated
  using (bucket_id = 'package-photos'
         and (owner_id = (select auth.uid())::text or private.can_view_package_photo(name)));
-- Sin UPDATE ni DELETE para usuarios: las fotos son prueba en caso de incidencia.

-- Fotos a borrar (lo llama el proceso automático con permisos de servidor)
create or replace function public.photo_cleanup_candidates()
returns setof text language sql stable security definer set search_path = '' as $$
  -- Subidas pero nunca usadas en un envío (24 h)
  select o.name from storage.objects o
   where o.bucket_id = 'package-photos' and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.shipments s where s.photo_path = o.name or s.pickup_photo_path = o.name)
  union
  -- De envíos cerrados hace más del plazo, sin incidencias abiertas
  select o.name from storage.objects o
    join public.shipments s on (s.photo_path = o.name or s.pickup_photo_path = o.name)
   where o.bucket_id = 'package-photos'
     and s.status in ('entregado', 'cancelado', 'rechazado', 'caducado')
     and coalesce(s.delivered_at, s.cancelled_at, s.responded_at, s.requested_at)
         < now() - make_interval(days => (select photo_retention_days from public.app_config))
     and not exists (select 1 from public.reports r where r.shipment_id = s.id and r.status = 'abierto')
  limit 500;
$$;
revoke execute on function public.photo_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.photo_cleanup_candidates() to service_role;

-- -------------------------------------------------------------------------------------
-- Solicitar un envío (sustituye a la versión anterior)
-- -------------------------------------------------------------------------------------
drop function if exists public.request_shipment(uuid, public.package_size, numeric, text, text, text, text);

create function public.request_shipment(
  p_trip uuid, p_size public.package_size, p_weight numeric, p_content text, p_description text,
  p_recipient_name text, p_recipient_phone text,
  p_declared_value_cents integer, p_photo_path text, p_no_prohibited boolean,
  p_urgency public.shipment_urgency default 'programado')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); t public.trips; cfg public.app_config; v_id uuid; v_code text; v_total integer;
begin
  if v_uid is null then raise exception 'Inicia sesión'; end if;
  select * into cfg from public.app_config;
  if not coalesce(p_no_prohibited, false) then raise exception 'Confirma que el paquete no contiene objetos prohibidos'; end if;
  if p_declared_value_cents is null or p_declared_value_cents < 1 then raise exception 'Indica el valor aproximado del contenido'; end if;
  if p_declared_value_cents > cfg.max_declared_value_cents then
    raise exception 'El valor declarado no puede superar % €', cfg.max_declared_value_cents / 100;
  end if;
  if p_photo_path is null or not private.own_photo(p_photo_path) then raise exception 'Añade una foto del paquete'; end if;

  select * into t from public.trips where id = p_trip for update;
  if not found or t.status <> 'publicado' then raise exception 'Este trayecto ya no está disponible'; end if;
  if t.carrier_id = v_uid then raise exception 'No puedes enviar un paquete en tu propio trayecto'; end if;
  if t.started_at is not null then raise exception 'Este trayecto ya ha salido'; end if;
  if t.departure_at < now() + interval '30 minutes' then raise exception 'Este trayecto sale demasiado pronto'; end if;
  if p_size > t.max_size then raise exception 'El paquete es más grande de lo que acepta el carrier'; end if;
  if p_weight > t.max_weight_kg then raise exception 'El paquete pesa más de lo que acepta el carrier'; end if;
  if private.trip_booked(p_trip) >= t.capacity then raise exception 'El trayecto está completo'; end if;
  if t.earnings_cap_cents is not null and private.trip_committed_cents(p_trip) + t.price_cents > t.earnings_cap_cents then
    raise exception 'El trayecto está completo';
  end if;

  -- Identidad del sender: si el carrier la exige o si el valor declarado es alto
  if cfg.sender_verification_enabled
     and (t.require_verified_sender or p_declared_value_cents > cfg.identity_value_threshold_cents)
     and not private.is_verified(v_uid) then
    raise exception 'Verifica tu identidad para enviar este paquete';
  end if;

  update public.shipments set status = 'cancelado', cancelled_at = now()
    where trip_id = p_trip and sender_id = v_uid and status = 'pendiente_pago';
  if exists (select 1 from public.shipments where trip_id = p_trip and sender_id = v_uid
             and status in ('solicitado', 'aceptado', 'recogido', 'en_camino')) then
    raise exception 'Ya tienes un envío activo en este trayecto';
  end if;
  if (select count(*) from public.shipments where sender_id = v_uid and requested_at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiadas solicitudes. Inténtalo más tarde';
  end if;
  if p_recipient_phone !~ '^\+?[0-9 ]{9,16}$' then raise exception 'Revisa el móvil del destinatario'; end if;

  v_total := public.total_for_carrier_cents(t.price_cents);
  insert into public.shipments (trip_id, sender_id, size, weight_kg, content, description, recipient_name,
    carrier_amount_cents, total_cents, fee_cents, insurance_cents, status,
    declared_value_cents, photo_path, prohibited_ack_at, prohibited_ack_version, urgency)
  values (p_trip, v_uid, p_size, p_weight, trim(p_content), trim(coalesce(p_description, '')), trim(p_recipient_name),
    t.price_cents, v_total, v_total - t.price_cents, 0,
    case when cfg.payments_enabled then 'pendiente_pago'::public.shipment_status else 'solicitado' end,
    p_declared_value_cents, p_photo_path, now(), cfg.prohibited_list_version, coalesce(p_urgency, 'programado'))
  returning id into v_id;
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text, 4, '0');
  insert into public.shipment_contacts (shipment_id, recipient_phone) values (v_id, regexp_replace(p_recipient_phone, '\s', '', 'g'));
  insert into public.shipment_secrets (shipment_id, delivery_code) values (v_id, v_code);
  return v_id;
end $$;
revoke execute on function public.request_shipment(uuid, public.package_size, numeric, text, text, text, text, integer, text, boolean, public.shipment_urgency) from public, anon;
grant execute on function public.request_shipment(uuid, public.package_size, numeric, text, text, text, text, integer, text, boolean, public.shipment_urgency) to authenticated;

-- -------------------------------------------------------------------------------------
-- Aceptar o rechazar una solicitud (con el tope)
-- -------------------------------------------------------------------------------------
create or replace function public.respond_shipment(p_shipment uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shipments; t public.trips;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found then raise exception 'Envío no encontrado'; end if;
  select * into t from public.trips where id = s.trip_id for update;
  if t.carrier_id <> auth.uid() then raise exception 'No autorizado'; end if;
  if s.status <> 'solicitado' then raise exception 'Esta solicitud ya no está pendiente'; end if;
  if p_accept then
    if private.trip_booked(t.id) >= t.capacity then raise exception 'No te quedan plazas en este trayecto'; end if;
    if t.earnings_cap_cents is not null
       and private.trip_committed_cents(t.id) + s.carrier_amount_cents > t.earnings_cap_cents then
      raise exception 'Aceptar este paquete supera el tope de gastos compartidos de tu trayecto';
    end if;
  end if;
  update public.shipments
     set status = case when p_accept then 'aceptado'::public.shipment_status else 'rechazado' end,
         responded_at = now(),
         rejection_stage = case when p_accept then null else 'solicitud' end
   where id = p_shipment;
end $$;

-- -------------------------------------------------------------------------------------
-- Recogida con revisión (sustituye a mark_picked_up)
-- -------------------------------------------------------------------------------------
drop function if exists public.mark_picked_up(uuid);

create function public.pickup_shipment(p_shipment uuid, p_ok boolean, p_photo_path text, p_reason text default null)
returns public.shipment_status language plpgsql security definer set search_path = '' as $$
declare s public.shipments; t public.trips; v_new public.shipment_status;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found or not private.is_trip_carrier(s.trip_id) then raise exception 'No autorizado'; end if;
  if s.status <> 'aceptado' then raise exception 'Este paquete no está pendiente de recogida'; end if;
  if p_photo_path is null or not private.own_photo(p_photo_path) then raise exception 'Haz una foto del paquete'; end if;
  select * into t from public.trips where id = s.trip_id;
  if p_ok then
    -- Si el trayecto ya ha empezado (recogida por el camino), pasa directamente a "en camino"
    v_new := case when t.started_at is not null then 'en_camino'::public.shipment_status else 'recogido' end;
    update public.shipments set status = v_new, picked_up_at = now(), pickup_photo_path = p_photo_path where id = p_shipment;
  else
    if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'Explica qué no coincide con lo declarado'; end if;
    v_new := 'rechazado';
    update public.shipments set status = v_new, rejection_stage = 'recogida', rejection_reason = left(trim(p_reason), 300),
           pickup_photo_path = p_photo_path, responded_at = now()
     where id = p_shipment;
  end if;
  return v_new;
end $$;
revoke execute on function public.pickup_shipment(uuid, boolean, text, text) from public, anon;
grant execute on function public.pickup_shipment(uuid, boolean, text, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- "Empiezo el trayecto": todos los paquetes recogidos pasan a "en camino"
-- -------------------------------------------------------------------------------------
create or replace function public.start_trip(p_trip uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare t public.trips; v_n integer;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id <> auth.uid() then raise exception 'No autorizado'; end if;
  if t.status <> 'publicado' then raise exception 'Este trayecto ya no está activo'; end if;
  if t.departure_at > now() + interval '12 hours' then raise exception 'Todavía falta mucho para la salida'; end if;
  if t.started_at is null then update public.trips set started_at = now() where id = p_trip; end if;
  update public.shipments set status = 'en_camino' where trip_id = p_trip and status = 'recogido';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.start_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- Funciones existentes adaptadas a los estados nuevos
-- -------------------------------------------------------------------------------------
create or replace function public.get_delivery_code(p_shipment uuid)
returns text language sql stable security definer set search_path = '' as $$
  select sec.delivery_code from public.shipment_secrets sec join public.shipments s on s.id = sec.shipment_id
  where s.id = p_shipment and s.sender_id = (select auth.uid()) and s.status in ('aceptado', 'recogido', 'en_camino');
$$;

create or replace function public.my_balance()
returns table(available_cents integer, pending_cents integer) language sql stable set search_path = '' as $$
  select
    coalesce((select sum(amount_cents) from public.movements where user_id = (select auth.uid())), 0)::integer,
    coalesce((select sum(s.carrier_amount_cents) from public.shipments s join public.trips t on t.id = s.trip_id
      where t.carrier_id = (select auth.uid()) and s.status in ('aceptado', 'recogido', 'en_camino')), 0)::integer;
$$;

create or replace function public.confirm_delivery(p_shipment uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare s public.shipments; sec public.shipment_secrets;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found or not private.is_trip_carrier(s.trip_id) then raise exception 'No autorizado'; end if;
  if s.status = 'entregado' then return 'ok'; end if;
  if s.status not in ('recogido', 'en_camino') then raise exception 'Marca primero el paquete como recogido'; end if;
  select * into sec from public.shipment_secrets where shipment_id = p_shipment for update;
  if sec.failed_attempts >= 5 then return 'bloqueado'; end if;
  if sec.delivery_code <> p_code then
    update public.shipment_secrets set failed_attempts = failed_attempts + 1 where shipment_id = p_shipment;
    return case when sec.failed_attempts + 1 >= 5 then 'bloqueado' else 'incorrecto' end;
  end if;
  update public.shipments set status = 'entregado', delivered_at = now() where id = p_shipment;
  insert into public.movements (user_id, shipment_id, kind, amount_cents, description)
  select auth.uid(), s.id, 'ganancia', s.carrier_amount_cents, 'Paquete de ' || p.name from public.profiles p where p.id = s.sender_id;
  return 'ok';
end $$;

-- Detalle del trayecto: añade tope, inicio, exigencia de verificados y origen de la distancia
drop function if exists public.trip_detail(uuid);
create function public.trip_detail(p_trip uuid)
returns table(id uuid, carrier_id uuid, from_label text, from_city text, from_lat double precision, from_lng double precision,
  to_label text, to_city text, to_lat double precision, to_lng double precision, departure_at timestamptz, arrival_at timestamptz,
  distance_km integer, capacity smallint, booked integer, max_size public.package_size, max_weight_kg numeric,
  price_cents integer, total_cents integer, status public.trip_status,
  earnings_cap_cents integer, cap_remaining_cents integer, distance_source text, started_at timestamptz,
  require_verified_sender boolean, carrier_verified boolean)
language sql stable security definer set search_path = '' as $$
  select t.id, t.carrier_id, t.from_label, t.from_city, extensions.st_y(t.from_point::extensions.geometry), extensions.st_x(t.from_point::extensions.geometry),
    t.to_label, t.to_city, extensions.st_y(t.to_point::extensions.geometry), extensions.st_x(t.to_point::extensions.geometry),
    t.departure_at, t.arrival_at, t.distance_km, t.capacity, private.trip_booked(t.id), t.max_size, t.max_weight_kg,
    t.price_cents, public.total_for_carrier_cents(t.price_cents), t.status,
    t.earnings_cap_cents,
    case when t.earnings_cap_cents is null then null else greatest(0, t.earnings_cap_cents - private.trip_committed_cents(t.id)) end,
    t.distance_source, t.started_at, t.require_verified_sender, p.verified
  from public.trips t join public.profiles p on p.id = t.carrier_id
  where t.id = p_trip and (select auth.uid()) is not null
    and (t.status = 'publicado' or t.carrier_id = (select auth.uid()) or private.has_shipment_on_trip(t.id));
$$;
revoke execute on function public.trip_detail(uuid) from public, anon;
grant execute on function public.trip_detail(uuid) to authenticated;

-- Búsqueda: añade la insignia del carrier y si exige senders verificados
drop function if exists public.search_trips(double precision, double precision, double precision, double precision, date, integer);
create function public.search_trips(p_from_lat double precision, p_from_lng double precision, p_to_lat double precision,
  p_to_lng double precision, p_day date, p_radius_km integer default 20)
returns table(id uuid, carrier_id uuid, carrier_name text, carrier_rating numeric, carrier_reviews integer,
  from_label text, from_city text, to_label text, to_city text, departure_at timestamptz, arrival_at timestamptz,
  max_size public.package_size, max_weight_kg numeric, price_cents integer, total_cents integer, seats_left integer,
  from_km numeric, to_km numeric, carrier_verified boolean, require_verified_sender boolean)
language sql stable security definer set search_path = '' as $$
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_from_lng, p_from_lat), 4326)::extensions.geography g),
       d as (select extensions.st_setsrid(extensions.st_makepoint(p_to_lng, p_to_lat), 4326)::extensions.geography g)
  select t.id, t.carrier_id, p.name,
    coalesce((select round(avg(r.stars)::numeric, 1) from public.reviews r where r.about_id = t.carrier_id), 0),
    (select count(*) from public.reviews r where r.about_id = t.carrier_id)::integer,
    t.from_label, t.from_city, t.to_label, t.to_city, t.departure_at, t.arrival_at,
    t.max_size, t.max_weight_kg, t.price_cents, public.total_for_carrier_cents(t.price_cents),
    t.capacity - private.trip_booked(t.id),
    round((extensions.st_distance(t.from_point, o.g) / 1000)::numeric, 1),
    round((extensions.st_distance(t.to_point, d.g) / 1000)::numeric, 1),
    p.verified, t.require_verified_sender
  from public.trips t join public.profiles p on p.id = t.carrier_id, o, d
  where (select auth.uid()) is not null and t.status = 'publicado' and t.carrier_id <> (select auth.uid())
    and t.started_at is null
    and t.departure_at > now() and (t.departure_at at time zone 'Europe/Madrid')::date = p_day
    and extensions.st_dwithin(t.from_point, o.g, least(p_radius_km, 100) * 1000)
    and extensions.st_dwithin(t.to_point, d.g, least(p_radius_km, 100) * 1000)
    and t.capacity - private.trip_booked(t.id) > 0
  order by t.departure_at limit 50;
$$;
revoke execute on function public.search_trips(double precision, double precision, double precision, double precision, date, integer) from public, anon;
grant execute on function public.search_trips(double precision, double precision, double precision, double precision, date, integer) to authenticated;

-- Mis datos de verificación (solo lectura para el propio usuario)
create or replace function public.my_verification()
returns table(identity_status public.identity_status, payouts_ready boolean, verified boolean)
language sql stable security definer set search_path = '' as $$
  select pp.identity_status, pp.stripe_transfers_enabled, private.is_verified(pp.id)
  from public.profile_private pp where pp.id = (select auth.uid());
$$;
revoke execute on function public.my_verification() from public, anon;
grant execute on function public.my_verification() to authenticated;

revoke execute on function public.validate_trip() from public, anon, authenticated;
