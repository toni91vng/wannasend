import { PackageSize, Place } from '@/data/types';

/**
 * Misma fórmula que el servidor (public.suggested_price_cents). El servidor tiene la última palabra:
 * si el precio queda fuera de rango, rechaza el trayecto.
 */
const SIZE_EXTRA_CENTS: Record<PackageSize, number> = { Sobre: 0, Pequeño: 50, Mediano: 110, Grande: 220 };

/** Distancia aproximada por carretera (línea recta × 1,2). */
export function distanceKm(a: Place, b: Place): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.max(1, Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.2));
}

const round10 = (cents: number) => Math.round(cents / 10) * 10;

/** Aportación sugerida para el carrier, en céntimos. */
export function suggestedCents(km: number, size: PackageSize): number {
  return round10(200 + km * 2 + SIZE_EXTRA_CENTS[size]);
}

/** Rango permitido (±30 %, mínimo 3 €). Se estrecha 10 céntimos por si la distancia del servidor difiere un poco. */
export function rangeCents(suggested: number): { min: number; max: number } {
  return { min: Math.max(300, round10(suggested * 0.7)) + 10, max: round10(suggested * 1.3) - 10 };
}

/** Desglose de lo que paga el sender a partir de la aportación del carrier (en euros). */
export function breakdown(carrierEuros: number) {
  const total = round10((carrierEuros * 100) / 0.7) / 100;
  return { carrier: carrierEuros, fees: Math.round((total - carrierEuros) * 100) / 100, total };
}

export const euros = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
