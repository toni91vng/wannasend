import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Timeline } from '@/components/TripCard';
import { Avatar, Badge, Body, Button, Card, H3, InfoBox, KeyValue, Muted, Rating, Row, Screen, Small } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { Shipment } from '@/data/types';
import { longDate, STATUS, timeAgo } from '@/lib/format';
import { euros } from '@/lib/pricing';
import { colors, fonts, radius } from '@/lib/theme';

/** Mi trayecto (carrier): solicitudes recibidas y paquetes aceptados. */
export default function MiTrayecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipments, respond, markPickedUp, openConversation } = useStore();
  const { trip, user, booked } = useDerived();
  const t = trip(id)!;
  const requests = shipments.filter((s) => s.tripId === t.id && s.status === 'solicitado');
  const accepted = shipments.filter((s) => s.tripId === t.id && ['aceptado', 'recogido', 'en_camino', 'entregado'].includes(s.status));
  const free = t.capacity - booked(t.id);

  const pkgBox = (s: Shipment) => (
    <Row gap={10} style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 }}>
      <Ionicons name="cube-outline" size={22} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <H3 style={{ fontSize: 14 }}>{s.size} · {String(s.weightKg).replace('.', ',')} kg</H3>
        <Small>{s.content} · {s.description}</Small>
      </View>
    </Row>
  );

  return (
    <Screen title="Mi trayecto" subtitle={`${t.from} → ${t.to} · ${longDate(t.date)}`}>
      <Card>
        <Timeline trip={t} showPoints />
        <KeyValue k="Plazas para paquetes" v={`${free} de ${t.capacity} libres`} accent />
        <KeyValue k="Tu aportación por paquete" v={euros(t.pricePerPackage)} />
      </Card>

      <H3>Solicitudes {requests.length ? `(${requests.length})` : ''}</H3>
      {requests.length ? requests.map((s) => {
        const u = user(s.senderId);
        return (
          <Card key={s.id}>
            <Row>
              <Avatar name={u.name} />
              <View style={{ flex: 1 }}>
                <H3>{u.name}</H3>
                <Row gap={6}><Rating value={u.rating} />{!u.rating ? null : <Small>· {u.packages} envíos</Small>}<Small>· {timeAgo(s.requestedAt)}</Small></Row>
              </View>
              <Badge label="Nueva" />
            </Row>
            {pkgBox(s)}
            <KeyValue k="Ganarás" v={euros(t.pricePerPackage)} accent />
            <Row gap={10}>
              <Button small variant="neutral" label="Rechazar" style={{ flex: 1 }} onPress={() => respond(s.id, false)} />
              <Button small label="Aceptar" style={{ flex: 1 }} disabled={free <= 0} onPress={() => respond(s.id, true)} />
            </Row>
            <Button small variant="ghost" label={`Escribir a ${u.name}`} onPress={() => router.push(`/chat/${openConversation(u.id, t.id)}`)} />
          </Card>
        );
      }) : <Muted>No tienes solicitudes pendientes.</Muted>}
      {requests.length ? <InfoBox icon="time-outline">Tienes 12 h para responder. Si no respondes, la solicitud caduca y se reembolsa al sender.</InfoBox> : null}

      <H3>Paquetes aceptados {accepted.length ? `(${accepted.length})` : ''}</H3>
      {accepted.length ? accepted.map((s) => {
        const u = user(s.senderId);
        return (
          <Card key={s.id}>
            <Row>
              <Avatar name={u.name} size={36} />
              <View style={{ flex: 1 }}><H3>{u.name}</H3><Small>Para {s.recipientName} · {s.recipientPhone}</Small></View>
              <Badge label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
            </Row>
            {pkgBox(s)}
            {s.status === 'aceptado' ? <Button small label="Marcar como recogido" icon="cube-outline" onPress={() => markPickedUp(s.id)} /> : null}
            {s.status === 'recogido' || s.status === 'en_camino' ? <Button small label="Confirmar entrega" icon="checkmark-done-outline" onPress={() => router.push(`/entrega/${s.id}`)} /> : null}
            {s.status === 'entregado' ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryDark }}>Entregado{s.deliveredAt ? ` a las ${s.deliveredAt}` : ''} · +{euros(t.pricePerPackage)}</Text> : null}
          </Card>
        );
      }) : <Muted>Cuando aceptes una solicitud, el paquete aparecerá aquí.</Muted>}
      <Body> </Body>
    </Screen>
  );
}
