-- 10 · Código de recogida y "En camino" 3 h antes (decisión del 30/10/2026).
-- El sender ve un código de 4 cifras (y su QR); el carrier lo necesita para marcar "Recogido".
-- Se activa con app_config.pickup_code_required cuando salga el APK 1.1.0 (el 1.0.0 no sabe pedirlo).

alter table public.app_config add column if not exists pickup_code_required boolean not null default false;

alter table public.shipment_secrets
  add column if not exists pickup_code text not null
    default lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text, 4, '0'),
  add column if not exists pickup_failed_attempts smallint not null default 0,
  add column if not exists pickup_failed_at timestamptz;

-- El sender (solo él) consulta el código mientras el paquete está pendiente de recogida
create or replace function public.get_pickup_code(p_shipment uuid)
returns text language sql stable security definer set search_path = '' as $$
  select sec.pickup_code from public.shipment_secrets sec join public.shipments s on s.id = sec.shipment_id
  where s.id = p_shipment and s.sender_id = (select auth.uid()) and s.status = 'aceptado';
$$;
revoke execute on function public.get_pickup_code(uuid) from public, anon;
grant execute on function public.get_pickup_code(uuid) to authenticated;

-- Recogida con código. Devuelve: recogido | en_camino | rechazado | incorrecto | bloqueado
create or replace function public.pickup_shipment_v2(p_shipment uuid, p_ok boolean, p_photo_path text,
  p_code text default null, p_reason text default null)
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
revoke execute on function public.pickup_shipment_v2(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.pickup_shipment_v2(uuid, boolean, text, text, text) to authenticated;

-- La versión antigua (APK 1.0.0) deja de poder marcar "Recogido" cuando el código sea obligatorio
create or replace function public.pickup_shipment(p_shipment uuid, p_ok boolean, p_photo_path text, p_reason text default null)
returns public.shipment_status language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  if p_ok and (select pickup_code_required from public.app_config) then
    raise exception 'Actualiza WannaSend para recoger paquetes: ahora se confirma con el código del sender';
  end if;
  r := public.pickup_shipment_v2(p_shipment, p_ok, p_photo_path, null, p_reason);
  return r::public.shipment_status;
end $$;

-- "Empiezo el trayecto": desde 3 h antes de la salida (antes 12 h)
create or replace function public.start_trip(p_trip uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare t public.trips; v_n integer;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id <> auth.uid() then raise exception 'No autorizado'; end if;
  if t.status <> 'publicado' then raise exception 'Este trayecto ya no está activo'; end if;
  if t.departure_at > now() + interval '3 hours' then raise exception 'Podrás empezar el trayecto 3 horas antes de la salida'; end if;
  if t.started_at is null then update public.trips set started_at = now() where id = p_trip; end if;
  update public.shipments set status = 'en_camino' where trip_id = p_trip and status = 'recogido';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
