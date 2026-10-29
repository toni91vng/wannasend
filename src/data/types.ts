export type PackageSize = 'Sobre' | 'Pequeño' | 'Mediano' | 'Grande';
export const SIZES: PackageSize[] = ['Sobre', 'Pequeño', 'Mediano', 'Grande'];
export const SIZE_HINT: Record<PackageSize, string> = {
  Sobre: 'Documentos, A4',
  Pequeño: 'Hasta 30×20×15 cm',
  Mediano: 'Hasta 50×40×30 cm',
  Grande: 'Hasta 80×60×40 cm',
};
export type DbSize = 'sobre' | 'pequeno' | 'mediano' | 'grande';
export const toDbSize = (s: PackageSize): DbSize => (s === 'Pequeño' ? 'pequeno' : (s.toLowerCase() as DbSize));
export const fromDbSize = (s: DbSize): PackageSize => (s === 'pequeno' ? 'Pequeño' : ((s[0].toUpperCase() + s.slice(1)) as PackageSize));

export const CONTENT_TYPES = ['Ropa', 'Documentos', 'Libros', 'Electrónica', 'Regalo', 'Comida', 'Objetos personales', 'Otros'];

export type Level = 'Nuevo' | 'Habitual' | 'Experto';

/** Lugar elegido en el buscador de direcciones. */
export interface Place {
  label: string;
  city: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  bio: string;
  rating: number; // 0 = sin valoraciones
  reviews: number;
  trips: number;
  packages: number;
  carried: number;
  verified: boolean;
  level: Level;
}

export interface Review {
  id: string;
  authorName: string;
  role: 'Carrier' | 'Sender';
  stars: number;
  text: string;
  date: string;
}

export type TripStatus = 'publicado' | 'cancelado' | 'finalizado';

export interface Trip {
  id: string;
  carrierId: string;
  from: string; // ciudad
  to: string;
  fromPoint: string; // dirección
  toPoint: string;
  departureAt: string; // ISO
  date: string; // yyyy-mm-dd en hora local
  departure: string; // HH:MM
  arrival: string; // HH:MM
  capacity: number;
  booked: number;
  maxSize: PackageSize;
  maxWeightKg: number;
  pricePerPackage: number; // aportación al carrier (€)
  total: number; // lo que paga el sender (€)
  status: TripStatus;
  carrierName?: string;
  carrierRating?: number;
  carrierReviews?: number;
  carrierVerified?: boolean;
  distanceKm?: number;
  distanceSource?: 'carretera' | 'estimada';
  earningsCap?: number | null; // tope de gastos compartidos (€); null = sin tope
  capRemaining?: number | null; // lo que queda del tope (€)
  startedAt?: string | null; // "Empiezo el trayecto"
  requireVerifiedSender?: boolean;
}

export type ShipmentStatus =
  | 'pendiente_pago'
  | 'solicitado'
  | 'aceptado'
  | 'recogido'
  | 'en_camino'
  | 'entregado'
  | 'rechazado'
  | 'cancelado'
  | 'caducado';

export interface Shipment {
  id: string;
  tripId: string;
  senderId: string;
  senderName?: string;
  senderVerified?: boolean;
  size: PackageSize;
  weightKg: number;
  content: string;
  description: string;
  recipientName: string;
  recipientPhone?: string; // solo visible para el carrier tras aceptar
  status: ShipmentStatus;
  requestedAt: number;
  pickedUpAt?: string; // HH:MM
  deliveredAt?: string; // HH:MM
  carrierAmount: number;
  total: number;
  paid: boolean;
  refunded: boolean;
  transferred: boolean;
  declaredValue: number; // €
  photoPath?: string;
  pickupPhotoPath?: string | null;
  rejectionStage?: 'solicitud' | 'recogida' | null;
  rejectionReason?: string | null;
  trip?: Trip;
}

export interface AppConfig {
  paymentsEnabled: boolean;
  capPerKm: number; // €/km
  maxDeclaredValue: number; // €
  identityValueThreshold: number; // €
  prohibitedListVersion: string;
  carrierVerificationRequired: boolean;
  senderVerificationEnabled: boolean;
}

export interface Verification {
  identityStatus: 'sin_verificar' | 'pendiente' | 'verificado' | 'fallido';
  payoutsReady: boolean;
  verified: boolean;
}

export interface ConversationSummary {
  id: string;
  otherId: string;
  otherName: string;
  tripLabel: string | null;
  lastBody: string | null;
  lastAt: number;
  lastMine: boolean;
  unread: number;
}

export interface Message {
  id: number;
  senderId: string;
  body: string;
  at: number;
  readAt: string | null;
}

export interface Alert {
  id: string;
  fromLabel: string;
  toLabel: string;
  dates: string[];
  push: boolean;
  email: boolean;
}

export interface Movement {
  id: string;
  kind: 'ganancia' | 'retirada';
  description: string;
  amount: number;
  at: string;
}
