import { decode } from 'base64-arraybuffer';
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import {
  Alert, AppConfig, ConversationSummary, DbSize, fromDbSize, Message, Movement, PackageSize, Place, Review, Shipment,
  ShipmentStatus, toDbSize, Trip, TripStatus, User, VALUE_TIERS, ValueTier, Verification,
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

const TRIP_COLS = 'id, carrier_id, from_label, from_city, to_label, to_city, departure_at, arrival_at, capacity, max_size, max_weight_kg, price_cents, status, distance_km, distance_source, earnings_cap_cents, started_at, require_verified_sender';

type TripRow = {
  id: string; carrier_id: string; from_label: string; from_city: string; to_label: string; to_city: string;
  departure_at: string; arrival_at: string; capacity?: number; booked?: number; seats_left?: number;
  max_size: DbSize; max_weight_kg: number; price_cents: number; total_cents?: number; status?: TripStatus;
  carrier_name?: string; carrier_rating?: number; carrier_reviews?: number; carrier_verified?: boolean;
  distance_km?: number; distance_source?: 'carretera' | 'estimada'; earnings_cap_cents?: number | null;
  cap_remaining_cents?: number | null; started_at?: string | null; require_verified_sender?: boolean;
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
    carrierVerified: r.carrier_verified,
    distanceKm: r.distance_km,
    distanceSource: r.distance_source,
    earningsCap: r.earnings_cap_cents === undefined ? undefined : r.earnings_cap_cents === null ? null : euros(r.earnings_cap_cents),
    capRemaining: r.cap_remaining_cents === undefined ? undefined : r.cap_remaining_cents === null ? null : euros(r.cap_remaining_cents),
    startedAt: r.started_at,
    requireVerifiedSender: r.require_verified_sender,
  };
}

type ShipmentRow = {
  id: string; trip_id: string; sender_id: string; size: DbSize; weight_kg: number; content: string; description: string;
  recipient_name: string; status: ShipmentStatus; requested_at: string; picked_up_at: string | null; delivered_at: string | null;
  carrier_amount_cents: number; total_cents: number;
  paid_at?: string | null; refunded_at?: string | null; transferred_at?: string | null;
  photo_path?: string; pickup_photo_path?: string | null;
  value?: { tier: ValueTier; exact_cents: number | null } | null; // solo lo recibe el sender (RLS)
  rejection_stage?: 'solicitud' | 'recogida' | null; rejection_reason?: string | null;
  trip?: TripRow | null; sender?: { name: string; verified?: boolean } | null;
};

function toShipment(r: ShipmentRow): Shipment {
  return {
    id: r.id,
    tripId: r.trip_id,
    senderId: r.sender_id,
    senderName: r.sender?.name,
    senderVerified: r.sender?.verified,
    size: fromDbSize(r.size),
    weightKg: Number(r.weight_kg),
    content: r.content,
    description: r.description,
    recipientName: r.recipient_name,
    status: r.status,
    requestedAt: new Date(r.requested_at).getTime(),
    pickedUpAt: hhmm(r.picked_up_at),
    deliveredAt: hhmm(r.delivered_at),
    carrierAmount: euros(r.carrier_amount_cents),
    total: euros(r.total_cents),
    paid: !!r.paid_at,
    refunded: !!r.refunded_at,
    transferred: !!r.transferred_at,
    valueLabel: r.value ? (r.value.exact_cents ? `${euros(r.value.exact_cents).toFixed(2).replace('.', ',')} €` : VALUE_TIERS.find((v) => v.id === r.value!.tier)?.label) : undefined,
    photoPath: r.photo_path,
    pickupPhotoPath: r.pickup_photo_path,
    rejectionStage: r.rejection_stage,
    rejectionReason: r.rejection_reason,
    trip: r.trip ? toTrip(r.trip) : undefined,
  };
}

const SHIPMENT_COLS = 'id, trip_id, sender_id, size, weight_kg, content, description, recipient_name, status, requested_at, picked_up_at, delivered_at, carrier_amount_cents, total_cents, paid_at, refunded_at, transferred_at, photo_path, pickup_photo_path, rejection_stage, rejection_reason';

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
  const rows = check(await supabase.rpc('get_profile_v2', { p_user: id })) as any[];
  const p = rows?.[0];
  if (!p) return null;
  return {
    id: p.id, name: p.name, bio: p.bio, verified: p.verified,
    rating: Number(p.rating), reviews: p.reviews_count, trips: p.trips_done,
    packages: p.packages_sent, carried: p.packages_carried, level: p.level,
    asCarrier: { rating: Number(p.rating_as_carrier ?? 0), reviews: p.reviews_as_carrier ?? 0 },
    asSender: { rating: Number(p.rating_as_sender ?? 0), reviews: p.reviews_as_sender ?? 0 },
  };
}
export async function updateProfile(id: string, patch: { name?: string; bio?: string }) {
  check(await supabase.from('profiles').update(patch).eq('id', id));
}
export async function getReviews(aboutId: string): Promise<Review[]> {
  const rows = check(await supabase.from('reviews')
    .select('id, role, stars, text, created_at, author:profiles!reviews_author_id_fkey(name)')
    .eq('about_id', aboutId).order('created_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({
    id: r.id, authorName: r.author?.name ?? 'Usuario', role: r.role === 'sender' ? 'Sender' : 'Carrier', /* papel de quien escribe */ stars: r.stars, text: r.text,
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
  })) as (TripRow & { from_km?: number; to_km?: number })[];
  return rows.map((r) => ({ ...toTrip(r), fromKm: r.from_km != null ? Number(r.from_km) : undefined, toKm: r.to_km != null ? Number(r.to_km) : undefined }));
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
/* ---------- Trayectos habituales ---------- */
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const; // ISO: 1 = lunes … 7 = domingo
export interface Routine {
  id: string; weekdays: number[]; departure: string; from: string; to: string; pricePerPackage: number; active: boolean;
}
export async function makeTripRoutine(tripId: string, weekdays: number[]) {
  return check(await supabase.rpc('make_trip_routine', { p_trip: tripId, p_weekdays: weekdays })) as string;
}
export async function myRoutines(): Promise<Routine[]> {
  const rows = check(await supabase.from('trip_routines').select('id, weekdays, departure_time, from_city, to_city, price_cents, active')
    .order('created_at')) as any[];
  return rows.map((r) => ({ id: r.id, weekdays: r.weekdays, departure: String(r.departure_time).slice(0, 5), from: r.from_city, to: r.to_city,
    pricePerPackage: r.price_cents / 100, active: r.active }));
}
export async function setRoutine(id: string, action: 'pausar' | 'reanudar' | 'borrar') {
  check(await supabase.rpc('set_trip_routine', { p_routine: id, p_action: action }));
}

/** Distancia por carretera calculada en el servidor (Google). Si no está disponible, devuelve la estimación. */
export async function routeDistance(from: Place, to: Place): Promise<{ km: number; source: 'carretera' | 'estimada' } | null> {
  const { data, error } = await supabase.functions.invoke('places', {
    body: { action: 'route', from: { lat: from.lat, lng: from.lng }, to: { lat: to.lat, lng: to.lng } },
  });
  if (error || !data?.km) return null;
  return { km: data.km, source: data.source };
}
export async function startTrip(id: string) {
  return check(await supabase.rpc('start_trip', { p_trip: id })) as number;
}
export async function cancelTrip(id: string) {
  check(await supabase.from('trips').update({ status: 'cancelado' }).eq('id', id));
}

export async function myTrips(userId: string): Promise<(Trip & { pending: number; statuses: ShipmentStatus[] })[]> {
  const rows = check(await supabase.from('trips').select(`${TRIP_COLS}, shipments(status)`)
    .eq('carrier_id', userId).order('departure_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({
    ...toTrip({ ...r, booked: r.shipments.filter((s: any) => ['aceptado', 'recogido', 'en_camino', 'entregado'].includes(s.status)).length }),
    pending: r.shipments.filter((s: any) => s.status === 'solicitado').length,
    statuses: r.shipments.map((s: any) => s.status),
  }));
}

/* ------------------------------------------------------------------ */
/* Envíos                                                              */
/* ------------------------------------------------------------------ */

export interface NewPackage {
  size: PackageSize; weightKg: number; content: string; description: string; recipientName: string;
  valueTier: ValueTier; // tramo de valor: solo lo ven el sender y WannaSend
  photoPath: string;
  noProhibited: boolean;
}

export async function requestShipment(tripId: string, p: NewPackage): Promise<string> {
  return check(await supabase.rpc('request_shipment_v2', {
    p_trip: tripId, p_size: toDbSize(p.size), p_weight: p.weightKg, p_content: p.content,
    p_description: p.description, p_recipient_name: p.recipientName,
    p_value_tier: p.valueTier, p_photo_path: p.photoPath, p_no_prohibited: p.noProhibited,
  })) as string;
}

/* ------------------------------------------------------------------ */
/* Fotos de paquetes (privadas)                                        */
/* ------------------------------------------------------------------ */

/**
 * Reduce la foto (1280 px, JPEG) y la sube a la carpeta del usuario. Al volver a codificarla se pierden los
 * metadatos EXIF, incluida la ubicación GPS. Devuelve la ruta para guardarla en el envío.
 */
export async function uploadPackagePhoto(uri: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Inicia sesión');
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync();
  const img = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const path = `${user.id}/${rand}.jpg`;
  const { error } = await supabase.storage.from('package-photos').upload(path, decode(img.base64!), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

/** Enlace temporal (1 h) para ver una foto. Solo funciona para el sender y el carrier del envío. */
export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('package-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function myShipments(userId: string): Promise<Shipment[]> {
  const rows = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, trip:trips(${TRIP_COLS}, carrier:profiles!trips_carrier_id_fkey(name))`)
    .eq('sender_id', userId).order('requested_at', { ascending: false }).limit(50)) as any[];
  return rows.map((r) => ({ ...toShipment(r), trip: r.trip ? { ...toTrip(r.trip), carrierName: r.trip.carrier?.name } : undefined }));
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const r = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, trip:trips(${TRIP_COLS}), sender:profiles!shipments_sender_id_fkey(name, verified), value:shipment_values(tier, exact_cents)`)
    .eq('id', id).maybeSingle()) as unknown as ShipmentRow | null;
  return r ? toShipment(r) : null;
}

export async function tripShipments(tripId: string): Promise<Shipment[]> {
  const rows = check(await supabase.from('shipments')
    .select(`${SHIPMENT_COLS}, sender:profiles!shipments_sender_id_fkey(name, verified)`)
    .eq('trip_id', tripId).order('requested_at')) as unknown as ShipmentRow[];
  return rows.map(toShipment);
}

export const respondShipment = async (id: string, accept: boolean) => { check(await supabase.rpc('respond_shipment', { p_shipment: id, p_accept: accept })); };
export const cancelShipment = async (id: string) => { check(await supabase.rpc('cancel_shipment', { p_shipment: id })); };
/** Revisión en la recogida: coincide (foto) o no coincide (foto + motivo → rechazo y reembolso). */
/** Recogida con el código del sender. 'incorrecto' y 'bloqueado' no cambian el estado. */
export const pickupShipment = async (id: string, ok: boolean, photoPath: string, code?: string, reason?: string) =>
  check(await supabase.rpc('pickup_shipment_v2', { p_shipment: id, p_ok: ok, p_photo_path: photoPath, p_code: code ?? null, p_reason: reason ?? null })) as
    'recogido' | 'en_camino' | 'rechazado' | 'incorrecto' | 'bloqueado';
export const getPickupCode = async (id: string) => check(await supabase.rpc('get_pickup_code', { p_shipment: id })) as string | null;
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

export async function getAppConfig(): Promise<AppConfig> {
  const r = check(await supabase.from('app_config').select(
    'payments_enabled, trip_cap_cents_per_km, max_declared_value_cents, identity_value_threshold_cents, prohibited_list_version, carrier_verification_required, sender_verification_enabled, beta_feedback_enabled',
  ).maybeSingle()) as any;
  return {
    betaFeedback: r?.beta_feedback_enabled ?? false,
    paymentsEnabled: !!r?.payments_enabled,
    capPerKm: (r?.trip_cap_cents_per_km ?? 26) / 100,
    maxDeclaredValue: (r?.max_declared_value_cents ?? 30000) / 100,
    identityValueThreshold: (r?.identity_value_threshold_cents ?? 10000) / 100,
    prohibitedListVersion: r?.prohibited_list_version ?? '',
    carrierVerificationRequired: !!r?.carrier_verification_required,
    senderVerificationEnabled: !!r?.sender_verification_enabled,
  };
}
export async function paymentsEnabled(): Promise<boolean> {
  return (await getAppConfig()).paymentsEnabled;
}

export async function myVerification(): Promise<Verification> {
  const r = (check(await supabase.rpc('my_verification')) as any[])[0];
  return { identityStatus: r?.identity_status ?? 'sin_verificar', payoutsReady: !!r?.payouts_ready, verified: !!r?.verified };
}

/* ------------------------------------------------------------------ */
/* Opiniones de la beta                                                */
/* ------------------------------------------------------------------ */

export type FeedbackContext = 'publicar' | 'enviar' | 'buscar' | 'abandonar_envio' | 'general';

/** Momentos en los que ya se le preguntó (respondiera o no). */
export async function askedFeedback(): Promise<FeedbackContext[]> {
  const rows = check(await supabase.from('beta_feedback').select('context')) as { context: FeedbackContext }[];
  return rows.map((r) => r.context);
}
export async function sendFeedback(context: FeedbackContext, rating: number | null, comment: string, appVersion?: string) {
  check(await supabase.from('beta_feedback').insert({ context, rating, comment: comment.trim() || null, app_version: appVersion ?? null }));
}
