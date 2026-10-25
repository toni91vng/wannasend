import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Timeline } from '@/components/TripCard';
import { Avatar, Badge, Button, Card, ErrorBox, H3, InfoBox, KeyValue, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { cancelTrip, markPickedUp, openConversation, respondShipment } from '@/data/api';
import { useTrip, useTripShipments } from '@/data/hooks';
import { Shipment } from '@/data/types';
import { isUpcoming, longDate, STATUS, timeAgo } from '@/lib/format';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';

/** Mi trayecto (carrier): solicitudes recibidas y paquetes aceptados. Se actualiza en tiempo real. */
export default function MiTrayecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: t, isLoading, error } = useTrip(id);
  const { data: list = [] } = useTripShipments(id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) return <Screen title="Mi trayecto"><Loading /></Screen>;
  if (error || !t) return <Screen title="Mi trayecto"><ErrorBox text={error ? errorText(error) : 'Trayecto no encontrado'} /></Screen>;

  const requests = list.filter((s) => s.status === 'solicitado');
  const accepted = list.filter((s) => ['aceptado', 'en_camino', 'entregado'].includes(s.status));
  const free = t.capacity - accepted.length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tripShipments', id] });
    qc.invalidateQueries({ queryKey: ['trip', id] });
    qc.invalidateQueries({ queryKey: ['myTrips'] });
  };
  const act = async (sid: string, fn: () => Promise<unknown>) => {
    setBusyId(sid);
    await run(fn);
    setBusyId(null);
    refresh();
  };
  const chat = async (userId: string) => {
    const cid = await run(() => openConversation(userId, t.id));
    if (cid) router.push(`/chat/${cid}`);
  };

  const pkgBox = (s: Shipment) => (
    <Row gap={10} style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 }}>
      <Ionicons name="cube-outline" size={22} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <H3 style={{ fontSize: 14 }}>{s.size} · {String(s.weightKg).replace('.', ',')} kg</H3>
        <Small>{s.content}{s.description ? ` · ${s.description}` : ''}</Small>
      </View>
    </Row>
  );

  return (
    <Screen title="Mi trayecto" subtitle={`${t.from} → ${t.to} · ${longDate(t.date)}`}>
      <Card>
        <Timeline trip={t} showPoints />
        <KeyValue k="Plazas para paquetes" v={`${free} de ${t.capacity} libres`} accent />
        <KeyValue k="Tu aportación por paquete" v={euros(t.pricePerPackage)} />
        {t.status === 'cancelado' ? <Badge label="Trayecto cancelado" tone="red" /> : null}
      </Card>

      <H3>Solicitudes {requests.length ? `(${requests.length})` : ''}</H3>
      {requests.length ? requests.map((s) => (
        <Card key={s.id}>
          <Row>
            <Avatar name={s.senderName ?? '?'} />
            <View style={{ flex: 1 }}>
              <H3>{s.senderName}</H3>
              <Small>{timeAgo(s.requestedAt)}</Small>
            </View>
            <Badge label="Nueva" />
          </Row>
          {pkgBox(s)}
          <KeyValue k="Ganarás" v={euros(s.carrierAmount)} accent />
          <Row gap={10}>
            <Button small variant="neutral" label="Rechazar" style={{ flex: 1 }} loading={busyId === s.id} onPress={() => act(s.id, () => respondShipment(s.id, false))} />
            <Button small label="Aceptar" style={{ flex: 1 }} disabled={free <= 0} loading={busyId === s.id} onPress={() => act(s.id, () => respondShipment(s.id, true))} />
          </Row>
          <Row gap={10}>
            <Button small variant="ghost" label={`Escribir a ${s.senderName}`} style={{ flex: 1 }} onPress={() => chat(s.senderId)} />
            <Button small variant="ghost" label="Ver perfil" style={{ flex: 1 }} onPress={() => router.push(`/usuario/${s.senderId}`)} />
          </Row>
        </Card>
      )) : <Muted>No tienes solicitudes pendientes.</Muted>}
      {requests.length ? <InfoBox icon="time-outline">Tienes 12 h para responder. Si no respondes, la solicitud caduca.</InfoBox> : null}

      <H3>Paquetes aceptados {accepted.length ? `(${accepted.length})` : ''}</H3>
      {accepted.length ? accepted.map((s) => (
        <Card key={s.id}>
          <Row>
            <Avatar name={s.senderName ?? '?'} size={36} />
            <View style={{ flex: 1 }}><H3>{s.senderName}</H3><Small>Para {s.recipientName}{s.recipientPhone ? ` · ${s.recipientPhone}` : ''}</Small></View>
            <Badge label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
          </Row>
          {pkgBox(s)}
          {s.status === 'aceptado' ? <Button small label="Marcar como recogido" icon="cube-outline" loading={busyId === s.id} onPress={() => act(s.id, () => markPickedUp(s.id))} /> : null}
          {s.status === 'en_camino' ? <Button small label="Confirmar entrega" icon="checkmark-done-outline" onPress={() => router.push(`/entrega/${s.id}`)} /> : null}
          {s.status === 'entregado' ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryDark }}>Entregado{s.deliveredAt ? ` a las ${s.deliveredAt}` : ''} · +{euros(s.carrierAmount)}</Text> : null}
          {s.status !== 'entregado' ? <Button small variant="ghost" label={`Escribir a ${s.senderName}`} onPress={() => chat(s.senderId)} /> : null}
        </Card>
      )) : <Muted>Cuando aceptes una solicitud, el paquete aparecerá aquí.</Muted>}

      {t.status === 'publicado' && isUpcoming(t.departureAt) ? (
        confirmCancel ? (
          <Card>
            <H3>¿Cancelar este trayecto?</H3>
            <Muted>Dejará de aparecer en las búsquedas. Si tienes paquetes aceptados, avisa antes a los senders.</Muted>
            <Row gap={10}>
              <Button small variant="neutral" label="No" style={{ flex: 1 }} onPress={() => setConfirmCancel(false)} />
              <Button small variant="danger" label="Sí, cancelar" style={{ flex: 1 }} onPress={async () => { await run(() => cancelTrip(t.id)); setConfirmCancel(false); refresh(); }} />
            </Row>
          </Card>
        ) : <Button variant="ghost" small label="Cancelar trayecto" color={colors.danger} onPress={() => setConfirmCancel(true)} />
      ) : null}
    </Screen>
  );
}
