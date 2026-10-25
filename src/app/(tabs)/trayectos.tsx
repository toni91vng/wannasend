import { router } from 'expo-router';
import { useState } from 'react';
import { TripCard } from '@/components/TripCard';
import { Button, EmptyState, ErrorBox, Loading, Muted, Screen, Segmented } from '@/components/ui';
import { useMyShipments, useMyTrips } from '@/data/hooks';
import { isUpcoming, STATUS } from '@/lib/format';
import { errorText } from '@/lib/supabase';

/** Trayectos: mis envíos (como sender) y mis trayectos publicados (como carrier). */
export default function Trayectos() {
  const [tab, setTab] = useState<'Mis envíos' | 'Mis trayectos'>('Mis envíos');
  const ships = useMyShipments();
  const trips = useMyTrips();
  const q = tab === 'Mis envíos' ? ships : trips;

  return (
    <Screen title="Trayectos" back={false} tabs>
      <Segmented options={['Mis envíos', 'Mis trayectos'] as const} value={tab} onChange={setTab} />
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorBox text={errorText(q.error)} onRetry={() => q.refetch()} /> : null}

      {tab === 'Mis envíos' && ships.data ? (
        ships.data.length ? ships.data.map((s) => (
          s.trip ? <TripCard key={s.id} trip={s.trip} status={STATUS[s.status]} showDate onPress={() => router.push(`/envio/${s.id}`)} /> : null
        )) : (
          <EmptyState icon="cube-outline" title="Tus próximos envíos aparecerán aquí" text="Encuentra el carrier perfecto que llevará tu paquete a su destino.">
            <Button label="Buscar carrier" onPress={() => router.navigate('/buscar')} />
          </EmptyState>
        )
      ) : null}

      {tab === 'Mis trayectos' && trips.data ? (
        trips.data.length ? trips.data.map((t) => {
          const status = t.status === 'cancelado' ? { label: 'Cancelado', tone: 'red' as const }
            : t.pending ? { label: `${t.pending} solicitud${t.pending > 1 ? 'es' : ''}`, tone: 'amber' as const }
            : isUpcoming(t.departureAt) ? { label: 'Publicado', tone: 'green' as const } : { label: 'Finalizado', tone: 'gray' as const };
          return <TripCard key={t.id} trip={t} status={status} priceMode="carrier" showDate onPress={() => router.push(`/mi-trayecto/${t.id}`)} />;
        }) : (
          <EmptyState icon="car-outline" title="Aún no has publicado trayectos" text="Publica un desplazamiento que vayas a hacer y comparte gastos llevando paquetes.">
            <Button label="Publicar trayecto" onPress={() => router.navigate('/publicar')} />
          </EmptyState>
        )
      ) : null}
      {tab === 'Mis trayectos' && trips.data?.length ? <Muted style={{ textAlign: 'center' }}>Precio mostrado: tu aportación por paquete.</Muted> : null}
      <Button variant="ghost" small label="Actualizar" icon="refresh" onPress={() => q.refetch()} />
    </Screen>
  );
}
