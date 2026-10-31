// Pagos de la app (requiere sesión).
//  - create_intent: crea el PaymentIntent de un envío en 'pendiente_pago' y devuelve el client secret para PaymentSheet.
//  - onboarding:    crea (si hace falta) la cuenta Connect del carrier y devuelve el enlace de alta en Stripe.
//  - dashboard:     enlace al panel Express del carrier (ver cobros y transferencias).
//  - status:        si el carrier ya puede recibir transferencias.
//  - identity:        crea una verificación de identidad con Stripe Identity (DNI + selfie) y devuelve su enlace.
//  - identity_status: consulta el resultado y lo guarda (también llega por el webhook).
import {
  admin, callerId, carrierOnboardingLink, carrierTransfersActive, CORS, createCarrierAccount, fillTestOnboarding, json, stripeClient,
  stripeTestMode, syncIdentity, verifiedPrefill,
} from '../_shared/common.ts';

/**
 * Métodos de pago: Stripe ya no deja fijarlos con payment_method_types; se eligen con una
 * "configuración de métodos de pago". La de modo prueba ("App WannaSend", creada el 30/10/2026) tiene
 * tarjeta, Google Pay, Apple Pay y PayPal. En modo real hay que crear otra igual y ponerla en el secreto
 * STRIPE_PAYMENT_METHOD_CONFIG (no es un dato secreto: solo identifica la configuración).
 */
const PMC = Deno.env.get('STRIPE_PAYMENT_METHOD_CONFIG') ?? 'pmc_1UWIVSDIBv4hBX6p1wNrmNlk';

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
    if (body.action === 'identity' || body.action === 'identity_status') {
      const { data: priv } = await db.from('profile_private').select('identity_status, identity_session_id').eq('id', uid).single();
      if (priv?.identity_status === 'verificado') return json({ status: 'verificado' });
      if (body.action === 'identity_status') {
        if (!priv?.identity_session_id) return json({ status: priv?.identity_status ?? 'sin_verificar' });
        return json(await syncIdentity(stripe, uid, priv.identity_session_id));
      }
      // Máximo 5 intentos al día para no generar costes por abuso
      const { count } = await db.from('identity_attempts').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).gt('created_at', new Date(Date.now() - 86400_000).toISOString());
      if ((count ?? 0) >= 5) return json({ error: 'too_many', message: 'Has hecho demasiados intentos hoy. Inténtalo mañana.' }, 429);
      const vs = await stripe.identity.verificationSessions.create({
        type: 'document',
        options: { document: { require_matching_selfie: true, allowed_types: ['id_card', 'passport', 'driving_license'] } },
        metadata: { user_id: uid },
        return_url: `${RETURN_URL}?to=verificacion`,
      });
      await db.from('identity_attempts').insert({ user_id: uid, session_id: vs.id });
      await db.from('profile_private').update({ identity_status: 'pendiente', identity_session_id: vs.id }).eq('id', uid);
      return json({ url: vs.url });
    }

    if (body.action === 'create_intent') {
      const { data: s } = await db.from('shipments').select('id, sender_id, status, total_cents, payment_intent_id').eq('id', body.shipmentId ?? '').maybeSingle();
      if (!s || s.sender_id !== uid) return json({ error: 'not_found' }, 404);
      if (s.status !== 'pendiente_pago') return json({ error: 'not_payable' }, 409);

      if (s.payment_intent_id) {
        const existing = await stripe.paymentIntents.retrieve(s.payment_intent_id);
        if (existing.status !== 'canceled' && existing.status !== 'succeeded') {
          // Si cambió la configuración de métodos, se anula el pago pendiente y se crea otro con la nueva
          const samePmc = (existing.payment_method_configuration_details?.id ?? undefined) === PMC;
          if (!PMC || samePmc) return json({ clientSecret: existing.client_secret });
          await stripe.paymentIntents.cancel(existing.id);
        }
      }
      const pi = await stripe.paymentIntents.create({
        amount: s.total_cents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        ...(PMC ? { payment_method_configuration: PMC } : {}),
        transfer_group: s.id,
        description: 'Envío WannaSend',
        metadata: { shipment_id: s.id, sender_id: uid },
      }, { idempotencyKey: `pi3-${s.id}-${s.payment_intent_id ?? 'new'}-${PMC ?? 'panel'}` });
      await db.from('shipments').update({ payment_intent_id: pi.id }).eq('id', s.id);
      return json({ clientSecret: pi.client_secret });
    }

    if (body.action === 'onboarding' || body.action === 'dashboard' || body.action === 'status') {
      const { data: priv } = await db.from('profile_private').select('stripe_account_id, identity_status, identity_session_id').eq('id', uid).single();
      let accountId = priv?.stripe_account_id as string | null;

      if (!accountId) {
        if (body.action !== 'onboarding') return json({ ready: false, hasAccount: false });
        const { data: user } = await db.auth.admin.getUserById(uid);
        const prefill = !stripeTestMode() && priv?.identity_status === 'verificado' && priv.identity_session_id
          ? await verifiedPrefill(stripe, priv.identity_session_id) : undefined;
        const acct = await createCarrierAccount(uid, user.user?.email ?? undefined, prefill);
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
      // Modo prueba: se rellena todo con datos de prueba; el tester solo acepta las condiciones de Stripe
      if (!ready && stripeTestMode()) {
        const { data: prof } = await db.from('profiles').select('name').eq('id', uid).single();
        await fillTestOnboarding(accountId, prof?.name ?? '');
      }
      return json({ url: await carrierOnboardingLink(accountId, RETURN_URL), ready });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('payments error', e);
    return json({ error: 'stripe_error', message: (e as Error).message }, 502);
  }
});
