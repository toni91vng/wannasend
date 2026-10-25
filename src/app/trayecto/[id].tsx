import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Timeline } from '@/components/TripCard';
import { Avatar, Body, Button, Card, Divider, H1, KeyValue, Muted, Rating, Row, Screen, Small } from '@/components/ui';
import { useDerived } from '@/data/store';
import { SIZE_HINT } from '@/data/types';
import { longDate } from '@/lib/format';
import { breakdown, euros } from '@/lib/pricing';
import { colors, fonts } from '@/lib/theme';

/** Detalle del trayecto (vista del sender). */
export default function DetalleTrayecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip, user, booked } = useDerived();
  const t = trip(id);
  if (!t) return <Screen title="Detalle"><Muted>Este trayecto ya no está disponible.</Muted></Screen>;
  const c = user(t.carrierId);
  const left = t.capacity - booked(t.id);

  return (
    <Screen title="Detalle" subtitle="Puedes ver más detalle del trayecto"
      footer={<>
        <Button label="Enviar solicitud" disabled={left <= 0} onPress={() => router.push(`/solicitar/${t.id}`)} />
        <Button variant="ghost" label={`Ver perfil de ${c.name}`} onPress={() => router.push(`/usuario/${c.id}`)} />
      </>}
    >
      <Body style={{ textAlign: 'center', fontFamily: fonts.semibold, fontSize: 22, color: colors.primaryDark }}>{longDate(t.date)}</Body>
      <Card style={{ alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar name={c.name} size={96} />
          <H1>{c.name}</H1>
          <Row gap={14}>
            <Body>Nivel: <Body style={{ color: colors.primaryDark }}>{c.level.toLowerCase()}</Body></Body>
            <Rating value={c.rating} reviews={c.reviews} />
          </Row>
        </View>
        <Divider />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Timeline trip={t} showPoints /></View>
          <Body style={{ fontFamily: fonts.semibold, color: colors.primaryDark }}>{euros(breakdown(t.pricePerPackage).total)}</Body>
        </Row>
        <Divider />
        <KeyValue k="Hueco disponible" v={left > 0 ? `${left} paquete${left > 1 ? 's' : ''}` : 'Completo'} accent={left > 0} />
        <KeyValue k="Tamaño máximo" v={t.maxSize} />
        <Small>{SIZE_HINT[t.maxSize]} · hasta {t.maxWeightKg} kg</Small>
      </Card>
    </Screen>
  );
}
