-- 07f · Todos los senders verifican su identidad al contratar su primer envío (decisión del 29/10/2026).
-- Sustituye a "solo si el carrier lo exige o si el valor declarado supera 100 €".
create or replace function public.request_shipment(
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

  -- Identidad del sender: obligatoria para oficializar cualquier envío (una sola vez por persona)
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

comment on column public.trips.require_verified_sender is 'Sin uso desde el 29/10/2026: todos los senders se verifican.';
comment on column public.app_config.identity_value_threshold_cents is 'Sin uso desde el 29/10/2026: todos los senders se verifican.';
