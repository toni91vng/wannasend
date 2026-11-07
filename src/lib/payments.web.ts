import { supabase } from './supabase';

/**
 * Versión web (02/11/2026): el SDK de Stripe para móvil no funciona en el navegador, así que se usan las
 * páginas de Stripe (pago, alta de cobros e identidad) y se vuelve a la web al terminar.
 * La página sale de la app al ir a Stripe; al volver, la app se carga de nuevo en la pantalla indicada.
 */
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payments', { body: { ...body, origin: window.location.origin } });
  if (error) {
    let detail: { error?: string; message?: string } = {};
    try { detail = await (error as { context?: Response }).context?.json(); } catch { /* sin cuerpo */ }
    if (detail.error === 'payments_not_configured') throw new Error('Los pagos aún no están activados.');
    if (detail.error === 'bad_origin') throw new Error('Esta dirección web no está autorizada para pagos.');
    throw new Error(detail.message ?? 'No se ha podido conectar con el sistema de pagos.');
  }
  return data as T;
}

/** Página de Stripe para guardar el método de pago (no se cobra nada). Al terminar vuelve a la pantalla del envío. */
export async function saveCardForShipment(shipmentId: string): Promise<'saved' | 'canceled'> {
  const { url } = await invoke<{ url: string }>({ action: 'checkout', shipmentId });
  window.location.assign(url);
  // La página se va a Stripe; esta promesa no llega a resolverse
  return new Promise(() => undefined);
}

/** Comprueba que el método quedó guardado y envía la solicitud al carrier. */
export async function confirmSetup(shipmentId: string): Promise<string> {
  const r = await invoke<{ status: string }>({ action: 'confirm_setup', shipmentId });
  return r.status;
}

/** Pagar ahora (si el cobro automático al aceptar necesitó confirmación). Mismo flujo: página de Stripe. */
export async function payShipment(shipmentId: string): Promise<'paid' | 'canceled'> {
  const { url } = await invoke<{ url: string }>({ action: 'checkout', shipmentId });
  window.location.assign(url);
  return new Promise(() => undefined);
}

export const paymentsSupported = true;

export async function payoutStatus() {
  return invoke<{ ready: boolean; hasAccount: boolean }>({ action: 'status' });
}

/** Alta o panel de cobros del carrier en Stripe (misma pestaña; vuelve a Ganancias). */
export async function openPayouts(kind: 'onboarding' | 'dashboard') {
  const { url } = await invoke<{ url: string }>({ action: kind });
  if (kind === 'dashboard') window.open(url, '_blank', 'noopener');
  else window.location.assign(url);
}

export type IdentityStatus = 'sin_verificar' | 'pendiente' | 'verificado' | 'fallido';

/** Verificación de identidad en la web de Stripe (misma pestaña; vuelve a Verificar identidad). */
export async function verifyIdentity(): Promise<IdentityStatus> {
  const r = await invoke<{ url?: string; status?: IdentityStatus }>({ action: 'identity' });
  if (r.status === 'verificado') return 'verificado';
  if (r.url) {
    window.location.assign(r.url);
    return new Promise(() => undefined);
  }
  return identityStatus();
}

export async function identityStatus(): Promise<IdentityStatus> {
  const r = await invoke<{ status: IdentityStatus }>({ action: 'identity_status' });
  return r.status;
}
