import { supabase } from '@/lib/supabase';
import {
  Alert, ConversationSummary, DbSize, fromDbSize, Message, Movement, PackageSize, Place, Review, Shipment,
  ShipmentStatus, toDbSize, Trip, TripStatus, User,
} from './types';

/* ------------------------------------------------------------------ */
/* Conversión de filas de la base de datos a tipos de la app           */
/* ------------------------------------------------------------------ */

const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined);
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const euros = (cents: number) => Math.round(cents) / 100;

const TRIP_COLS = 'id, carrier_id, from_label, from_city, to_label, to_city, departure_at, arrival_at, capacity, max_size, max_weight_kg, price_cents, status';

type TripRow = {
  id: string; carrier_id: string; from_label: string; from_city: string; to_label: string; to_city: string;
  departure_at: string; arrival_at: string; capacity?: number; booked?: number; seats_left?: number;
  max_size: DbSize; max_weight_kg: number; price_cents: number; total_cents?: number; status?: TripStatus;
  carrier_name?: string; carrier_rating?: number; carrier_reviews?: number;
};

export function toTrip(r: TripRow): Trip {
  const capacity = r.capacity ?? (r.seats_left ?? 0);
  return {
    id: r.id,
    carrierId: r.carrier_id,
    from: r.from_city,
    to: r.to_city,
    fromPoint: r.from_label,
    toPoint: r.to_label,
    departureAt: r.departure_at,
    date: localDate(r.departure_at),
    departure: hhmm(r.departure_at)!,
    arrival: hhmm(r.arrival_at)!,
    capacity,
    booked: r.booked ?? (r.seats_left !== undefined && r.capacity !== undefined ? r.capacity - r.seats_left : 0),
    maxSize: fromDbSize(r.max_size),
    maxWeightKg: Number(r.max_weight_kg),
    pricePerPackage: euros(r.price_cents),
    total: euros(r.total_cents ?? Math.round(r.price_cents / 0.7 / 10) * 10),
    status: r.status ?? 'publicado',
    carrierName: r.carrier_name,
    carrierRating: r.carrier_rating !== undefined ? Number(r.carrier_rating) : undefined,
    carrierReviews: r.carrier_reviews,
  };
}

type ShipmentRow = {
  id: string; trip_id: string; sender_id: string; size: DbSize; weight_kg: number; content: string; description: string;
  recipient_name: string; status: ShipmentStatus; requested_at: string; picked_up_at: string | null; delivered_at: string | null;
  carrier_amount_cents: number; total_cents: number;
  paid_at?: string | null; refunded_at?: string | null; transferred_at?: string | null;
  trip?: TripRow | null; sender?: { name: string } | null; contact?: { recipient_phone: string } | null;
};

function toShipment(r: ShipmentRow): Shipment {
  return {
    id: r.id,
    tripId: r.trip_id,
    senderId: r.sender_id,
    senderName: r.sender?.name,
    size: fromDbSize(r.size),
    weightKg: Number(r.weight_kg),
    content: r.content,
    description: r.description,
    recipientName: r.recipient_name,
    recipientPhone: r.contact?.recipient_phone,
    status: r.status,
    requestedAt: new Date(r.requested_at).getTime(),
    pickedUpAt: hhmm(r.picked_up_at),
    deliveredAt: hhmm(r.delivered_at),
    carrierAmount: euros(r.carrier_amount_cents),
    total: euros(r.total_cents),
    paid: !!r.paid_at,
    refunded: !!r.refunded_at,
    transferred: !!r.transferred_at,
    trip: r.trip ? toTrip(r.trip) : undefined,
  };
}

const SHIPMENT_COLS = 'id, trip_id, sender_id, size, weight_kg, content, description, recipient_name, status, requested_at, picked_up_at, delivered_at, carrier_amount_cents, total_cents, paid_at, refunded_at, transferred_at';

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/* ------------------------------------------------------------------ */
/* Cuenta                                                              */
/* ------------------------------------------------------------------ */

export async function signUp(name: string, email: string, password: string, marketing: boolean) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, marketing_opt_in: marketing } } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await supabase.auth.signOut();
}
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function getProfile(id: string): Promise<User | null> {
  const rows = check(await supabase.rpc('get_profile', { p_user: id })) as any[];
  const p = rows?.[0];
  if (!p) return null;
  return {
    id: p.id, name: p.name, bio: p.bio, verified: p.verified,
    rating: Number(p.rating), reviews: p.reviews_count, trips: p.trips_done,
    packages: p.packages_sent, carried: p.packages_carried, level: p.level,
  };
}
export async function updateProfile(id: string, patch: { name?: string; bio?: string }) {
  check(await supabase.from('profiles').update(patch).eq('id', id));
}
export async function getMyPhone(id: string): Promise<string | null> {
  const r = check(await supabase.from('profile_private').select('phone').eq('id', id).maybeSingle()) as { phone: string | null } | null;
  return r?.phone ?? null;
}
export async function setMyPhone(id: string, phone: string) {
  check(await supabase.from('profile_private').update({ phone, updated_at: new Date().toISOString() }).eq('id', id));
}

export async function getReviews(aboutId: string): Promise<Review[]> {
  const rows = check(await supabase.from('reviews')
    .select('id, role, stars, text, created_at, author:profiles!reviews_author_id_fkey(name)')
    .eq('about_id', aboutId).order('created_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({
    id: r.id, authorName: r.author?.name ?? 'Usuario', role: r.role === 'sender' ? 'Sender' : 'Carrier', stars: r.stars, text: r.text,
    date: new Date(r.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
  }));
}

/* ------------------------------------------------------------------ */
/* Direcciones (Google Places mediante la función del servidor)        */
/* ------------------------------------------------------------------ */

export class PlacesUnavailable extends Error {}

export async function placesAutocomplete(input: string, sessionToken: string) {
  const { data, error } = await supabase.functions.invoke('places', { body: { action: 'autocomplete', input, sessionToken } });
  if (error || data?.error) throw new PlacesUnavailable(data?.error ?? 'error');
  return data.suggestions as { placeId: string; main: string; secondary: string }[];
}
export async function placeDetails(placeId: string, sessionToken: string): Promise<Place> {
  const { data, error } = await supabase.functions.invoke('places', { body: { action: 'details', placeId, sessionToken } });
  if (error || data?.error) throw new PlacesUnavailable(data?.error ?? 'error');
  return data as Place;
}

/* ------------------------------------------------------------------ */
/* Trayectos                                                           */
/* ------------------------------------------------------------------ */

export async function searchTrips(from: Place, to: Place, day: string, radiusKm = 20): Promise<Trip[]> {
  const rows = check(await supabase.rpc('search_trips', {
    p_from_lat: from.lat, p_from_lng: from.lng, p_to_lat: to.lat, p_to_lng: to.lng, p_day: day, p_radius_km: radiusKm,
  })) as TripRow[];
  return rows.map(toTrip);
}
export async function nearbyDays(from: Place, to: Place): Promise<{ day: string; trips: number }[]> {
  return check(await supabase.rpc('nearby_trip_days', { p_from_lat: from.lat, p_from_lng: from.lng, p_to_lat: to.lat, p_to_lng: to.lng })) as any[];
}
export async function getTrip(id: string): Promise<Trip | null> {
  const rows = check(await supabase.rpc('trip_detail', { p_trip: id })) as TripRow[];
  return rows[0] ? toTrip(rows[0]) : null;
}

export async function publishTrip(t: {
  from: Place; to: Place; departureAt: Date; arrivalAt: Date; capacity: number; maxSize: PackageSize; maxWeightKg: number; priceCents: number;
}): Promise<string> {
  const point = (p: Place) => `SRID=4326;POINT(${p.lng} ${p.lat})`;
  const { data: { user } } = await supabase.auth.getUser();
  const row = check(await supabase.from('trips').insert({
    carrier_id: user!.id,
    from_label: t.from.label, from_city: t.from.city || t.from.label, from_point: point(t.from),
    to_label: t.to.label, to_city: t.to.city || t.to.label, to_point: point(t.to),
    departure_at: t.departureAt.toISOString(), arrival_at: t.arrivalAt.toISOString(),
    capacity: t.capacity, max_size: toDbSize(t.maxSize), max_weight_kg: t.maxWeightKg, price_cents: t.priceCents,
  }).select('id').single()) as { id: string };
  return row.id;
}
export async function cancelTrip(id: string) {
  check(await supabase.from('trips').update({ status: 'cancelado' }).eq('id', id));
}

export async function myTrips(userId: string): Promise<(Trip & { pending: number })[]> {
  const rows = check(await supabase.from('trips').select(`${TRIP_COLS}, shipments(status)`)
    .eq('carrier_id', userId).order('departure_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({
    ...toTrip({ ...r, booked: r.shipments.filter((s: any) => ['aceptado', 'en_camino', 'entregado'].includes(s.status)).length }),
    pending: r.shipments.filter((s: any) => s.status === 'solicitado').length,
  }));
}

/* ------------------------------------------------------------------ */
/* Envíos                                                              */
/* ------------------------------------------------------------------ */

export interface NewPackage {
  size: PackageSize; weightKg: number; content: string; description: string; recipientName: string; recipientPhone: string;
}

export async function requestShipment(tripId: string, p: NewPackage): Promise<string> {
  return check(await supabase.rpc('request_shipment', {
    p_trip: tripId, p_size: toDbSize(p.size), p_weight: p.weightKg, p_content: p.content,
    p_description: p.description, p_recipient_name: p.recipientName, p_recipient_phone: p.recipientPhone,
  })) as string;
}

export async function myShipments(userId: string): Promise<Shipment[]> {
  const rows = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, trip:trips(${TRIP_COLS}, carrier:profiles!trips_carrier_id_fkey(name))`)
    .eq('sender_id', userId).order('requested_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({ ...toShipment(r), trip: r.trip ? { ...toTrip(r.trip), carrierName: r.trip.carrier?.name } : undefined }));
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const r = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, trip:trips(${TRIP_COLS}), sender:profiles!shipments_sender_id_fkey(name), contact:shipment_contacts(recipient_phone)`)
    .eq('id', id).maybeSingle()) as unknown as ShipmentRow | null;
  return r ? toShipment(r) : null;
}

export async function tripShipments(tripId: string): Promise<Shipment[]> {
  const rows = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, sender:profiles!shipments_sender_id_fkey(name), contact:shipment_contacts(recipient_phone)`)
    .eq('trip_id', tripId).order('requested_at')) as unknown as ShipmentRow[];
  return rows.map(toShipment);
}

export const respondShipment = async (id: string, accept: boolean) => { check(await supabase.rpc('respond_shipment', { p_shipment: id, p_accept: accept })); };
export const cancelShipment = async (id: string) => { check(await supabase.rpc('cancel_shipment', { p_shipment: id })); };
export const markPickedUp = async (id: string) => { check(await supabase.rpc('mark_picked_up', { p_shipment: id })); };
export const confirmDelivery = async (id: string, code: string) =>
  check(await supabase.rpc('confirm_delivery', { p_shipment: id, p_code: code })) as 'ok' | 'incorrecto' | 'bloqueado';
export const getDeliveryCode = async (id: string) => check(await supabase.rpc('get_delivery_code', { p_shipment: id })) as string | null;

export async function hasReviewed(shipmentId: string, userId: string) {
  const r = check(await supabase.from('reviews').select('id').eq('shipment_id', shipmentId).eq('author_id', userId).maybeSingle());
  return !!r;
}
export const submitReview = async (shipmentId: string, stars: number, text: string) => {
  check(await supabase.rpc('submit_review', { p_shipment: shipmentId, p_stars: stars, p_text: text }));
};

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const openConversation = async (otherId: string, tripId?: string) =>
  check(await supabase.rpc('open_conversation', { p_other: otherId, p_trip: tripId ?? null })) as string;

export async function myConversations(): Promise<ConversationSummary[]> {
  const rows = check(await supabase.rpc('my_conversations')) as any[];
  return rows.map((r) => ({
    id: r.id, otherId: r.other_id, otherName: r.other_name, tripLabel: r.trip_label, lastBody: r.last_body,
    lastAt: new Date(r.last_at).getTime(), lastMine: !!r.last_mine, unread: r.unread,
  }));
}

export async function getConversation(id: string) {
  return check(await supabase.from('conversations').select('id, user_a, user_b, trip_id').eq('id', id).maybeSingle()) as
    { id: string; user_a: string; user_b: string; trip_id: string | null } | null;
}

export async function getMessages(convId: string): Promise<Message[]> {
  const rows = check(await supabase.from('messages').select('id, sender_id, body, created_at, read_at')
    .eq('conversation_id', convId).order('created_at').limit(500)) as any[];
  return rows.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, at: new Date(m.created_at).getTime(), readAt: m.read_at }));
}
export async function sendMessage(convId: string, senderId: string, body: string) {
  check(await supabase.from('messages').insert({ conversation_id: convId, sender_id: senderId, body }));
}
export async function markRead(convId: string, myId: string) {
  check(await supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', convId).neq('sender_id', myId).is('read_at', null));
}

/* ------------------------------------------------------------------ */
/* Ganancias, alertas y reportes                                       */
/* ------------------------------------------------------------------ */

export async function myBalance() {
  const r = (check(await supabase.rpc('my_balance')) as any[])[0] ?? { available_cents: 0, pending_cents: 0 };
  return { available: euros(r.available_cents), pending: euros(r.pending_cents) };
}
export async function myMovements(): Promise<Movement[]> {
  const rows = check(await supabase.from('movements').select('id, kind, description, amount_cents, created_at')
    .order('created_at', { ascending: false }).limit(100)) as any[];
  return rows.map((m) => ({ id: m.id, kind: m.kind, description: m.description, amount: euros(m.amount_cents), at: m.created_at }));
}
export const requestWithdrawal = async () => euros(check(await supabase.rpc('request_withdrawal')) as number);

export async function myAlerts(): Promise<Alert[]> {
  const rows = check(await supabase.from('alerts').select('id, from_label, to_label, dates, push, email').order('created_at', { ascending: false })) as any[];
  return rows.map((a) => ({ id: a.id, fromLabel: a.from_label, toLabel: a.to_label, dates: a.dates, push: a.push, email: a.email }));
}
export async function addAlert(userId: string, a: { from: Place; to: Place; dates: string[]; push: boolean; email: boolean }) {
  const point = (p: Place) => `SRID=4326;POINT(${p.lng} ${p.lat})`;
  check(await supabase.from('alerts').insert({
    user_id: userId, from_label: a.from.label, from_point: point(a.from), to_label: a.to.label, to_point: point(a.to),
    dates: a.dates, push: a.push, email: a.email,
  }));
}
export async function deleteAlert(id: string) {
  check(await supabase.from('alerts').delete().eq('id', id));
}

export async function report(r: { reportedUserId?: string; shipmentId?: string; reason: string; details?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  check(await supabase.from('reports').insert({
    reporter_id: user!.id, reported_user_id: r.reportedUserId ?? null, shipment_id: r.shipmentId ?? null,
    reason: r.reason, details: r.details ?? '',
  }));
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

export async function paymentsEnabled(): Promise<boolean> {
  const r = check(await supabase.from('app_config').select('payments_enabled').maybeSingle()) as { payments_enabled: boolean } | null;
  return !!r?.payments_enabled;
}
