// Webhook de Stripe (sin JWT; se valida la firma con STRIPE_WEBHOOK_SECRET).
import Stripe from 'npm:stripe@17.7.0';
import { admin, json, stripeClient, syncIdentity } from '../_shared/common.ts';

const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const stripe = stripeClient();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripe || !secret) return json({ error: 'not_configured' }, 503);

  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig ?? '', secret, undefined, crypto);
  } catch {
    return json({ error: 'bad_signature' }, 400);
  }

  const db = admin();
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const shipmentId = pi.metadata?.shipment_id;
      if (shipmentId) {
        const charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
        const { data } = await db.from('shipments')
          .update({ status: 'solicitado', charge_id: charge, paid_at: new Date().toISOString(), payment_intent_id: pi.id })
          .eq('id', shipmentId).eq('status', 'pendiente_pago').select('id');
        // Pagado tras cancelarse (p. ej. caducó el intento): se marca para reembolsar
        if (!data?.length) {
          await db.from('shipments').update({ charge_id: charge, paid_at: new Date().toISOString() })
            .eq('id', shipmentId).is('charge_id', null);
        }
      }
      break;
    }
    case 'identity.verification_session.verified':
    case 'identity.verification_session.requires_input':
    case 'identity.verification_session.processing':
    case 'identity.verification_session.canceled': {
      const vs = event.data.object as Stripe.Identity.VerificationSession;
      const uid = vs.metadata?.user_id;
      if (uid) await syncIdentity(stripe, uid, vs.id).catch((e) => console.error('identity sync', e));
      break;
    }
    case 'account.updated': {
      const acct = event.data.object as Stripe.Account;
      await db.from('profile_private')
        .update({ stripe_transfers_enabled: acct.capabilities?.transfers === 'active' })
        .eq('stripe_account_id', acct.id);
      break;
    }
  }
  return json({ received: true });
});
