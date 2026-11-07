-- 17 · Cobro al aceptar (decisión del 07/11/2026, sustituye a la retención al solicitar del 01/11).
-- Al enviar la solicitud, el sender guarda su método de pago con Stripe (SetupIntent): no se cobra ni se
-- bloquea nada. Cuando el carrier acepta, el servidor cobra automáticamente. Si el banco pide confirmar el
-- pago (o la tarjeta falla), el sender tiene hasta charge_due_at para confirmarlo desde la app; si no, el
-- envío se cancela. El carrier no puede recoger un paquete sin pagar.
alter table public.shipments
  add column if not exists payment_method_id text,
  add column if not exists setup_intent_id text,       -- seti_… (app) o cs_… (web, Stripe Checkout)
  add column if not exists charge_status text check (charge_status in ('cobrando', 'requiere_accion')),
  add column if not exists charge_due_at timestamptz;

-- Aceptar: comprueba plazas y tope; si el envío tiene método guardado y aún no está pagado, pide el cobro
create or replace function public.respond_shipment(p_shipment uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shipments; t public.trips; v_charge boolean;
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
  v_charge := p_accept and s.paid_at is null and s.payment_method_id is not null;
  update public.shipments
     set status = case when p_accept then 'aceptado'::public.shipment_status else 'rechazado' end,
         responded_at = now(),
         rejection_stage = case when p_accept then null else 'solicitud' end,
         charge_status = case when v_charge then 'cobrando' else charge_status end,
         -- 12 h para resolver un cobro fallido, y nunca más tarde de 1 h antes de la salida
         charge_due_at = case when v_charge then least(now() + interval '12 hours', t.departure_at - interval '1 hour') else charge_due_at end
   where id = p_shipment;
  if v_charge then perform private.kick_payments_worker(); end if;
end $$;

-- Llama al proceso de pagos en cuanto se acepta (si falla, lo hace el cron a los 5 minutos)
create or replace function private.kick_payments_worker()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://ublutvpumxtdiuvqbbfa.supabase.co/functions/v1/payments-worker',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-worker-secret', (select value from private.settings where key = 'worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
exception when others then
  raise warning 'No se pudo avisar al proceso de pagos: %', sqlerrm;
end $$;

-- Caducidades: solicitudes sin respuesta (12 h), solicitudes sin método de pago (30 min)
-- y envíos aceptados cuyo cobro no se ha podido completar a tiempo
create or replace function public.expire_requests()
returns integer language sql security definer set search_path = '' as $$
  with a as (update public.shipments set status = 'caducado'
               where status = 'solicitado' and coalesce(paid_at, requested_at) < now() - interval '12 hours' returning 1),
       b as (update public.shipments set status = 'cancelado', cancelled_at = now()
               where status = 'pendiente_pago' and requested_at < now() - interval '30 minutes' returning 1),
       c as (update public.shipments set status = 'cancelado', cancelled_at = now(), charge_status = null
               where status = 'aceptado' and paid_at is null and charge_status = 'requiere_accion'
                 and charge_due_at < now() returning 1)
  select ((select count(*) from a) + (select count(*) from b) + (select count(*) from c))::integer;
$$;

-- Recogida: solo de paquetes pagados (con los pagos activos)
create or replace function public.pickup_shipment_v2(p_shipment uuid, p_ok boolean, p_photo_path text, p_code text default null, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare s public.shipments; t public.trips; sec public.shipment_secrets; cfg public.app_config; v_new public.shipment_status;
begin
  select * into s from public.shipments where id = p_shipment for update;
  if not found or not private.is_trip_carrier(s.trip_id) then raise exception 'No autorizado'; end if;
  if s.status <> 'aceptado' then raise exception 'Este paquete no está pendiente de recogida'; end if;
  if p_photo_path is null or not private.own_photo(p_photo_path) then raise exception 'Haz una foto del paquete'; end if;
  select * into t from public.trips where id = s.trip_id;
  select * into cfg from public.app_config;

  if p_ok then
    if cfg.payments_enabled and s.paid_at is null then
      raise exception 'El sender aún no ha completado el pago. Espera a que se confirme antes de recogerlo';
    end if;
    if cfg.pickup_code_required then
      select * into sec from public.shipment_secrets where shipment_id = p_shipment for update;
      if sec.pickup_failed_attempts >= 5 and sec.pickup_failed_at > now() - interval '15 minutes' then return 'bloqueado'; end if;
      if coalesce(trim(p_code), '') <> sec.pickup_code then
        update public.shipment_secrets
           set pickup_failed_attempts = case when pickup_failed_at < now() - interval '15 minutes' then 1 else pickup_failed_attempts + 1 end,
               pickup_failed_at = now()
         where shipment_id = p_shipment;
        return 'incorrecto';
      end if;
    end if;
    v_new := case when t.started_at is not null then 'en_camino'::public.shipment_status else 'recogido' end;
    update public.shipments set status = v_new, picked_up_at = now(), pickup_photo_path = p_photo_path where id = p_shipment;
  else
    if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'Explica qué no coincide con lo declarado'; end if;
    v_new := 'rechazado';
    update public.shipments set status = v_new, rejection_stage = 'recogida', rejection_reason = left(trim(p_reason), 300),
           pickup_photo_path = p_photo_path, responded_at = now()
     where id = p_shipment;
  end if;
  return v_new::text;
end $$;

-- El código de recogida solo se muestra cuando el envío está pagado
create or replace function public.get_pickup_code(p_shipment uuid)
returns text language sql stable security definer set search_path = '' as $$
  select sec.pickup_code from public.shipment_secrets sec join public.shipments s on s.id = sec.shipment_id
  where s.id = p_shipment and s.sender_id = (select auth.uid()) and s.status = 'aceptado'
    and (s.paid_at is not null or not (select payments_enabled from public.app_config));
$$;
