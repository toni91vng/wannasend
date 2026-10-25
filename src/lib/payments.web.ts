// En la versión web (demo) no hay pagos: el SDK de Stripe para móvil no funciona en navegador.
export async function payShipment(_shipmentId: string): Promise<'paid' | 'canceled'> {
  throw new Error('Los pagos solo están disponibles en la app del móvil.');
}
export const paymentsSupported = false;
export async function payoutStatus() {
  return { ready: false, hasAccount: false };
}
export async function openPayouts(_kind: 'onboarding' | 'dashboard') {
  throw new Error('Configura tus cobros desde la app del móvil.');
}
