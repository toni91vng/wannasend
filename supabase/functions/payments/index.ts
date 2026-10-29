// Pagos de la app (requiere sesión).
//  - create_intent: crea el PaymentIntent de un envío en 'pendiente_pago' y devuelve el client secret para PaymentSheet.
//  - onboarding:    crea (si hace falta) la cuenta Connect del carrier y devuelve el enlace de alta en Stripe.
//  - dashboard:     enlace al panel Express del carrier (ver cobros y transferencias).
//  - status:        si el carrier ya puede recibir transferencias.
import { admin, callerId, carrierOnboardingLink, carrierTransfersActive, CORS, createCarrierAccount, json, stripeClient } from '../_shared/common.ts';

const RETURN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-return`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const stripe = stripeClient();
  if (!stripe) return json({ error: 'payments_not_configured' }, 503);
  const db = admin();

  let body: { action?: string; shipmentId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  try {
    if (body.action === 'create_intent') {
      const { data: s } = await db.from('shipments').select('id, sender_id, status, total_cents, payment_intent_id').eq('id', body.shipmentId ?? '').maybeSingle();
      if (!s || s.sender_id !== uid) return json({ error: 'not_found' }, 404);
      if (s.status !== 'pendiente_pago') return json({ error: 'not_payable' }, 409);

      if (s.payment_intent_id) {
        const existing = await stripe.paymentIntents.retrieve(s.payment_intent_id);
        if (existing.status !== 'canceled' && existing.status !== 'succeeded') return json({ clientSecret: existing.client_secret });
      }
      const pi = await stripe.paymentIntents.create({
        amount: s.total_cents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        transfer_group: s.id,
        description: 'Envío WannaSend',
        metadata: { shipment_id: s.id, sender_id: uid },
      }, { idempotencyKey: `pi-${s.id}-${s.payment_intent_id ?? 'new'}` });
      await db.from('shipments').update({ payment_intent_id: pi.id }).eq('id', s.id);
      return json({ clientSecret: pi.client_secret });
    }

    if (body.action === 'onboarding' || body.action === 'dashboard' || body.action === 'status') {
      const { data: priv } = await db.from('profile_private').select('stripe_account_id').eq('id', uid).single();
      let accountId = priv?.stripe_account_id as string | null;

      if (!accountId) {
        if (body.action !== 'onboarding') return json({ ready: false, hasAccount: false });
        const { data: user } = await db.auth.admin.getUserById(uid);
        const acct = await createCarrierAccount(uid, user.user?.email ?? undefined);
        accountId = acct.id;
        await db.from('profile_private').update({ stripe_account_id: accountId }).eq('id', uid);
      }

      const ready = await carrierTransfersActive(accountId);
      await db.from('profile_private').update({ stripe_transfers_enabled: ready }).eq('id', uid);

      if (body.action === 'status') return json({ ready, hasAccount: true });
      if (body.action === 'dashboard' && ready) {
        const link = await stripe.accounts.createLoginLink(accountId);
        return json({ url: link.url, ready });
      }
      return json({ url: await carrierOnboardingLink(accountId, RETURN_URL), ready });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('payments error', e);
    return json({ error: 'stripe_error', message: (e as Error).message }, 502);
  }
});
