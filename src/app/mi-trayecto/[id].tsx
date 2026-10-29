import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PackagePhoto, VerifiedBadge } from '@/components/Photos';
import { Timeline } from '@/components/TripCard';
import { Avatar, Badge, Button, Card, ErrorBox, H3, InfoBox, KeyValue, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { cancelTrip, openConversation, respondShipment, startTrip } from '@/data/api';
import { useTrip, useTripShipments } from '@/data/hooks';
import { Shipment } from '@/data/types';
import { isUpcoming, longDate, STATUS, timeAgo } from '@/lib/format';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';

/**
 * Mi trayecto (carrier): solicitudes recibidas y paquetes aceptados. Se actualiza en tiempo real.
 * Flujo de cada paquete: Aceptado → Recogido (revisión con foto) → En camino ("Empiezo el trayecto") → Entregado.
 */
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
  const accepted = list.filter((s) => ['aceptado', 'recogido', 'en_camino', 'entregado'].includes(s.status));
  const free = t.capacity - accepted.length;
  const capLeft = t.capRemaining; // € que quedan del tope (null = sin tope)
  const fitsCap = (s: Shipment) => capLeft === null || capLeft === undefined || s.carrierAmount <= capLeft + 0.001;
  const onBoard = list.filter((s) => ['recogido', 'en_camino'].includes(s.status)).length;
  const pendingPickup = list.filter((s) => s.status === 'aceptado').length;
  const canStart = t.status === 'publicado' && !t.startedAt && onBoard + pendingPickup > 0
    && new Date(t.departureAt).getTime() - Date.now() < 12 * 3600_000;
  const startedAt = t.startedAt ? new Date(t.startedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

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

  const start = async () => {
    setBusyId('start');
    const n = await run(() => startTrip(t.id), 'No se ha podido iniciar el trayecto');
    setBusyId(null);
    if (n === undefined || n === null) return;
    refresh();
    notify('¡Buen viaje!', n > 0 ? `Hemos avisado a ${n === 1 ? 'tu sender' : `tus ${n} senders`} de que su paquete ya va de camino.` : 'Los paquetes que recojas por el camino figurarán como «En camino».');
  };

  const pkgBox = (s: Shipment) => (
    <Row gap={10} style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 }}>
      <Ionicons name="cube-outline" size={22} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <H3 style={{ fontSize: 14 }}>{s.size} · {String(s.weightKg).replace('.', ',')} kg</H3>
        <Small>{s.content}{s.description ? ` · ${s.description}` : ''} · valor declarado {euros(s.declaredValue)}</Small>
      </View>
    </Row>
  );

  return (
    <Screen title="Mi trayecto" subtitle={`${t.from} → ${t.to} · ${longDate(t.date)}`}>
      <Card>
        <Timeline trip={t} showPoints />
        <KeyValue k="Plazas para paquetes" v={`${free} de ${t.capacity} libres`} accent />
        <KeyValue k="Tu aportación por paquete" v={euros(t.pricePerPackage)} />
        {t.earningsCap ? <KeyValue k={`Gastos del viaje (${t.distanceKm} km)`} v={`${euros(capLeft ?? 0)} de ${euros(t.earningsCap)} disponibles`} /> : null}
        {startedAt ? <Badge label={`En camino desde las ${startedAt}`} /> : null}
        {t.status === 'cancelado' ? <Badge label="Trayecto cancelado" tone="red" /> : null}
      </Card>

      {canStart ? (
        <Card>
          <H3>¿Ya sales?</H3>
          <Muted>{pendingPickup ? `Te ${pendingPickup === 1 ? 'falta 1 paquete' : `faltan ${pendingPickup} paquetes`} por recoger. ` : ''}Cuando arranques, avisa a tus senders de que su paquete va de camino.</Muted>
          <Button label="Empiezo el trayecto" icon="car-outline" loading={busyId === 'start'} onPress={start} />
        </Card>
      ) : null}

      <H3>Solicitudes {requests.length ? `(${requests.length})` : ''}</H3>
      {requests.length ? requests.map((s) => (
        <Card key={s.id}>
          <Row>
            <Avatar name={s.senderName ?? '?'} />
            <View style={{ flex: 1 }}>
              <H3>{s.senderName}</H3>
              <VerifiedBadge verified={s.senderVerified} />
              <Small>{timeAgo(s.requestedAt)}</Small>
            </View>
            <Badge label="Nueva" />
          </Row>
          <PackagePhoto path={s.photoPath} height={160} />
          {pkgBox(s)}
          <KeyValue k="Recibirás" v={euros(s.carrierAmount)} accent />
          {!fitsCap(s) ? <Small style={{ color: colors.danger }}>No cabe en los gastos de tu viaje: ya has cubierto el tope.</Small> : null}
          <Row gap={10}>
            <Button small variant="neutral" label="Rechazar" style={{ flex: 1 }} loading={busyId === s.id} onPress={() => act(s.id, () => respondShipment(s.id, false))} />
            <Button small label="Aceptar" style={{ flex: 1 }} disabled={free <= 0 || !fitsCap(s)} loading={busyId === s.id} onPress={() => act(s.id, () => respondShipment(s.id, true))} />
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
          {s.status === 'aceptado' ? <Button small label="Recoger paquete" icon="cube-outline" onPress={() => router.push(`/recogida/${s.id}`)} /> : null}
          {s.status === 'recogido' || s.status === 'en_camino' ? <Button small label="Confirmar entrega" icon="checkmark-done-outline" onPress={() => router.push(`/entrega/${s.id}`)} /> : null}
          {s.status === 'entregado' ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryDark }}>Entregado{s.deliveredAt ? ` a las ${s.deliveredAt}` : ''} · +{euros(s.carrierAmount)}</Text> : null}
          {s.status !== 'entregado' ? <Button small variant="ghost" label={`Escribir a ${s.senderName}`} onPress={() => chat(s.senderId)} /> : null}
        </Card>
      )) : <Muted>Cuando aceptes una solicitud, el paquete aparecerá aquí.</Muted>}

      {t.status === 'publicado' && isUpcoming(t.departureAt) && onBoard === 0 ? (
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
