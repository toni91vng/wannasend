export const CITIES = {
  Lleida: { lat: 41.6176, lng: 0.62 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Tarragona: { lat: 41.1189, lng: 1.2445 },
  Girona: { lat: 41.9794, lng: 2.8214 },
  Zaragoza: { lat: 41.6488, lng: -0.8891 },
  Valencia: { lat: 39.4699, lng: -0.3763 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
} as const;

export type CityName = keyof typeof CITIES;
export const CITY_NAMES = Object.keys(CITIES) as CityName[];

export type PackageSize = 'Sobre' | 'Pequeño' | 'Mediano' | 'Grande';
export const SIZES: PackageSize[] = ['Sobre', 'Pequeño', 'Mediano', 'Grande'];
export const SIZE_HINT: Record<PackageSize, string> = {
  Sobre: 'Documentos, A4',
  Pequeño: 'Hasta 30×20×15 cm',
  Mediano: 'Hasta 50×40×30 cm',
  Grande: 'Hasta 80×60×40 cm',
};
export const CONTENT_TYPES = ['Ropa', 'Documentos', 'Libros', 'Electrónica', 'Regalo', 'Otros'];

export type Level = 'Nuevo' | 'Habitual' | 'Experto';

export interface User {
  id: string;
  name: string;
  bio: string;
  rating: number; // 0 = sin valoraciones
  reviews: number;
  trips: number;
  packages: number;
  verified: boolean;
  level: Level;
}

export interface Review {
  id: string;
  authorId: string;
  aboutId: string;
  role: 'Carrier' | 'Sender';
  stars: number;
  text: string;
  date: string;
}

export interface Trip {
  id: string;
  carrierId: string;
  from: CityName;
  to: CityName;
  fromPoint: string;
  toPoint: string;
  date: string; // ISO yyyy-mm-dd
  departure: string; // HH:MM
  arrival: string; // HH:MM
  capacity: number;
  maxSize: PackageSize;
  maxWeightKg: number;
  pricePerPackage: number; // aportación al carrier
}

export type ShipmentStatus =
  | 'solicitado' // pago retenido, esperando al carrier
  | 'aceptado'
  | 'recogido'
  | 'en_camino'
  | 'entregado'
  | 'rechazado'
  | 'cancelado';

export interface Shipment {
  id: string;
  tripId: string;
  senderId: string;
  size: PackageSize;
  weightKg: number;
  content: string;
  description: string;
  recipientName: string;
  recipientPhone: string;
  deliveryCode: string; // 4 dígitos que recibe el destinatario
  status: ShipmentStatus;
  requestedAt: number;
  pickedUpAt?: string;
  deliveredAt?: string;
  rated?: boolean;
}

export interface Message {
  id: string;
  fromId: string;
  text: string;
  at: number;
}

export interface Conversation {
  id: string;
  userId: string; // la otra persona
  tripId?: string;
  messages: Message[];
  unread: number;
}

export interface Alert {
  id: string;
  from: CityName;
  to: CityName;
  dates: string[];
  push: boolean;
  email: boolean;
}

export interface Movement {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
}
