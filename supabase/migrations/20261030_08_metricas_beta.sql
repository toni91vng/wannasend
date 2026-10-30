-- 08 · Métricas agregadas de la beta para el panel de control.
-- Solo números (sin nombres, emails ni ubicaciones). Excluye las cuentas de prueba (@wannasend.test).
-- Solo la puede ejecutar el servidor (service_role); los usuarios de la app no tienen acceso.
create or replace function public.beta_metrics()
returns jsonb language sql stable security definer set search_path = '' as $$
with u as (
  select au.id, au.created_at, pp.stripe_account_id, pp.stripe_transfers_enabled, pp.identity_status
  from auth.users au join public.profile_private pp on pp.id = au.id
  where au.email not like '%@wannasend.test'
),
t as (select t.* from public.trips t join u on u.id = t.carrier_id),
s as (select s.* from public.shipments s join u on u.id = s.sender_id),
days as (select generate_series((now() at time zone 'Europe/Madrid')::date - 29, (now() at time zone 'Europe/Madrid')::date, '1 day')::date d)
select jsonb_build_object(
  'generated_at', now(),
  'users', jsonb_build_object(
    'total', (select count(*) from u),
    'last_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'payouts_started', (select count(*) from u where stripe_account_id is not null),
    'payouts_active', (select count(*) from u where stripe_transfers_enabled),
    'identity_verified', (select count(*) from u where identity_status = 'verificado'),
    'carriers', (select count(distinct carrier_id) from t),
    'senders', (select count(distinct sender_id) from s)
  ),
  'carrier_funnel', jsonb_build_array(
    jsonb_build_object('step', 'Registrados', 'n', (select count(*) from u)),
    jsonb_build_object('step', 'Calculan un trayecto', 'n', (select count(distinct q.user_id) from public.route_quotes q join u on u.id = q.user_id)),
    jsonb_build_object('step', 'Empiezan el alta de cobros', 'n', (select count(*) from u where stripe_account_id is not null)),
    jsonb_build_object('step', 'Cobros activados', 'n', (select count(*) from u where stripe_transfers_enabled)),
    jsonb_build_object('step', 'Publican un trayecto', 'n', (select count(distinct carrier_id) from t))
  ),
  'shipment_funnel', jsonb_build_array(
    jsonb_build_object('step', 'Solicitudes creadas', 'n', (select count(*) from s)),
    jsonb_build_object('step', 'Pagadas', 'n', (select count(*) from s where paid_at is not null or status not in ('pendiente_pago', 'cancelado'))),
    jsonb_build_object('step', 'Aceptadas', 'n', (select count(*) from s where status in ('aceptado', 'recogido', 'en_camino', 'entregado') or rejection_stage = 'recogida')),
    jsonb_build_object('step', 'Recogidas', 'n', (select count(*) from s where status in ('recogido', 'en_camino', 'entregado'))),
    jsonb_build_object('step', 'Entregadas', 'n', (select count(*) from s where status = 'entregado'))
  ),
  'status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text, count(*) n from s group by 1) x),
  'health', jsonb_build_object(
    'expired', (select count(*) from s where status = 'caducado'),
    'rejected_request', (select count(*) from s where status = 'rechazado' and coalesce(rejection_stage, 'solicitud') = 'solicitud'),
    'rejected_pickup', (select count(*) from s where rejection_stage = 'recogida'),
    'cancelled', (select count(*) from s where status = 'cancelado'),
    'abandoned_payment', (select count(*) from s where status = 'cancelado' and paid_at is null),
    'refunded', (select count(*) from s where refunded_at is not null),
    'reports_open', (select count(*) from public.reports r where r.status = 'abierto'),
    'reports_total', (select count(*) from public.reports)
  ),
  'model', jsonb_build_object(
    'trips', (select count(*) from t),
    'trips_upcoming', (select count(*) from t where status = 'publicado' and departure_at > now()),
    'avg_km', (select round(avg(distance_km)) from t),
    'road_distance_pct', (select round(100.0 * count(*) filter (where distance_source = 'carretera') / nullif(count(*), 0)) from t),
    'avg_price_eur', (select round(avg(price_cents) / 100.0, 2) from t),
    'avg_capacity', (select round(avg(capacity), 1) from t),
    'avg_cap_use_pct', (select round(avg(100.0 * (select coalesce(sum(x.carrier_amount_cents), 0) from public.shipments x
                          where x.trip_id = t.id and x.status in ('aceptado', 'recogido', 'en_camino', 'entregado')) / nullif(t.earnings_cap_cents, 0)))
                        from t where t.departure_at < now() and t.status <> 'cancelado'),
    'avg_declared_eur', (select round(avg(declared_value_cents) / 100.0, 2) from s),
    'gmv_eur', (select coalesce(sum(total_cents), 0) / 100.0 from s where status = 'entregado'),
    'carrier_eur', (select coalesce(sum(carrier_amount_cents), 0) / 100.0 from s where status = 'entregado'),
    'fees_eur', (select coalesce(sum(fee_cents), 0) / 100.0 from s where status = 'entregado')
  ),
  'daily', (select jsonb_agg(jsonb_build_object(
      'day', d,
      'signups', (select count(*) from u where (u.created_at at time zone 'Europe/Madrid')::date = d),
      'trips', (select count(*) from t where (t.created_at at time zone 'Europe/Madrid')::date = d),
      'requests', (select count(*) from s where (s.requested_at at time zone 'Europe/Madrid')::date = d),
      'deliveries', (select count(*) from s where (s.delivered_at at time zone 'Europe/Madrid')::date = d)
    ) order by d) from days)
);
$$;
revoke execute on function public.beta_metrics() from public, anon, authenticated;
grant execute on function public.beta_metrics() to service_role;
