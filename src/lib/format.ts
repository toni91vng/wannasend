import { ShipmentStatus, Trip } from '@/data/types';

export function longDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function duration(t: Pick<Trip, 'departure' | 'arrival'>): string {
  const [h1, m1] = t.departure.split(':').map(Number);
  const [h2, m2] = t.arrival.split(':').map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
}

export function timeAgo(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toTimeString().slice(0, 5) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export const STATUS: Record<ShipmentStatus, { label: string; tone: 'green' | 'amber' | 'gray' | 'red' }> = {
  solicitado: { label: 'Pendiente', tone: 'amber' },
  aceptado: { label: 'Aceptado', tone: 'green' },
  recogido: { label: 'Recogido', tone: 'green' },
  en_camino: { label: 'En camino', tone: 'green' },
  entregado: { label: 'Entregado', tone: 'gray' },
  rechazado: { label: 'Rechazado', tone: 'red' },
  cancelado: { label: 'Cancelado', tone: 'red' },
};

/** ¿Es un trayecto futuro (o de hoy)? */
export const isUpcoming = (iso: string) => iso >= new Date().toISOString().slice(0, 10);
