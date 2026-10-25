import { router } from 'expo-router';
import { useState } from 'react';
import { TripCard } from '@/components/TripCard';
import { Button, EmptyState, Muted, Screen, Segmented } from '@/components/ui';
import { ME, useDerived, useStore } from '@/data/store';
import { isUpcoming, STATUS } from '@/lib/format';

/** Trayectos: mis envíos (como sender) y mis trayectos publicados (como carrier). */
export default function Trayectos() {
  const { shipments, trips } = useStore();
  const { trip, user } = useDerived();
  const [tab, setTab] = useState<'Mis envíos' | 'Mis trayectos'>('Mis envíos');

  const mine = shipments
    .filter((s) => s.senderId === ME && s.status !== 'cancelado')
    .sort((a, b) => (trip(b.tripId)!.date + b.status).localeCompare(trip(a.tripId)!.date + a.status));
  const myTrips = trips.filter((t) => t.carrierId === ME).sort((a, b) => b.date.localeCompare(a.date));
  const pendingFor = (tripId: string) => shipments.filter((s) => s.tripId === tripId && s.status === 'solicitado').length;

  return (
    <Screen title="Trayectos" back={false} tabs>
      <Segmented options={['Mis envíos', 'Mis trayectos'] as const} value={tab} onChange={setTab} />

      {tab === 'Mis envíos' ? (
        mine.length ? mine.map((s) => {
          const t = trip(s.tripId)!;
          return <TripCard key={s.id} trip={t} carrier={user(t.carrierId)} status={STATUS[s.status]} showDate onPress={() => router.push(`/envio/${s.id}`)} />;
        }) : (
          <EmptyState icon="cube-outline" title="Tus próximos envíos aparecerán aquí" text="Encuentra el carrier perfecto que llevará tu paquete a su destino.">
            <Button label="Buscar carrier" onPress={() => router.navigate('/buscar')} />
          </EmptyState>
        )
      ) : (
        myTrips.length ? myTrips.map((t) => {
          const pending = pendingFor(t.id);
          const status = pending ? { label: `${pending} solicitud${pending > 1 ? 'es' : ''}`, tone: 'amber' as const }
            : isUpcoming(t.date) ? { label: 'Publicado', tone: 'green' as const } : { label: 'Finalizado', tone: 'gray' as const };
          return <TripCard key={t.id} trip={t} status={status} priceMode="carrier" showDate onPress={() => router.push(`/mi-trayecto/${t.id}`)} />;
        }) : (
          <EmptyState icon="car-outline" title="Aún no has publicado trayectos" text="Publica un desplazamiento que vayas a hacer y comparte gastos llevando paquetes.">
            <Button label="Publicar trayecto" onPress={() => router.navigate('/publicar')} />
          </EmptyState>
        )
      )}
      {tab === 'Mis trayectos' && myTrips.length ? <Muted style={{ textAlign: 'center' }}>Precio mostrado: tu aportación por paquete.</Muted> : null}
    </Screen>
  );
}
