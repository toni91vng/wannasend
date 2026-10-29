import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export function stripeClient(): Stripe | null {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return null;
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  return keys.default;
}

/** Cliente con permisos de servidor (ignora RLS). Usar solo tras comprobar quién llama. */
export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });

/** Usuario que llama, a partir de su JWT. */
export async function callerId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user?.id ?? null;
}

/**
 * Llamadas a la API v2 de Stripe (cuentas conectadas). Stripe ya no deja crear cuentas con la API v1.
 * La v2 usa JSON y exige la cabecera Stripe-Version.
 */
export const STRIPE_V2_VERSION = Deno.env.get('STRIPE_V2_VERSION') ?? '2026-01-28.clover';

export async function stripeV2<T = any>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('payments_not_configured');
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_V2_VERSION };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe ${res.status}`);
  return data as T;
}

type Prefill = { given_name?: string; surname?: string; date_of_birth?: { day: number; month: number; year: number };
  address?: { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } };

/**
 * Cuenta de carrier: solo recibe transferencias; la plataforma asume comisiones y pérdidas.
 * Si el usuario ya verificó su identidad con Stripe Identity, se rellenan sus datos para que solo tenga que confirmarlos.
 */
export async function createCarrierAccount(uid: string, email?: string, prefill?: Prefill) {
  if (prefill) {
    try { return await createCarrierAccountRaw(uid, email, prefill); } catch (e) { console.error('prefill rechazado', e); }
  }
  return createCarrierAccountRaw(uid, email);
}

function createCarrierAccountRaw(uid: string, email?: string, prefill?: Prefill) {
  return stripeV2<{ id: string }>('POST', '/v2/core/accounts', {
    contact_email: email,
    display_name: email,
    dashboard: 'express',
    identity: { country: 'es', entity_type: 'individual', ...(prefill ? { individual: prefill } : {}) },
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    defaults: { currency: 'eur', locales: ['es-ES'], responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
    include: ['configuration.recipient', 'requirements'],
    metadata: { user_id: uid },
  }, `acct-v2-${uid}${prefill ? '-p' : ''}`);
}

/** ¿Puede el carrier recibir transferencias ya? */
export async function carrierTransfersActive(accountId: string): Promise<boolean> {
  const a = await stripeV2<any>('GET', `/v2/core/accounts/${accountId}?include[0]=configuration.recipient`);
  return a?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';
}

/** Enlace de un solo uso al formulario de alta de Stripe. */
export async function carrierOnboardingLink(accountId: string, returnUrl: string): Promise<string> {
  const l = await stripeV2<{ url: string }>('POST', '/v2/core/account_links', {
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      // eventually_due: pide ya todos los datos, incluidos los fiscales (NIF, dirección) que exige DAC7
      account_onboarding: { configurations: ['recipient'], return_url: returnUrl, refresh_url: returnUrl, collection_options: { fields: 'eventually_due' } },
    },
  });
  return l.url;
}

/* ------------------------------------------------------------------ */
/* Verificación de identidad (Stripe Identity)                         */
/* ------------------------------------------------------------------ */

const IDENTITY_MAP: Record<string, 'pendiente' | 'verificado' | 'fallido' | 'sin_verificar'> = {
  verified: 'verificado', processing: 'pendiente', requires_input: 'fallido', canceled: 'sin_verificar',
};

/** Guarda en la base de datos el estado de la sesión de verificación de un usuario. */
export async function syncIdentity(stripe: Stripe, uid: string, sessionId: string) {
  const vs = await stripe.identity.verificationSessions.retrieve(sessionId);
  if (vs.metadata?.user_id !== uid) throw new Error('session_mismatch');
  // requires_input sin error = el usuario aún no ha empezado: sigue pendiente
  const status = vs.status === 'requires_input' && !vs.last_error ? 'pendiente' : (IDENTITY_MAP[vs.status] ?? 'pendiente');
  await admin().from('profile_private').update({
    identity_status: status,
    identity_verified_at: status === 'verificado' ? new Date().toISOString() : null,
  }).eq('id', uid).eq('identity_session_id', sessionId);
  return { status, error: vs.last_error?.code ?? null };
}

/** Datos verificados (nombre, fecha de nacimiento, dirección) para rellenar el alta de cobros. */
export async function verifiedPrefill(stripe: Stripe, sessionId: string): Promise<Prefill | undefined> {
  try {
    const vs = await stripe.identity.verificationSessions.retrieve(sessionId, { expand: ['verified_outputs'] });
    const o = vs.verified_outputs;
    if (vs.status !== 'verified' || !o) return undefined;
    const p: Prefill = {};
    if (o.first_name) p.given_name = o.first_name;
    if (o.last_name) p.surname = o.last_name;
    if (o.dob?.day && o.dob.month && o.dob.year) p.date_of_birth = { day: o.dob.day, month: o.dob.month, year: o.dob.year };
    if (o.address?.line1) {
      p.address = { line1: o.address.line1, line2: o.address.line2 ?? undefined, city: o.address.city ?? undefined,
        postal_code: o.address.postal_code ?? undefined, country: (o.address.country ?? 'ES').toLowerCase() };
    }
    return Object.keys(p).length ? p : undefined;
  } catch {
    return undefined;
  }
}
