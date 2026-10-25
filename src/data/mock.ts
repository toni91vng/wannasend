import { Alert, Conversation, Movement, Review, Shipment, Trip, User } from './types';

export const ME = 'me';

/** Fecha ISO a N días de hoy, para que la demo siempre tenga trayectos futuros. */
export function dayFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const users: Record<string, User> = {
  me: { id: 'me', name: 'Sara', bio: 'Hola, me llamo Sara y soy de Lleida. Estudio en Barcelona y vuelvo a casa casi todos los fines de semana.', rating: 4.9, reviews: 8, trips: 3, packages: 5, verified: true, level: 'Habitual' },
  victoria: { id: 'victoria', name: 'Victoria', bio: 'Hola, soy de Lleida y vivo en Barcelona. Voy mucho a ver a mi familia, así que siempre tengo hueco en el coche.', rating: 5, reviews: 12, trips: 4, packages: 7, verified: true, level: 'Experto' },
  mario: { id: 'mario', name: 'Mario', bio: 'Trabajo en Barcelona y los viernes vuelvo a Lleida. Conduzco tranquilo y con maletero amplio.', rating: 4.8, reviews: 21, trips: 18, packages: 30, verified: true, level: 'Experto' },
  juan: { id: 'juan', name: 'Juan', bio: 'Viajo por trabajo entre Barcelona, Valencia y Madrid.', rating: 4.6, reviews: 5, trips: 6, packages: 4, verified: true, level: 'Habitual' },
  laura: { id: 'laura', name: 'Laura', bio: 'Estudiante en Barcelona.', rating: 4.9, reviews: 8, trips: 0, packages: 8, verified: true, level: 'Habitual' },
  pol: { id: 'pol', name: 'Pol', bio: '', rating: 0, reviews: 0, trips: 0, packages: 0, verified: false, level: 'Nuevo' },
  soporte: { id: 'soporte', name: 'Soporte WannaSend', bio: '', rating: 0, reviews: 0, trips: 0, packages: 0, verified: true, level: 'Experto' },
};

export const reviews: Review[] = [
  { id: 'r1', authorId: 'laura', aboutId: 'victoria', role: 'Sender', stars: 5, text: 'Ha sido muy simpática. Repetiría si vuelve a surgir la ocasión.', date: 'ago' },
  { id: 'r2', authorId: 'pol', aboutId: 'victoria', role: 'Sender', stars: 5, text: '¡Todo perfecto! Muy recomendable.', date: 'ago' },
  { id: 'r3', authorId: 'juan', aboutId: 'victoria', role: 'Carrier', stars: 5, text: 'Ha sido todo muy fácil de gestionar y Victoria es muy amable.', date: 'sep' },
  { id: 'r4', authorId: 'victoria', aboutId: 'me', role: 'Sender', stars: 5, text: 'Paquete bien embalado y súper puntual en la recogida.', date: 'oct' },
  { id: 'r5', authorId: 'laura', aboutId: 'mario', role: 'Sender', stars: 5, text: 'Rapidísimo y muy atento por chat.', date: 'sep' },
];

export const trips: Trip[] = [
  { id: 't1', carrierId: 'mario', from: 'Lleida', to: 'Barcelona', fromPoint: 'Estación de autobuses', toPoint: 'Plaza Universitat', date: dayFromToday(2), departure: '17:00', arrival: '18:55', capacity: 3, maxSize: 'Grande', maxWeightKg: 15, pricePerPackage: 6.3 },
  { id: 't2', carrierId: 'victoria', from: 'Lleida', to: 'Barcelona', fromPoint: 'Cappont', toPoint: 'Sagrada Família', date: dayFromToday(2), departure: '20:00', arrival: '21:50', capacity: 3, maxSize: 'Mediano', maxWeightKg: 10, pricePerPackage: 6.3 },
  { id: 't3', carrierId: 'juan', from: 'Lleida', to: 'Barcelona', fromPoint: 'Universitat de Lleida', toPoint: 'Estación de Sants', date: dayFromToday(2), departure: '21:00', arrival: '22:50', capacity: 2, maxSize: 'Pequeño', maxWeightKg: 5, pricePerPackage: 5.9 },
  { id: 't4', carrierId: 'juan', from: 'Barcelona', to: 'Valencia', fromPoint: 'Estación de Sants', toPoint: 'Estación del Norte', date: dayFromToday(4), departure: '08:00', arrival: '11:40', capacity: 2, maxSize: 'Mediano', maxWeightKg: 10, pricePerPackage: 9.8 },
  { id: 't5', carrierId: 'victoria', from: 'Barcelona', to: 'Madrid', fromPoint: 'Plaza Cataluña', toPoint: 'Atocha', date: dayFromToday(6), departure: '08:00', arrival: '14:00', capacity: 2, maxSize: 'Mediano', maxWeightKg: 10, pricePerPackage: 15.6 },
  { id: 't6', carrierId: 'mario', from: 'Barcelona', to: 'Lleida', fromPoint: 'Plaza Universitat', toPoint: 'Estación de autobuses', date: dayFromToday(5), departure: '19:00', arrival: '20:50', capacity: 3, maxSize: 'Grande', maxWeightKg: 15, pricePerPackage: 6.3 },
  // Trayecto publicado por mí (rol carrier)
  { id: 't7', carrierId: 'me', from: 'Barcelona', to: 'Lleida', fromPoint: 'Sagrada Família', toPoint: 'Cappont', date: dayFromToday(3), departure: '19:00', arrival: '20:50', capacity: 3, maxSize: 'Mediano', maxWeightKg: 10, pricePerPackage: 6.3 },
  // Trayecto pasado de Mario, en el que envié un paquete
  { id: 't8', carrierId: 'mario', from: 'Barcelona', to: 'Lleida', fromPoint: 'Plaza Universitat', toPoint: 'Estación de autobuses', date: dayFromToday(-6), departure: '17:00', arrival: '18:55', capacity: 3, maxSize: 'Grande', maxWeightKg: 15, pricePerPackage: 6.3 },
];

const minutesAgo = (m: number) => Date.now() - m * 60_000;

export const shipments: Shipment[] = [
  // Mis envíos (sender)
  { id: 's1', tripId: 't2', senderId: 'me', size: 'Mediano', weightKg: 3, content: 'Ropa', description: 'Ropa y libros', recipientName: 'Marc', recipientPhone: '600 123 456', deliveryCode: '4721', status: 'aceptado', requestedAt: minutesAgo(600) },
  { id: 's2', tripId: 't8', senderId: 'me', size: 'Pequeño', weightKg: 2, content: 'Regalo', description: 'Regalo de cumpleaños', recipientName: 'Ana', recipientPhone: '611 222 333', deliveryCode: '9032', status: 'entregado', requestedAt: minutesAgo(12000), pickedUpAt: '17:05', deliveredAt: '19:02' },
  // Solicitudes que he recibido como carrier en mi trayecto t7
  { id: 's3', tripId: 't7', senderId: 'laura', size: 'Mediano', weightKg: 3, content: 'Ropa', description: 'Ropa y libros · 40×30×20 cm', recipientName: 'Jordi', recipientPhone: '622 444 555', deliveryCode: '1185', status: 'solicitado', requestedAt: minutesAgo(5) },
  { id: 's4', tripId: 't7', senderId: 'pol', size: 'Sobre', weightKg: 0.5, content: 'Documentos', description: 'Documentos A4', recipientName: 'Núria', recipientPhone: '633 666 777', deliveryCode: '5560', status: 'solicitado', requestedAt: minutesAgo(60) },
];

export const conversations: Conversation[] = [
  { id: 'c1', userId: 'victoria', tripId: 't2', unread: 2, messages: [
    { id: 'm1', fromId: 'me', text: 'Hola, soy Sara. He visto que sales del barrio de Cappont. ¿Te iría bien recoger el paquete en la puerta de la uni?', at: minutesAgo(90) },
    { id: 'm2', fromId: 'victoria', text: '¡Hola Sara! Sí, puedo acercarme allí.', at: minutesAgo(80) },
    { id: 'm3', fromId: 'me', text: 'Genial, quedamos delante de la puerta principal. ¿A las 19:45?', at: minutesAgo(70) },
    { id: 'm4', fromId: 'victoria', text: '¡Allí estaré, Sara! Tu paquete estará en buenas manos conmigo.', at: minutesAgo(20) },
  ] },
  { id: 'c2', userId: 'mario', tripId: 't8', unread: 0, messages: [
    { id: 'm5', fromId: 'mario', text: 'Perfecto, te escribo cuando salga.', at: minutesAgo(9000) },
  ] },
  { id: 'c3', userId: 'soporte', unread: 0, messages: [
    { id: 'm6', fromId: 'soporte', text: '¡Bienvenida a WannaSend! Si tienes cualquier duda, escríbenos por aquí.', at: minutesAgo(20000) },
  ] },
];

export const alerts: Alert[] = [];

export const movements: Movement[] = [
  { id: 'mv1', title: 'Paquete de Laura', subtitle: 'Lleida → Barcelona', amount: 6.3 },
  { id: 'mv2', title: 'Paquete de Ramon', subtitle: 'Barcelona → Lleida', amount: 6.3 },
  { id: 'mv3', title: 'Paquete de Joan', subtitle: 'Barcelona → Lleida', amount: 6.3 },
  { id: 'mv4', title: 'Paquete de Marta', subtitle: 'Lleida → Barcelona', amount: 6.3 },
  { id: 'mv5', title: 'Retirada a cuenta', subtitle: 'ES•• 4417', amount: -6.3 },
];
