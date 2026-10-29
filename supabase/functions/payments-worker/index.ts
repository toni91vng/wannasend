// Proceso automático (cada 5 minutos con pg_cron). Protegido con la cabecera x-worker-secret (secreto guardado en la base de datos).
//  1. Reembolsa los envíos pagados que se rechazaron, caducaron o se cancelaron.
//  2. Transfiere su parte al carrier de los envíos entregados (si ya completó el alta en Stripe).
// Es idempotente: se puede ejecutar las veces que haga falta.
import { admin, carrierTransfersActive, json, stripeClient } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const db = admin();
  const { data: ok } = await db.rpc('check_worker_secret', { p_secret: req.headers.get('x-worker-secret') ?? '' });
  if (!ok) return json({ error: 'unauthorized' }, 401);
  await db.rpc('expire_requests');
  const stripe = stripeClient();
  if (!stripe) return json({ skipped: 'payments_not_configured' });
  const out = { refunds: 0, transfers: 0, errors: [] as string[] };

  // 1. Reembolsos
  const { data: toRefund } = await db.from('shipments').select('id, payment_intent_id')
    .in('status', ['rechazado', 'caducado', 'cancelado']).not('charge_id', 'is', null).is('refunded_at', null).limit(50);
  for (const s of toRefund ?? []) {
    try {
      await stripe.refunds.create({ payment_intent: s.payment_intent_id! }, { idempotencyKey: `refund-${s.id}` });
      await db.from('shipments').update({ refunded_at: new Date().toISOString() }).eq('id', s.id);
      out.refunds++;
    } catch (e) { out.errors.push(`refund ${s.id}: ${(e as Error).message}`); }
  }

  // 2. Transferencias a carriers
  const { data: toPay } = await db.from('shipments')
    .select('id, charge_id, carrier_amount_cents, trip:trips(carrier_id)')
    .eq('status', 'entregado').not('charge_id', 'is', null).is('transferred_at', null).limit(50);
  for (const s of (toPay ?? []) as any[]) {
    const carrier = s.trip?.carrier_id;
    const { data: priv } = await db.from('profile_private').select('stripe_account_id, stripe_transfers_enabled').eq('id', carrier).single();
    if (!priv?.stripe_account_id) continue; // el carrier aún no ha empezado el alta
    if (!priv.stripe_transfers_enabled) {
      // Las cuentas v2 no envían account.updated: se comprueba aquí si ya terminó el alta
      const active = await carrierTransfersActive(priv.stripe_account_id).catch(() => false);
      if (!active) continue;
      await db.from('profile_private').update({ stripe_transfers_enabled: true }).eq('id', carrier);
    }
    try {
      const tr = await stripe.transfers.create({
        amount: s.carrier_amount_cents, currency: 'eur', destination: priv.stripe_account_id,
        source_transaction: s.charge_id, transfer_group: s.id, metadata: { shipment_id: s.id },
      }, { idempotencyKey: `transfer-${s.id}` });
      await db.from('shipments').update({ transfer_id: tr.id, transferred_at: new Date().toISOString() }).eq('id', s.id);
      out.transfers++;
    } catch (e) { out.errors.push(`transfer ${s.id}: ${(e as Error).message}`); }
  }

  return json(out);
});
