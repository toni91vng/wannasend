import { CITIES, CityName, PackageSize } from '@/data/types';

/** Comisión de la plataforma sobre el total que paga el sender (gestión + IVA). */
export const PLATFORM_SHARE = 0.3;

const SIZE_EXTRA: Record<PackageSize, number> = { Sobre: 0, Pequeño: 0.5, Mediano: 1.1, Grande: 2.2 };

/** Distancia aproximada por carretera (línea recta × 1,2). */
export function distanceKm(from: CityName, to: CityName): number {
  const a = CITIES[from];
  const b = CITIES[to];
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.2);
}

const round10 = (n: number) => Math.round(n * 10) / 10;

/** Aportación sugerida para el carrier por paquete. */
export function suggestedCarrierPrice(from: CityName, to: CityName, size: PackageSize): number {
  return round10(2 + distanceKm(from, to) * 0.02 + SIZE_EXTRA[size]);
}

/** Rango permitido al carrier: ±30 % del precio sugerido, mínimo 3 €. */
export function priceRange(suggested: number): { min: number; max: number } {
  return { min: Math.max(3, round10(suggested * 0.7)), max: round10(suggested * 1.3) };
}

/** Desglose de lo que paga el sender a partir de la aportación del carrier. */
export function breakdown(carrierPrice: number) {
  const total = round10(carrierPrice / (1 - PLATFORM_SHARE));
  return { carrier: carrierPrice, fees: round10(total - carrierPrice), total };
}

export const euros = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
