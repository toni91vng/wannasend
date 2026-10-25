import React, { createContext, useContext, useMemo, useState } from 'react';
import * as mock from './mock';
import { Alert, Conversation, Movement, PackageSize, Review, Shipment, Trip, User } from './types';

/**
 * Estado de la app en memoria con datos simulados.
 * Cuando conectemos Supabase, cada acción pasará a llamar a la API,
 * pero las pantallas seguirán usando el mismo hook `useStore()`.
 */

interface State {
  authed: boolean;
  users: Record<string, User>;
  trips: Trip[];
  shipments: Shipment[];
  conversations: Conversation[];
  reviews: Review[];
  alerts: Alert[];
  movements: Movement[];
}

export interface NewPackage {
  size: PackageSize;
  weightKg: number;
  content: string;
  description: string;
  recipientName: string;
  recipientPhone: string;
}

const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const code4 = () => String(Math.floor(1000 + Math.random() * 9000));

function useAppState() {
  const [s, set] = useState<State>({
    authed: false,
    users: mock.users,
    trips: mock.trips,
    shipments: mock.shipments,
    conversations: mock.conversations,
    reviews: mock.reviews,
    alerts: mock.alerts,
    movements: mock.movements,
  });

  const patchShipment = (id: string, patch: Partial<Shipment>) =>
    set((p) => ({ ...p, shipments: p.shipments.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const actions = {
    login(name?: string) {
      set((p) => ({
        ...p,
        authed: true,
        users: name ? { ...p.users, me: { ...p.users.me, name } } : p.users,
      }));
    },
    logout() {
      set((p) => ({ ...p, authed: false }));
    },
    updateMe(patch: Partial<User>) {
      set((p) => ({ ...p, users: { ...p.users, me: { ...p.users.me, ...patch } } }));
    },
    publishTrip(t: Omit<Trip, 'id' | 'carrierId'>): string {
      const id = uid('t');
      set((p) => ({ ...p, trips: [...p.trips, { ...t, id, carrierId: mock.ME }] }));
      return id;
    },
    requestShipment(tripId: string, pkg: NewPackage): string {
      const id = uid('s');
      const sh: Shipment = { ...pkg, id, tripId, senderId: mock.ME, deliveryCode: code4(), status: 'solicitado', requestedAt: Date.now() };
      set((p) => ({ ...p, shipments: [...p.shipments, sh] }));
      return id;
    },
    cancelShipment(id: string) {
      patchShipment(id, { status: 'cancelado' });
    },
    respond(id: string, accept: boolean) {
      patchShipment(id, { status: accept ? 'aceptado' : 'rechazado' });
    },
    /** Demo: avanza un envío al siguiente estado (en la app real lo hacen el carrier y el destinatario). */
    advance(id: string) {
      set((p) => {
        const sh = p.shipments.find((x) => x.id === id);
        if (!sh) return p;
        const now = new Date().toTimeString().slice(0, 5);
        const next: Partial<Shipment> =
          sh.status === 'solicitado' ? { status: 'aceptado' }
          : sh.status === 'aceptado' ? { status: 'recogido', pickedUpAt: now }
          : sh.status === 'recogido' ? { status: 'en_camino' }
          : sh.status === 'en_camino' ? { status: 'entregado', deliveredAt: now }
          : {};
        return { ...p, shipments: p.shipments.map((x) => (x.id === id ? { ...x, ...next } : x)) };
      });
    },
    markPickedUp(id: string) {
      patchShipment(id, { status: 'en_camino', pickedUpAt: new Date().toTimeString().slice(0, 5) });
    },
    /** El carrier introduce el código del destinatario. Devuelve si era correcto. */
    confirmDelivery(id: string, code: string): boolean {
      const current = s.shipments.find((x) => x.id === id);
      if (!current || current.deliveryCode !== code) return false;
      set((p) => {
        const sh = p.shipments.find((x) => x.id === id);
        if (!sh || sh.status === 'entregado') return p;
        const trip = p.trips.find((t) => t.id === sh.tripId)!;
        const sender = p.users[sh.senderId];
        const movement: Movement = { id: uid('mv'), title: `Paquete de ${sender.name}`, subtitle: `${trip.from} → ${trip.to}`, amount: trip.pricePerPackage };
        return {
          ...p,
          shipments: p.shipments.map((x) => (x.id === id ? { ...x, status: 'entregado', deliveredAt: new Date().toTimeString().slice(0, 5) } : x)),
          movements: trip.carrierId === mock.ME ? [movement, ...p.movements] : p.movements,
        };
      });
      return true;
    },
    rate(shipmentId: string, aboutId: string, stars: number, text: string) {
      set((p) => ({
        ...p,
        shipments: p.shipments.map((x) => (x.id === shipmentId ? { ...x, rated: true } : x)),
        reviews: [{ id: uid('r'), authorId: mock.ME, aboutId, role: 'Sender', stars, text, date: 'hoy' }, ...p.reviews],
      }));
    },
    openConversation(userId: string, tripId?: string): string {
      const existing = s.conversations.find((c) => c.userId === userId);
      if (existing) return existing.id;
      const id = uid('c');
      set((p) => ({ ...p, conversations: [{ id, userId, tripId, messages: [], unread: 0 }, ...p.conversations] }));
      return id;
    },
    sendMessage(convId: string, text: string) {
      set((p) => ({
        ...p,
        conversations: p.conversations.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, { id: uid('m'), fromId: mock.ME, text, at: Date.now() }] } : c,
        ),
      }));
    },
    receiveMessage(convId: string, fromId: string, text: string) {
      set((p) => ({
        ...p,
        conversations: p.conversations.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, { id: uid('m'), fromId, text, at: Date.now() }] } : c,
        ),
      }));
    },
    markRead(convId: string) {
      set((p) => ({ ...p, conversations: p.conversations.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)) }));
    },
    addAlert(a: Omit<Alert, 'id'>) {
      set((p) => ({ ...p, alerts: [...p.alerts, { ...a, id: uid('a') }] }));
    },
    withdraw(amount: number) {
      set((p) => ({ ...p, movements: [{ id: uid('mv'), title: 'Retirada a cuenta', subtitle: 'ES•• 4417', amount: -amount }, ...p.movements] }));
    },
  };

  return { ...s, ...actions };
}

type Store = ReturnType<typeof useAppState>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useAppState();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de StoreProvider');
  return s;
}

/** Helpers derivados */
export function useDerived() {
  const s = useStore();
  return useMemo(() => {
    const trip = (id: string) => s.trips.find((t) => t.id === id);
    const user = (id: string) => s.users[id];
    const booked = (tripId: string) =>
      s.shipments.filter((x) => x.tripId === tripId && ['aceptado', 'recogido', 'en_camino', 'entregado'].includes(x.status)).length;
    const balance = s.movements.reduce((a, m) => a + m.amount, 0);
    const pending = s.shipments
      .filter((x) => ['aceptado', 'recogido', 'en_camino'].includes(x.status) && trip(x.tripId)?.carrierId === mock.ME)
      .reduce((a, x) => a + (trip(x.tripId)?.pricePerPackage ?? 0), 0);
    return { trip, user, booked, balance, pending };
  }, [s]);
}

export { ME } from './mock';
