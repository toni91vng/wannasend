import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { Timeline } from '@/components/TripCard';
import {
  Avatar, Badge, BigIcon, Body, Button, Card, Divider, H2, H3, InfoBox, KeyValue, Muted, Rating, Row, Screen, Small,
} from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { Shipment } from '@/data/types';
import { longDate, STATUS, timeAgo } from '@/lib/format';
import { breakdown, euros } from '@/lib/pricing';
import { notify } from '@/lib/notify';
import { colors, fonts } from '@/lib/theme';

const STEPS: { key: Shipment['status']; label: string }[] = [
  { key: 'aceptado', label: 'Aceptado' },
  { key: 'recogido', label: 'Recogido' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'entregado', label: 'Entregado' },
];

/** Seguimiento de un envío (vista del sender): solicitud, aceptado, en camino, entregado. */
export default function Envio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipments, cancelShipment, advance, openConversation } = useStore();
  const { trip, user } = useDerived();
  const sh = shipments.find((x) => x.id === id);
  if (!sh) return <Screen title="Envío"><Muted>No encontramos este envío.</Muted></Screen>;
  const t = trip(sh.tripId)!;
  const c = user(t.carrierId);
  const total = breakdown(t.pricePerPackage).total;
  const chat = () => router.push(`/chat/${openConversation(c.id, t.id)}`);

  const shareCode = async () => {
    const msg = `Hola ${sh.recipientName}, te llega un paquete con WannaSend (${t.from} → ${t.to}, ${longDate(t.date)}, sobre las ${t.arrival}). Cuando ${c.name} te lo entregue, dale este código: ${sh.deliveryCode}`;
    if (Platform.OS === 'web') { notify('Mensaje para el destinatario', msg); return; }
    const phone = sh.recipientPhone.replace(/\D/g, '');
    const wa = `whatsapp://send?phone=34${phone}&text=${encodeURIComponent(msg)}`;
    if (await Linking.canOpenURL(wa)) Linking.openURL(wa); else Share.share({ message: msg });
  };

  const head = (() => {
    switch (sh.status) {
      case 'solicitado': return { icon: 'time-outline' as const, tone: 'amber' as const, title: `Esperando respuesta de ${c.name}`, text: `Te avisaremos en cuanto acepte. Si no responde en 12 h, te devolvemos el dinero automáticamente. Solicitud enviada ${timeAgo(sh.requestedAt)}.` };
      case 'aceptado': return { icon: 'checkmark' as const, tone: 'green' as const, title: '¡Envío aceptado!', text: `¡Enhorabuena! ${c.name} ha aceptado llevar tu paquete.` };
      case 'recogido': case 'en_camino': return { icon: 'car-outline' as const, tone: 'green' as const, title: 'Tu paquete está en camino', text: `${t.arrival} hora prevista de llegada a destino.` };
      case 'entregado': return { icon: 'gift-outline' as const, tone: 'green' as const, title: '¡Envío entregado!', text: `${sh.recipientName} ha recibido tu paquete${sh.deliveredAt ? ` a las ${sh.deliveredAt}` : ''}.` };
      case 'rechazado': return { icon: 'close' as const, tone: 'amber' as const, title: 'Solicitud rechazada', text: `${c.name} no puede llevar tu paquete. Te hemos devuelto ${euros(total)}.` };
      default: return { icon: 'close' as const, tone: 'amber' as const, title: 'Envío cancelado', text: `Te hemos devuelto ${euros(total)}.` };
    }
  })();
  const stepIdx = STEPS.findIndex((s) => s.key === (sh.status === 'en_camino' ? 'en_camino' : sh.status));

  return (
    <Screen title={sh.status === 'solicitado' ? 'Solicitud' : 'Trayecto'}>
      <BigIcon name={head.icon} tone={head.tone} />
      <H2 style={{ textAlign: 'center' }}>{head.title}</H2>
      <Muted style={{ textAlign: 'center' }}>{head.text}</Muted>

      {stepIdx >= 0 ? (
        <Card>
          <H3>Tu paquete está</H3>
          {STEPS.map((s, i) => {
            const done = i <= stepIdx;
            const extra = s.key === 'recogido' && sh.pickedUpAt ? `a las ${sh.pickedUpAt} por ${c.name}`
              : s.key === 'entregado' ? (sh.deliveredAt ? `${sh.deliveredAt} hora final de llegada` : `${t.arrival} hora prevista`) : '';
            return (
              <Row key={s.key} gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                  {i < STEPS.length - 1 ? <View style={{ width: 2, height: 22, backgroundColor: i < stepIdx ? colors.primary : colors.border }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: done ? fonts.semibold : fonts.medium, color: done ? colors.text : colors.muted }}>{s.label}</Body>
                  {extra && done ? <Small>{extra}</Small> : null}
                </View>
              </Row>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <Row>
          <Avatar name={c.name} />
          <View style={{ flex: 1 }}><H3>{c.name}</H3><Rating value={c.rating} reviews={c.reviews} /></View>
          <Badge label={STATUS[sh.status].label} tone={STATUS[sh.status].tone} />
        </Row>
        <Divider />
        <Text style={{ fontFamily: fonts.semibold, color: colors.primaryDark, fontSize: 15 }}>{longDate(t.date)}</Text>
        <Timeline trip={t} showPoints />
        <Divider />
        <KeyValue k="Paquete" v={`${sh.size} · ${String(sh.weightKg).replace('.', ',')} kg`} />
        <KeyValue k="Destinatario" v={sh.recipientName} />
        <KeyValue k={sh.status === 'solicitado' ? 'Importe retenido' : 'Pagado'} v={euros(total)} accent />
      </Card>

      {['aceptado', 'recogido', 'en_camino'].includes(sh.status) ? (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Small>Código de entrega para {sh.recipientName}</Small>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 34, letterSpacing: 10, color: colors.text }}>{sh.deliveryCode}</Text>
            <Button label="Compartir código con el destinatario" icon="logo-whatsapp" onPress={shareCode} style={{ alignSelf: 'stretch' }} />
          </Card>
          <Button variant="secondary" label={`Contactar con ${c.name}`} icon="chatbubble-outline" onPress={chat} />
          <Button variant="ghost" label="Reportar una incidencia" color={colors.textSecondary} onPress={() => router.push(`/incidencia/${sh.id}`)} />
        </>
      ) : null}

      {sh.status === 'solicitado' ? (
        <>
          <Button variant="secondary" label={`Enviar mensaje a ${c.name}`} icon="chatbubble-outline" onPress={chat} />
          <Button variant="ghost" label="Cancelar solicitud" color={colors.danger} onPress={() => cancelShipment(sh.id)} />
        </>
      ) : null}

      {sh.status === 'entregado' ? (
        <>
          {!sh.rated ? <Button label={`Valorar a ${c.name}`} icon="star-outline" onPress={() => router.push(`/valorar/${sh.id}`)} /> : <InfoBox icon="star">¡Gracias por valorar el envío!</InfoBox>}
          <Card>
            <H3>Recomienda WannaSend a un amigo</H3>
            <Muted>Si se registra con tu enlace, los dos tendréis 2 € de descuento en el próximo envío.</Muted>
            <Row gap={10}>
              <Button small label="Compartir" icon="share-social-outline" style={{ flex: 1 }} onPress={() => Share.share({ message: 'Envía paquetes con gente que ya hace el trayecto: wannasend.app/invita/sara' })} />
              <Button small variant="neutral" label="Ahora no" style={{ flex: 1 }} onPress={() => router.back()} />
            </Row>
          </Card>
        </>
      ) : null}

      {/* Solo para la demo: simula los pasos que harán el carrier y el destinatario */}
      {['solicitado', 'aceptado', 'recogido', 'en_camino'].includes(sh.status) ? (
        <Button variant="ghost" small label="Demo: avanzar al siguiente estado" color={colors.muted} onPress={() => advance(sh.id)} />
      ) : null}
    </Screen>
  );
}
