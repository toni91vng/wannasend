import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Timeline } from '@/components/TripCard';
import { Avatar, Body, Button, Card, Divider, ErrorBox, H1, KeyValue, Loading, Muted, Rating, Row, Screen, Small } from '@/components/ui';
import { useProfile, useTrip } from '@/data/hooks';
import { useMe } from '@/data/session';
import { SIZE_HINT } from '@/data/types';
import { longDate } from '@/lib/format';
import { euros } from '@/lib/pricing';
import { errorText } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

/** Detalle del trayecto (vista del sender). */
export default function DetalleTrayecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: t, isLoading, error } = useTrip(id);
  const { data: c } = useProfile(t?.carrierId);

  if (isLoading) return <Screen title="Detalle"><Loading /></Screen>;
  if (error) return <Screen title="Detalle"><ErrorBox text={errorText(error)} /></Screen>;
  if (!t) return <Screen title="Detalle"><Muted>Este trayecto ya no está disponible.</Muted></Screen>;
  const left = t.capacity - t.booked;
  const mine = t.carrierId === me;

  return (
    <Screen title="Detalle" subtitle="Puedes ver más detalle del trayecto"
      footer={<>
        {!mine ? <Button label={left > 0 ? 'Enviar solicitud' : 'Trayecto completo'} disabled={left <= 0 || t.status !== 'publicado'} onPress={() => router.push(`/solicitar/${t.id}`)} /> : null}
        {c ? <Button variant="ghost" label={`Ver perfil de ${c.name}`} onPress={() => router.push(`/usuario/${c.id}`)} /> : null}
      </>}
    >
      <Body style={{ textAlign: 'center', fontFamily: fonts.semibold, fontSize: 22, color: colors.primaryDark }}>{longDate(t.date)}</Body>
      <Card style={{ alignItems: 'stretch' }}>
        {c ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Avatar name={c.name} size={96} />
            <H1>{c.name}</H1>
            <Row gap={14}>
              <Body>Nivel: <Body style={{ color: colors.primaryDark }}>{c.level.toLowerCase()}</Body></Body>
              <Rating value={c.rating} reviews={c.reviews} />
            </Row>
            {c.verified ? <Small>Identidad verificada</Small> : null}
          </View>
        ) : <Loading />}
        <Divider />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Timeline trip={t} showPoints /></View>
          <Body style={{ fontFamily: fonts.semibold, color: colors.primaryDark }}>{euros(t.total)}</Body>
        </Row>
        <Divider />
        <KeyValue k="Hueco disponible" v={left > 0 ? `${left} paquete${left > 1 ? 's' : ''}` : 'Completo'} accent={left > 0} />
        <KeyValue k="Tamaño máximo" v={t.maxSize} />
        <Small>{SIZE_HINT[t.maxSize]} · hasta {String(t.maxWeightKg).replace('.', ',')} kg</Small>
      </Card>
      {mine ? <Muted style={{ textAlign: 'center' }}>Este trayecto es tuyo.</Muted> : null}
    </Screen>
  );
}
