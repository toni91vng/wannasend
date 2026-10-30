import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { askFeedback } from '@/components/FeedbackHost';
import { Text, View } from 'react-native';
import { TripCard } from '@/components/TripCard';
import { Button, Chips, EmptyState, ErrorBox, H2, Loading, Muted, Screen } from '@/components/ui';
import { useNearbyDays, useSearch } from '@/data/hooks';
import { Place } from '@/data/types';
import { longDate, shortDate } from '@/lib/format';
import { errorText } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Resultados() {
  const params = useLocalSearchParams<{ from: string; to: string; date: string }>();
  const from: Place = JSON.parse(params.from);
  const to: Place = JSON.parse(params.to);
  const date = params.date;
  const { data: list, isLoading, error, refetch } = useSearch(from, to, date);
  const { data: nearby = [] } = useNearbyDays(from, to, !!list && list.length === 0);
  const otherDays = nearby.filter((d) => d.day !== date);
  const alertParams = { from: params.from, to: params.to, date };

  // Opinión de la beta: si sigue mirando los resultados unos segundos (antes si no hay ninguno)
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const loaded = !!list;
  const empty = list?.length === 0;
  useEffect(() => {
    if (loaded) askFeedback('buscar', { delayMs: empty ? 2500 : 8000, stillValid: () => mounted.current });
  }, [loaded, empty]);

  return (
    <Screen title="Buscar carrier"
      footer={list?.length ? <>
        <Button label="Hacer otra búsqueda" onPress={() => router.back()} />
        <Button variant="ghost" label="Crear alerta" onPress={() => router.push({ pathname: '/alerta', params: alertParams })} />
      </> : undefined}
    >
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Muted>{list?.length ? 'Trayectos disponibles' : 'Resultado de la búsqueda'}</Muted>
        <H2 style={{ color: colors.primaryDark, textAlign: 'center' }}>{from.city || from.label} - {to.city || to.label}</H2>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{longDate(date)}</Text>
      </View>

      {isLoading ? <Loading label="Buscando trayectos…" /> : null}
      {error ? <ErrorBox text={errorText(error)} onRetry={() => refetch()} /> : null}

      {list?.map((t) => (
        <TripCard key={t.id} trip={t} onPress={() => router.push(`/trayecto/${t.id}`)} />
      ))}

      {list && !list.length ? (
        <>
          <EmptyState icon="search" title="Aún no hay trayectos para esta fecha" text="Crea una alerta y te avisaremos en cuanto un carrier publique un trayecto que pase cerca.">
            <Button label="Crear alerta" icon="notifications-outline" onPress={() => router.push({ pathname: '/alerta', params: alertParams })} />
            <Button variant="ghost" label="Probar otras fechas" onPress={() => router.back()} />
          </EmptyState>
          {otherDays.length ? (
            <View style={{ gap: 8 }}>
              <Muted>Fechas cercanas con trayectos</Muted>
              <Chips options={otherDays.map((d) => `${shortDate(d.day)} · ${d.trips}`)} value={undefined} onChange={(label) => {
                const d = otherDays[otherDays.map((x) => `${shortDate(x.day)} · ${x.trips}`).indexOf(label)];
                router.setParams({ date: d.day });
              }} />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
