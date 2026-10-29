-- =====================================================================================
-- PROPUESTA (no aplicada). Migración 07 · Cambios legales para la beta de WannaSend
-- Puntos 1-7 del documento de cambios. Se aplicaría como UNA migración: la base de datos
-- de producción no tiene envíos ni trayectos ahora mismo, así que se pueden añadir columnas
-- NOT NULL y cambiar estados sin migrar datos.
-- Los valores marcados con  <-- DECIDIR  dependen de tu respuesta.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. Configuración (una fila en app_config)
-- -------------------------------------------------------------------------------------
alter table public.app_config
  add column trip_cap_cents_per_km   integer not null default 26     -- 0,26 €/km   <-- DECIDIR
    check (trip_cap_cents_per_km between 1 and 100),
  add column max_declared_value_cents integer not null default 30000  -- 300 €       <-- DECIDIR
    check (max_declared_value_cents > 0),
  add column prohibited_list_version text not null default '2026-11', -- versión de la lista aceptada
  add column require_identity        boolean not null default false;  -- activa la obligación de DNI

-- -------------------------------------------------------------------------------------
-- 5. Tipo de carrier (solo base de datos) + 4. estado de verificación de identidad
--    Van en profile_private: solo el propio usuario puede leerlos y NO puede modificarlos
--    (el permiso UPDATE de esa tabla está limitado a phone, birth_date, marketing_opt_in y
--    push_token, así que nadie puede hacerse "pro" o "verificado" a sí mismo).
-- -------------------------------------------------------------------------------------
create type public.carrier_type as enum ('particular', 'pro');
create type public.identity_status as enum ('sin_verificar', 'pendiente', 'verificado', 'fallido');

alter table public.profile_private
  add column carrier_type            public.carrier_type not null default 'particular',
  add column tax_id                  text check (tax_id is null or tax_id ~ '^[0-9A-Z]{8,10}$'), -- NIF (solo "pro")
  add column self_billing_accepted_at timestamptz,          -- acepta la autofacturación (solo "pro")
  add column identity_status         public.identity_status not null default 'sin_verificar',
  add column identity_session_id     text,                  -- VerificationSession de Stripe Identity
  add column identity_verified_at    timestamptz;
-- No guardamos el número de DNI ni la imagen: se quedan en Stripe.

-- -------------------------------------------------------------------------------------
-- 3. Estado "Recogido": se renombra 'en_camino' (que ya hacía ese papel) a 'recogido'.
--    No hay filas con ese estado. Las funciones que lo usan se recrean más abajo.
-- -------------------------------------------------------------------------------------
alter type public.shipment_status rename value 'en_camino' to 'recogido';

-- -------------------------------------------------------------------------------------
-- 1. Tope de ganancia por trayecto
-- -------------------------------------------------------------------------------------
alter table public.trips add column earnings_cap_cents integer; -- null = sin tope (carrier "pro")

-- Lo que el carrier ya tiene comprometido en el trayecto (aceptado, recogido o entregado)
create or replace function private.trip_committed_cents(p_trip uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(carrier_amount_cents), 0)::integer from public.shipments
  where trip_id = p_trip and status in ('aceptado', 'recogido', 'entregado');
$$;

-- Tope restante (lo usan "Publicar trayecto", el detalle del trayecto y "Solicitudes recibidas")
create or replace function public.trip_cap_remaining(p_trip uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case when t.earnings_cap_cents is null then null
              else greatest(0, t.earnings_cap_cents - private.trip_committed_cents(t.id)) end
  from public.trips t where t.id = p_trip;
$$;
grant execute on function public.trip_cap_remaining(uuid) to authenticated;

-- Cálculo del tope al publicar (se añade a la validación existente del trayecto)
create or replace function public.validate_trip() returns trigger
language plpgsql set search_path = '' as $$
declare v_sugg integer; v_min integer; v_max integer; v_per_km integer; v_type public.carrier_type;
begin
  new.distance_km := greatest(1, round(extensions.st_distance(new.from_point, new.to_point) / 1000 * 1.2))::integer;
  if tg_op = 'INSERT' then
    if new.departure_at < now() then raise exception 'La salida debe ser en el futuro'; end if;
    if new.departure_at > now() + interval '90 days' then raise exception 'Solo puedes publicar con 90 días de antelación'; end if;
    new.status := 'publicado';
  end if;
  if new.distance_km < 5 then raise exception 'El origen y el destino están demasiado cerca'; end if;
  v_sugg := public.suggested_price_cents(new.distance_km, new.max_size);
  v_min := greatest(300, round(v_sugg * 0.7 / 10.0) * 10);
  v_max := round(v_sugg * 1.3 / 10.0) * 10;
  if new.price_cents < v_min or new.price_cents > v_max then
    raise exception 'El precio debe estar entre % y % céntimos', v_min, v_max;
  end if;
  -- Tope de gastos compartidos (solo particulares)
  select trip_cap_cents_per_km into v_per_km from public.app_config;
  select carrier_type into v_type from public.profile_private where id = new.carrier_id;
  if coalesce(v_type, 'particular') = 'particular' then
    new.earnings_cap_cents := new.distance_km * v_per_km;
    if new.price_cents > new.earnings_cap_cents then
      raise exception 'Con este trayecto puedes cobrar como máximo % céntimos en total', new.earnings_cap_cents;
    end if;
  else
    new.earnings_cap_cents := null;
  end if;
  return new;
end $$;

create or replace function public.respond_shipment(p_shipment uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shipments; t public.trips;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found then raise exception 'Envío no encontrado'; end if;
  select * into t from public.trips where id = s.trip_id for update;  -- bloquea el trayecto: dos aceptaciones a la vez no se saltan el tope
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
-- 2. Declaración del contenido + 3. revisión en la recogida + 6. urgencia + 7. seguro
-- -------------------------------------------------------------------------------------
create type public.shipment_urgency as enum ('urgente', 'en_el_dia', 'programado');

alter table public.shipments
  add column declared_value_cents   integer not null check (declared_value_cents > 0),
  add column photo_path             text    not null,      -- foto del sender (bucket package-photos)
  add column prohibited_ack_at      timestamptz not null,  -- marcó "No contiene objetos prohibidos"
  add column prohibited_ack_version text    not null,      -- versión de la lista que aceptó
  add column pickup_photo_path      text,                  -- foto del carrier al recoger
  add column rejection_stage        text check (rejection_stage in ('solicitud', 'recogida')),
  add column rejection_reason       text check (char_length(rejection_reason) <= 300),
  add column urgency                public.shipment_urgency not null default 'programado',  -- 6 (sin pantallas)
  add column insurance_cents        integer not null default 0 check (insurance_cents >= 0);  -- 7 (sin pantallas)

-- Desglose coherente: total = aportación al carrier + gastos de gestión + seguro
alter table public.shipments
  add constraint shipments_total_breakdown check (total_cents = carrier_amount_cents + fee_cents + insurance_cents);

-- ---- Almacenamiento de fotos (privado) ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-photos', 'package-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
-- Ruta de cada foto: <id del usuario que la sube>/<uuid aleatorio>.jpg

-- ¿Puede el usuario actual ver esta foto? (sender o carrier del envío que la usa)
create or replace function private.can_view_package_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shipments s
    where (s.photo_path = p_name or s.pickup_photo_path = p_name)
      and (s.sender_id = (select auth.uid()) or private.is_trip_carrier(s.trip_id))
  );
$$;

create policy "Subir fotos de paquetes a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'package-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Ver mis fotos o las de mis envíos" on storage.objects for select to authenticated
  using (bucket_id = 'package-photos'
         and (owner_id = (select auth.uid())::text or private.can_view_package_photo(name)));
-- Sin UPDATE ni DELETE para usuarios: las fotos son prueba en caso de incidencia.
-- Un proceso programado borrará las que no se usen en 24 h y las de envíos cerrados hace más de N días.  <-- DECIDIR N

-- Comprueba que la foto existe, es del usuario y está en el bucket correcto
create or replace function private.own_photo(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from storage.objects o
                 where o.bucket_id = 'package-photos' and o.name = p_path
                   and o.owner_id = (select auth.uid())::text);
$$;

-- ---- Solicitud con declaración (sustituye a la versión actual) ----
drop function public.request_shipment(uuid, public.package_size, numeric, text, text, text, text);

create function public.request_shipment(
  p_trip uuid, p_size public.package_size, p_weight numeric, p_content text, p_description text,
  p_recipient_name text, p_recipient_phone text,
  p_declared_value_cents integer, p_photo_path text, p_no_prohibited boolean,
  p_urgency public.shipment_urgency default 'programado')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); t public.trips; cfg public.app_config; v_id uuid; v_code text; v_ident public.identity_status;
begin
  if v_uid is null then raise exception 'Inicia sesión'; end if;
  select * into cfg from public.app_config;
  if cfg.require_identity then
    select identity_status into v_ident from public.profile_private where id = v_uid;
    if v_ident is distinct from 'verificado' then raise exception 'Verifica tu identidad antes de tu primer envío'; end if;
  end if;
  if not coalesce(p_no_prohibited, false) then raise exception 'Confirma que el paquete no contiene objetos prohibidos'; end if;
  if p_declared_value_cents is null or p_declared_value_cents < 1 then raise exception 'Indica el valor del contenido'; end if;
  if p_declared_value_cents > cfg.max_declared_value_cents then
    raise exception 'El valor declarado no puede superar % €', cfg.max_declared_value_cents / 100;
  end if;
  if p_photo_path is null or not private.own_photo(p_photo_path) then raise exception 'Añade una foto del paquete'; end if;

  select * into t from public.trips where id = p_trip for update;
  if not found or t.status <> 'publicado' then raise exception 'Este trayecto ya no está disponible'; end if;
  if t.carrier_id = v_uid then raise exception 'No puedes enviar un paquete en tu propio trayecto'; end if;
  if t.departure_at < now() + interval '30 minutes' then raise exception 'Este trayecto sale demasiado pronto'; end if;
  if p_size > t.max_size then raise exception 'El paquete es más grande de lo que acepta el carrier'; end if;
  if p_weight > t.max_weight_kg then raise exception 'El paquete pesa más de lo que acepta el carrier'; end if;
  if private.trip_booked(p_trip) >= t.capacity then raise exception 'El trayecto está completo'; end if;
  -- No se cobra a nadie por una solicitud que el carrier ya no podría aceptar
  if t.earnings_cap_cents is not null and private.trip_committed_cents(p_trip) + t.price_cents > t.earnings_cap_cents then
    raise exception 'El trayecto está completo';
  end if;
  update public.shipments set status = 'cancelado', cancelled_at = now()
    where trip_id = p_trip and sender_id = v_uid and status = 'pendiente_pago';
  if exists (select 1 from public.shipments where trip_id = p_trip and sender_id = v_uid and status in ('solicitado','aceptado','recogido')) then
    raise exception 'Ya tienes un envío activo en este trayecto';
  end if;
  if (select count(*) from public.shipments where sender_id = v_uid and requested_at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiadas solicitudes. Inténtalo más tarde';
  end if;
  if p_recipient_phone !~ '^\+?[0-9 ]{9,16}$' then raise exception 'Revisa el móvil del destinatario'; end if;

  insert into public.shipments (trip_id, sender_id, size, weight_kg, content, description, recipient_name,
    carrier_amount_cents, total_cents, fee_cents, insurance_cents, status,
    declared_value_cents, photo_path, prohibited_ack_at, prohibited_ack_version, urgency)
  values (p_trip, v_uid, p_size, p_weight, trim(p_content), trim(coalesce(p_description, '')), trim(p_recipient_name),
    t.price_cents, public.total_for_carrier_cents(t.price_cents), public.total_for_carrier_cents(t.price_cents) - t.price_cents, 0,
    case when cfg.payments_enabled then 'pendiente_pago'::public.shipment_status else 'solicitado' end,
    p_declared_value_cents, p_photo_path, now(), cfg.prohibited_list_version, p_urgency)
  returning id into v_id;
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text, 4, '0');
  insert into public.shipment_contacts (shipment_id, recipient_phone) values (v_id, regexp_replace(p_recipient_phone, '\s', '', 'g'));
  insert into public.shipment_secrets (shipment_id, delivery_code) values (v_id, v_code);
  return v_id;
end $$;
grant execute on function public.request_shipment(uuid, public.package_size, numeric, text, text, text, text, integer, text, boolean, public.shipment_urgency) to authenticated;

-- ---- Recogida con revisión (sustituye a mark_picked_up) ----
-- p_ok = true  -> 'recogido' (foto obligatoria)
-- p_ok = false -> 'rechazado' en la recogida (foto y motivo obligatorios). El proceso automático
--                 ya reembolsa cualquier envío 'rechazado' pagado, así que el reembolso no cambia.
drop function public.mark_picked_up(uuid);

create function public.pickup_shipment(p_shipment uuid, p_ok boolean, p_photo_path text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shipments;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found or not private.is_trip_carrier(s.trip_id) then raise exception 'No autorizado'; end if;
  if s.status <> 'aceptado' then raise exception 'Este paquete no está pendiente de recogida'; end if;
  if p_photo_path is null or not private.own_photo(p_photo_path) then raise exception 'Haz una foto del paquete'; end if;
  if p_ok then
    update public.shipments set status = 'recogido', picked_up_at = now(), pickup_photo_path = p_photo_path where id = p_shipment;
  else
    if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'Explica por qué no coincide con lo declarado'; end if;
    update public.shipments set status = 'rechazado', rejection_stage = 'recogida', rejection_reason = trim(p_reason),
           pickup_photo_path = p_photo_path, responded_at = now()
     where id = p_shipment;
  end if;
end $$;
grant execute on function public.pickup_shipment(uuid, boolean, text, text) to authenticated;

-- ---- Funciones que usaban 'en_camino' (mismo comportamiento, nuevo nombre del estado) ----
create or replace function private.trip_booked(p_trip uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.shipments where trip_id = p_trip and status in ('aceptado','recogido','entregado');
$$;

create or replace function public.get_delivery_code(p_shipment uuid)
returns text language sql stable security definer set search_path = '' as $$
  select sec.delivery_code from public.shipment_secrets sec join public.shipments s on s.id = sec.shipment_id
  where s.id = p_shipment and s.sender_id = (select auth.uid()) and s.status in ('aceptado','recogido');
$$;

create or replace function public.my_balance()
returns table(available_cents integer, pending_cents integer) language sql stable set search_path = '' as $$
  select
    coalesce((select sum(amount_cents) from public.movements where user_id = (select auth.uid())), 0)::integer,
    coalesce((select sum(s.carrier_amount_cents) from public.shipments s join public.trips t on t.id = s.trip_id
      where t.carrier_id = (select auth.uid()) and s.status in ('aceptado','recogido')), 0)::integer;
$$;

create or replace function public.confirm_delivery(p_shipment uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare s public.shipments; sec public.shipment_secrets;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found or not private.is_trip_carrier(s.trip_id) then raise exception 'No autorizado'; end if;
  if s.status = 'entregado' then return 'ok'; end if;
  if s.status <> 'recogido' then raise exception 'Marca primero el paquete como recogido'; end if;
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

-- -------------------------------------------------------------------------------------
-- 4. Identidad obligatoria también para publicar trayectos (si require_identity está activo)
--    Propuesta: para el carrier cuenta como verificado haber completado el alta de cobros en
--    Stripe (que ya verifica identidad y datos fiscales). Ver dudas en el plan.
-- -------------------------------------------------------------------------------------
create or replace function private.check_trip_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_req boolean; p public.profile_private;
begin
  select require_identity into v_req from public.app_config;
  if not v_req then return new; end if;
  select * into p from public.profile_private where id = new.carrier_id;
  if p.identity_status is distinct from 'verificado' and not coalesce(p.stripe_transfers_enabled, false) then
    raise exception 'Verifica tu identidad antes de publicar tu primer trayecto';
  end if;
  return new;
end $$;
create trigger trips_check_identity before insert on public.trips
  for each row execute function private.check_trip_identity();
