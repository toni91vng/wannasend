-- 12 · Decisiones del 30/10/2026:
--  1) Sin teléfonos: todo se habla por el chat de la app. Se dejan de pedir y se borran los guardados.
--  2) Valor declarado por tramos y privado: solo lo ven el sender y WannaSend (el carrier no).
-- Aplicada en producción en dos partes (12a esquema, 12b funciones). La parte de datos (mover valores
-- antiguos a shipment_values y borrar teléfonos, al final) queda pendiente de ejecutar a mano.

-- ---------- Valor declarado privado ----------
create table if not exists public.shipment_values (
  shipment_id uuid primary key references public.shipments(id) on delete cascade,
  tier text not null check (tier in ('hasta_50', '50_150', '150_300')),
  max_cents integer not null check (max_cents > 0),
  exact_cents integer check (exact_cents > 0)  -- solo envíos antiguos (cifra exacta)
);
alter table public.shipment_values enable row level security;
create policy "Valor declarado: solo el sender" on public.shipment_values for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id and s.sender_id = (select auth.uid())));
revoke all on public.shipment_values from anon, authenticated;
grant select on public.shipment_values to authenticated;

create or replace function private.value_tier(p_cents integer) returns text language sql immutable as $$
  select case when p_cents <= 5000 then 'hasta_50' when p_cents <= 15000 then '50_150' else '150_300' end;
$$;
create or replace function private.tier_max_cents(p_tier text) returns integer language sql immutable as $$
  select case p_tier when 'hasta_50' then 5000 when '50_150' then 15000 when '150_300' then 30000 end;
$$;

alter table public.shipments alter column declared_value_cents drop not null;

insert into public.shipment_values (shipment_id, tier, max_cents, exact_cents)
  select id, private.value_tier(declared_value_cents), private.tier_max_cents(private.value_tier(declared_value_cents)), declared_value_cents
  from public.shipments where declared_value_cents is not null
  on conflict (shipment_id) do nothing;
update public.shipments set declared_value_cents = null where declared_value_cents is not null;
comment on column public.shipments.declared_value_cents is 'Sin uso desde el 30/10/2026: el valor está en shipment_values (privado del sender).';

-- ---------- Solicitud de envío (versión nueva: tramo de valor, sin teléfono) ----------
create or replace function public.request_shipment_v2(
  p_trip uuid, p_size public.package_size, p_weight numeric, p_content text, p_description text,
  p_recipient_name text, p_value_tier text, p_photo_path text, p_no_prohibited boolean,
  p_urgency public.shipment_urgency default 'programado')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); t public.trips; cfg public.app_config; v_id uuid; v_code text; v_total integer; v_max integer;
begin
  if v_uid is null then raise exception 'Inicia sesión'; end if;
  if coalesce(trim(p_recipient_name), '') = '' then raise exception 'Indica a quién se lo entrega el carrier'; end if;
  select * into cfg from public.app_config;
  if not coalesce(p_no_prohibited, false) then raise exception 'Confirma que el paquete no contiene objetos prohibidos'; end if;
  v_max := private.tier_max_cents(p_value_tier);
  if v_max is null then raise exception 'Indica el valor aproximado del contenido'; end if;
  if v_max > cfg.max_declared_value_cents then
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

  if cfg.sender_verification_enabled and not private.is_verified(v_uid) then
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

  v_total := public.total_for_carrier_cents(t.price_cents);
  insert into public.shipments (trip_id, sender_id, size, weight_kg, content, description, recipient_name,
    carrier_amount_cents, total_cents, fee_cents, insurance_cents, status,
    declared_value_cents, photo_path, prohibited_ack_at, prohibited_ack_version, urgency)
  values (p_trip, v_uid, p_size, p_weight, trim(p_content), trim(coalesce(p_description, '')), trim(p_recipient_name),
    t.price_cents, v_total, v_total - t.price_cents, 0,
    case when cfg.payments_enabled then 'pendiente_pago'::public.shipment_status else 'solicitado' end,
    null, p_photo_path, now(), cfg.prohibited_list_version, coalesce(p_urgency, 'programado'))
  returning id into v_id;
  insert into public.shipment_values (shipment_id, tier, max_cents) values (v_id, p_value_tier, v_max);
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text, 4, '0');
  insert into public.shipment_secrets (shipment_id, delivery_code) values (v_id, v_code);
  return v_id;
end $$;
revoke execute on function public.request_shipment_v2(uuid, public.package_size, numeric, text, text, text, text, text, boolean, public.shipment_urgency) from public, anon;
grant execute on function public.request_shipment_v2(uuid, public.package_size, numeric, text, text, text, text, text, boolean, public.shipment_urgency) to authenticated;

-- La versión del APK 1.0.0 sigue funcionando: convierte la cifra en tramo e ignora el teléfono
create or replace function public.request_shipment(
  p_trip uuid, p_size public.package_size, p_weight numeric, p_content text, p_description text,
  p_recipient_name text, p_recipient_phone text,
  p_declared_value_cents integer, p_photo_path text, p_no_prohibited boolean,
  p_urgency public.shipment_urgency default 'programado')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_declared_value_cents is null or p_declared_value_cents < 1 then raise exception 'Indica el valor aproximado del contenido'; end if;
  if p_declared_value_cents > (select max_declared_value_cents from public.app_config) then
    raise exception 'El valor declarado no puede superar % €', (select max_declared_value_cents from public.app_config) / 100;
  end if;
  return public.request_shipment_v2(p_trip, p_size, p_weight, p_content, p_description, p_recipient_name,
    private.value_tier(p_declared_value_cents), p_photo_path, p_no_prohibited, p_urgency);
end $$;

-- ---------- Sin teléfonos ----------
delete from public.shipment_contacts;
update public.profile_private set phone = null where phone is not null;
comment on table public.shipment_contacts is 'Sin uso desde el 30/10/2026: no se piden teléfonos.';
comment on column public.profile_private.phone is 'Sin uso desde el 30/10/2026: no se piden teléfonos.';
