import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PackagePhoto, VerifiedBadge } from '@/components/Photos';
import { Timeline } from '@/components/TripCard';
import {
  Avatar, Badge, BigIcon, Body, Button, Card, Divider, ErrorBox, H2, H3, InfoBox, KeyValue, Loading, Muted, Rating, Row, Screen, Small,
} from '@/components/ui';
import { cancelShipment, openConversation } from '@/data/api';
import { useDeliveryCode, useHasReviewed, usePickupCode, useProfile, useShipment } from '@/data/hooks';
import QRCode from 'react-native-qrcode-svg';
import { Shipment } from '@/data/types';
import { useQueryClient } from '@tanstack/react-query';
import { longDate, STATUS, timeAgo } from '@/lib/format';
import { notify, shareText } from '@/lib/notify';
import { payShipment } from '@/lib/payments';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

const STEPS: { key: string; label: string }[] = [
  { key: 'aceptado', label: 'Aceptado' },
  { key: 'recogido', label: 'Recogido' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'entregado', label: 'Entregado' },
];
const stepIndex = (s: Shipment) =>
  ({ aceptado: 0, recogido: 1, en_camino: 2, entregado: 3 } as Partial<Record<Shipment['status'], number>>)[s.status] ?? -1;
const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : undefined);

/** Seguimiento de un envío (vista del sender). Se actualiza solo cuando el carrier cambia el estado. */
export default function Envio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: sh, isLoading, error } = useShipment(id);
  const t = sh?.trip;
  const { data: c } = useProfile(t?.carrierId);
  const active = !!sh && ['aceptado', 'recogido', 'en_camino'].includes(sh.status);
  const { data: code } = useDeliveryCode(id, active);
  const { data: pickupCode } = usePickupCode(id, sh?.status === 'aceptado');
  const { data: reviewed } = useHasReviewed(id, sh?.status === 'entregado');
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Screen title="Envío"><Loading /></Screen>;
  if (error) return <Screen title="Envío"><ErrorBox text={errorText(error)} /></Screen>;
  if (!sh || !t) return <Screen title="Envío"><Muted>No encontramos este envío.</Muted></Screen>;
  const name = c?.name ?? 'el carrier';

  const chat = async () => {
    const cid = await run(() => openConversation(t.carrierId, t.id));
    if (cid) router.push(`/chat/${cid}`);
  };
  const shareCode = async () => {
    if (!code) return;
    const msg = `Hola ${sh.recipientName}, te llega un paquete con WannaSend (${t.from} → ${t.to}, ${longDate(t.date)}, sobre las ${t.arrival}). Cuando ${name} te lo entregue, dale este código: ${code}`;
    shareText(msg);
  };
  const cancel = async () => {
    setBusy(true);
    await run(() => cancelShipment(sh.id), 'No se ha podido cancelar');
    await qc.invalidateQueries({ queryKey: ['shipment', id] });
    setBusy(false);
  };

  const refundText = !sh.paid ? '' : sh.refunded ? `Te hemos devuelto ${euros(sh.total)}.` : `Estamos devolviéndote ${euros(sh.total)}; puede tardar unos días en aparecer en tu tarjeta.`;
  const completePayment = async () => {
    setBusy(true);
    try {
      const r = await payShipment(sh.id);
      if (r === 'paid') setTimeout(() => qc.invalidateQueries({ queryKey: ['shipment', id] }), 2000);
    } catch (e) { notify('No se ha podido pagar', errorText(e)); }
    setBusy(false);
  };

  const head = (() => {
    switch (sh.status) {
      case 'pendiente_pago': return { icon: 'card-outline' as const, tone: 'amber' as const, title: 'Pago pendiente', text: `Completa el pago para enviar la solicitud a ${name}. Si no, se cancelará en 30 minutos.` };
      case 'solicitado': return { icon: 'time-outline' as const, tone: 'amber' as const, title: `Esperando respuesta de ${name}`, text: `Te avisaremos en cuanto responda. Si no responde en 12 h, la solicitud caduca. Enviada ${timeAgo(sh.requestedAt)}.` };
      case 'aceptado': return { icon: 'checkmark' as const, tone: 'green' as const, title: '¡Envío aceptado!', text: `¡Enhorabuena! ${name} ha aceptado llevar tu paquete. Comparte el código con ${sh.recipientName}. Ten el paquete abierto para que lo revise al recogerlo.` };
      case 'recogido': return { icon: 'cube-outline' as const, tone: 'green' as const, title: 'Paquete recogido', text: `${name} lo recogió${sh.pickedUpAt ? ` a las ${sh.pickedUpAt}` : ''}. Salida prevista a las ${t.departure}; te avisaremos cuando arranque.` };
      case 'en_camino': return { icon: 'car-outline' as const, tone: 'green' as const, title: 'Tu paquete está en camino', text: `${t.startedAt ? `${name} salió a las ${hhmm(t.startedAt)}. ` : ''}Llegada prevista a las ${t.arrival}.` };
      case 'entregado': return { icon: 'gift-outline' as const, tone: 'green' as const, title: '¡Envío entregado!', text: `${sh.recipientName} ha recibido tu paquete${sh.deliveredAt ? ` a las ${sh.deliveredAt}` : ''}.` };
      case 'rechazado': return sh.rejectionStage === 'recogida'
        ? { icon: 'close' as const, tone: 'amber' as const, title: 'Paquete no recogido', text: `${name} no ha podido llevarlo porque no coincidía con lo declarado${sh.rejectionReason ? `: «${sh.rejectionReason}»` : ''}. ${refundText}` }
        : { icon: 'close' as const, tone: 'amber' as const, title: 'Solicitud rechazada', text: `${name} no puede llevar tu paquete esta vez. ${refundText}` };
      case 'caducado': return { icon: 'hourglass-outline' as const, tone: 'amber' as const, title: 'Solicitud caducada', text: `${name} no respondió a tiempo. ${refundText}` };
      default: return { icon: 'close' as const, tone: 'amber' as const, title: 'Envío cancelado', text: `Este envío se ha cancelado. ${refundText}` };
    }
  })();
  const idx = stepIndex(sh);

  return (
    <Screen title={sh.status === 'solicitado' ? 'Solicitud' : 'Trayecto'}>
      <BigIcon name={head.icon} tone={head.tone} />
      <H2 style={{ textAlign: 'center' }}>{head.title}</H2>
      <Muted style={{ textAlign: 'center' }}>{head.text}</Muted>

      {idx >= 0 ? (
        <Card>
          <H3>Tu paquete está</H3>
          {STEPS.map((s, i) => {
            const done = i <= idx;
            const extra = s.key === 'recogido' ? (sh.pickedUpAt ? `a las ${sh.pickedUpAt} por ${name}` : '')
              : s.key === 'en_camino' ? (t.startedAt ? `salida a las ${hhmm(t.startedAt)}` : `salida prevista a las ${t.departure}`)
              : s.key === 'entregado' ? (sh.deliveredAt ? `${sh.deliveredAt} hora final de llegada` : `${t.arrival} hora prevista`) : '';
            return (
              <Row key={s.key} gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                  {i < STEPS.length - 1 ? <View style={{ width: 2, height: 22, backgroundColor: i < idx ? colors.primary : colors.border }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: done ? fonts.semibold : fonts.medium, color: done ? colors.text : colors.muted }}>{s.label}</Body>
                  {extra && (done || i === idx + 1) ? <Small>{extra}</Small> : null}
                </View>
              </Row>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <Row>
          <Avatar name={name} />
          <View style={{ flex: 1, gap: 2 }}><H3>{name}</H3>{c ? <Rating value={c.rating} reviews={c.reviews} /> : null}<VerifiedBadge verified={c?.verified} /></View>
          <Badge label={STATUS[sh.status].label} tone={STATUS[sh.status].tone} />
        </Row>
        <Divider />
        <Text style={{ fontFamily: fonts.semibold, color: colors.primaryDark, fontSize: 15 }}>{longDate(t.date)}</Text>
        <Timeline trip={t} showPoints />
        <Divider />
        <KeyValue k="Paquete" v={`${sh.size} · ${String(sh.weightKg).replace('.', ',')} kg`} />
        <KeyValue k="Se lo entrega a" v={sh.recipientName} />
        {sh.valueLabel ? <KeyValue k="Valor aproximado (solo lo ves tú)" v={sh.valueLabel} /> : null}
        <KeyValue k={sh.refunded ? 'Reembolsado' : sh.paid ? 'Pagado' : 'Precio'} v={euros(sh.total)} accent />
      </Card>

      {sh.pickupPhotoPath ? (
        <Card>
          <H3>Foto al recogerlo</H3>
          <PackagePhoto path={sh.pickupPhotoPath} />
        </Card>
      ) : null}

      {sh.status === 'aceptado' ? (
        <Card style={{ alignItems: 'center' }}>
          <H3>Código de recogida</H3>
          <Muted style={{ textAlign: 'center' }}>Cuando {name} recoja el paquete, enséñale este QR o dile el código. Así queda confirmado que se lo has dado.</Muted>
          {pickupCode ? <QRCode value={`wannasend:recogida:${sh.id}:${pickupCode}`} size={160} color={colors.text} backgroundColor={colors.white} /> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 34, letterSpacing: 10, color: colors.text }}>{pickupCode ?? '····'}</Text>
          <Button variant="secondary" label="Compartir código" icon="share-social-outline" disabled={!pickupCode} style={{ alignSelf: 'stretch' }}
            onPress={() => pickupCode && shareText(`Código de recogida de WannaSend para ${name}: ${pickupCode}`)} />
          <Small style={{ textAlign: 'center' }}>Si no se lo das tú en persona, compártelo con quien le entregue el paquete.</Small>
        </Card>
      ) : null}

      {active ? (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Small>Código de entrega para {sh.recipientName}</Small>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 34, letterSpacing: 10, color: colors.text }}>{code ?? '····'}</Text>
            <Button label="Compartir código" icon="share-social-outline" onPress={shareCode} disabled={!code} style={{ alignSelf: 'stretch' }} />
            <Small style={{ textAlign: 'center' }}>Solo el destinatario debe conocerlo. No se lo des al carrier.</Small>
          </Card>
          <Button variant="secondary" label={`Contactar con ${name}`} icon="chatbubble-outline" onPress={chat} />
          <Button variant="ghost" label="Reportar una incidencia" color={colors.textSecondary} onPress={() => router.push(`/incidencia/${sh.id}`)} />
        </>
      ) : null}

      {sh.status === 'solicitado' ? (
        <>
          <Button variant="secondary" label={`Enviar mensaje a ${name}`} icon="chatbubble-outline" onPress={chat} />
          <Button variant="ghost" label="Cancelar solicitud" loading={busy} color={colors.danger} onPress={cancel} />
        </>
      ) : null}
      {sh.status === 'aceptado' ? <Button variant="ghost" label="Cancelar envío" loading={busy} color={colors.danger} onPress={cancel} /> : null}

      {sh.status === 'entregado' ? (
        <>
          {!reviewed ? <Button label={`Valorar a ${name}`} icon="star-outline" onPress={() => router.push(`/valorar/${sh.id}`)} /> : <InfoBox icon="star">¡Gracias por valorar el envío!</InfoBox>}
          <Card>
            <H3>Recomienda WannaSend a un amigo</H3>
            <Muted>Cuanta más gente haya, más trayectos encontrarás.</Muted>
            <Row gap={10}>
              <Button small label="Compartir" icon="share-social-outline" style={{ flex: 1 }} onPress={() => shareText('Envía paquetes con gente que ya hace el trayecto. Prueba WannaSend.')} />
              <Button small variant="neutral" label="Ahora no" style={{ flex: 1 }} onPress={() => router.back()} />
            </Row>
          </Card>
        </>
      ) : null}
      {['rechazado', 'caducado', 'cancelado'].includes(sh.status) ? <Button label="Buscar otro trayecto" onPress={() => { router.dismissAll(); router.navigate('/buscar'); }} /> : null}
      {sh.status === 'pendiente_pago' ? (
        <>
          <Button label={`Completar pago (${euros(sh.total)})`} icon="card-outline" loading={busy} onPress={completePayment} />
          <Button variant="ghost" label="Cancelar" color={colors.danger} onPress={cancel} />
        </>
      ) : null}
    </Screen>
  );
}
