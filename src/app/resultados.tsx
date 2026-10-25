import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { TripCard } from '@/components/TripCard';
import { Button, Chips, EmptyState, H2, Muted, Screen } from '@/components/ui';
import { ME, useDerived, useStore } from '@/data/store';
import { CityName } from '@/data/types';
import { longDate, shortDate } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

export default function Resultados() {
  const { from, to, date } = useLocalSearchParams<{ from: CityName; to: CityName; date: string }>();
  const { trips } = useStore();
  const { user, booked } = useDerived();

  const sameRoute = trips.filter((t) => t.from === from && t.to === to && t.carrierId !== ME && booked(t.id) < t.capacity);
  const list = sameRoute.filter((t) => t.date === date).sort((a, b) => a.departure.localeCompare(b.departure));
  const today = new Date().toISOString().slice(0, 10);
  const nearby = [...new Set(sameRoute.filter((t) => t.date !== date && t.date >= today).map((t) => t.date))].sort().slice(0, 4);

  return (
    <Screen title="Buscar carrier"
      footer={list.length ? <>
        <Button label="Hacer otra búsqueda" onPress={() => router.back()} />
        <Button variant="ghost" label="Crear alerta" onPress={() => router.push({ pathname: '/alerta', params: { from, to, date } })} />
      </> : undefined}
    >
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Muted>{list.length ? 'Trayectos disponibles de la búsqueda' : 'Resultado de la búsqueda'}</Muted>
        <H2 style={{ color: colors.primaryDark, textAlign: 'center' }}>{from} - {to}</H2>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{longDate(date)}</Text>
      </View>

      {list.map((t) => (
        <TripCard key={t.id} trip={t} carrier={user(t.carrierId)} onPress={() => router.push(`/trayecto/${t.id}`)} />
      ))}

      {!list.length ? (
        <>
          <EmptyState icon="search" title="Aún no hay trayectos para esta fecha" text="Crea una alerta y te avisaremos en cuanto un carrier publique un trayecto que encaje con tu paquete.">
            <Button label="Crear alerta" icon="notifications-outline" onPress={() => router.push({ pathname: '/alerta', params: { from, to, date } })} />
            <Button variant="ghost" label="Probar otras fechas" onPress={() => router.back()} />
          </EmptyState>
          {nearby.length ? (
            <View style={{ gap: 8 }}>
              <Muted>Fechas cercanas con trayectos</Muted>
              <Chips options={nearby.map(shortDate)} value={undefined} onChange={(label) => {
                const d = nearby[nearby.map(shortDate).indexOf(label)];
                router.setParams({ date: d });
              }} />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
