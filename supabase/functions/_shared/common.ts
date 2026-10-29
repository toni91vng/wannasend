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

/** Cuenta de carrier: solo recibe transferencias; la plataforma asume comisiones y pérdidas. */
export function createCarrierAccount(uid: string, email?: string) {
  return stripeV2<{ id: string }>('POST', '/v2/core/accounts', {
    contact_email: email,
    display_name: email,
    dashboard: 'express',
    identity: { country: 'es', entity_type: 'individual' },
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    defaults: { currency: 'eur', locales: ['es-ES'], responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
    include: ['configuration.recipient', 'requirements'],
    metadata: { user_id: uid },
  }, `acct-v2-${uid}`);
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
      account_onboarding: { configurations: ['recipient'], return_url: returnUrl, refresh_url: returnUrl, collection_options: { fields: 'currently_due' } },
    },
  });
  return l.url;
}
