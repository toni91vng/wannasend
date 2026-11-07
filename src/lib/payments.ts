import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payments', { body });
  if (error) {
    let detail: { error?: string; message?: string } = {};
    try { detail = await (error as { context?: Response }).context?.json(); } catch { /* sin cuerpo */ }
    if (detail.error === 'payments_not_configured') throw new Error('Los pagos aún no están activados.');
    throw new Error(detail.message ?? 'No se ha podido conectar con el sistema de pagos.');
  }
  return data as T;
}

/**
 * Cobro al aceptar (07/11/2026): el sender guarda su método de pago con el formulario oficial de Stripe.
 * No se cobra ni se bloquea nada; se cobra solo cuando el carrier acepta. La app nunca ve la tarjeta.
 */
export async function saveCardForShipment(shipmentId: string): Promise<'saved' | 'canceled'> {
  const { setupIntentClientSecret } = await invoke<{ setupIntentClientSecret: string }>({ action: 'setup', shipmentId });
  const init = await initPaymentSheet({
    merchantDisplayName: 'WannaSend',
    setupIntentClientSecret,
    googlePay: { merchantCountryCode: 'ES', currencyCode: 'EUR', testEnv: true },
    defaultBillingDetails: { address: { country: 'ES' } },
    returnURL: 'wannasend://stripe-redirect',
    appearance: { colors: { primary: '#5DB075' } },
    primaryButtonLabel: 'Guardar y enviar solicitud',
  });
  if (init.error) throw new Error(init.error.message);
  const res = await presentPaymentSheet();
  if (res.error) {
    if (res.error.code === 'Canceled') return 'canceled';
    throw new Error(res.error.message);
  }
  await confirmSetup(shipmentId).catch(() => undefined); // si falla, lo completa el servidor en unos minutos
  return 'saved';
}

/** Comprueba que el método quedó guardado y envía la solicitud al carrier. */
export async function confirmSetup(shipmentId: string): Promise<string> {
  const r = await invoke<{ status: string }>({ action: 'confirm_setup', shipmentId });
  return r.status;
}

/** Pagar ahora: solo si el cobro automático al aceptar necesitó confirmación del banco o falló. */
export async function payShipment(shipmentId: string): Promise<'paid' | 'canceled'> {
  const { clientSecret } = await invoke<{ clientSecret: string }>({ action: 'create_intent', shipmentId });
  const init = await initPaymentSheet({
    merchantDisplayName: 'WannaSend',
    paymentIntentClientSecret: clientSecret,
    googlePay: { merchantCountryCode: 'ES', currencyCode: 'EUR', testEnv: true },
    defaultBillingDetails: { address: { country: 'ES' } },
    returnURL: 'wannasend://stripe-redirect',
    appearance: { colors: { primary: '#5DB075' } },
  });
  if (init.error) throw new Error(init.error.message);
  const res = await presentPaymentSheet();
  if (res.error) {
    if (res.error.code === 'Canceled') return 'canceled';
    throw new Error(res.error.message);
  }
  return 'paid';
}

export const paymentsSupported = true;

export async function payoutStatus() {
  return invoke<{ ready: boolean; hasAccount: boolean }>({ action: 'status' });
}

/** Alta o panel de cobros del carrier en Stripe (se abre en el navegador y vuelve a la app). */
export async function openPayouts(kind: 'onboarding' | 'dashboard') {
  const { url } = await invoke<{ url: string }>({ action: kind });
  await WebBrowser.openAuthSessionAsync(url, 'wannasend://ganancias');
}

export type IdentityStatus = 'sin_verificar' | 'pendiente' | 'verificado' | 'fallido';

/**
 * Verificación de identidad con Stripe Identity (DNI o pasaporte + selfie). Se hace en la web de Stripe:
 * WannaSend nunca ve el documento, solo recibe el resultado.
 */
export async function verifyIdentity(): Promise<IdentityStatus> {
  const r = await invoke<{ url?: string; status?: IdentityStatus }>({ action: 'identity' });
  if (r.status === 'verificado') return 'verificado';
  if (r.url) await WebBrowser.openAuthSessionAsync(r.url, 'wannasend://verificar');
  return identityStatus();
}

export async function identityStatus(): Promise<IdentityStatus> {
  const r = await invoke<{ status: IdentityStatus }>({ action: 'identity_status' });
  return r.status;
}
