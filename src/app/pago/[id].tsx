import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Divider, H3, InfoBox, KeyValue, Loading, Row, Screen, Small, Steps } from '@/components/ui';
import { NewPackage, requestShipment, setMyPhone } from '@/data/api';
import { usePaymentsEnabled, useProfile, useTrip } from '@/data/hooks';
import { useMe } from '@/data/session';
import { notify } from '@/lib/notify';
import { payShipment } from '@/lib/payments';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/**
 * Paso 2: precio y pago.
 * Con los pagos activos se abre el formulario oficial de Stripe (la app nunca ve la tarjeta) y el envío pasa a
 * "solicitado" cuando Stripe confirma el cobro. Si el carrier rechaza o no responde en 12 h, se reembolsa solo.
 */
export default function Pago() {
  const { id, pkg, myPhone } = useLocalSearchParams<{ id: string; pkg: string; myPhone?: string }>();
  const me = useMe();
  const { data: t } = useTrip(id);
  const { data: carrier } = useProfile(t?.carrierId);
  const { data: payments } = usePaymentsEnabled();
  const [busy, setBusy] = useState(false);
  if (!t || payments === undefined) return <Screen title="Pago"><Loading /></Screen>;
  const p: NewPackage = JSON.parse(pkg);

  const go = (sid: string) => { router.dismissAll(); router.push(`/envio/${sid}`); };

  const send = async () => {
    setBusy(true);
    const sid = await run(async () => {
      if (myPhone) await setMyPhone(me, myPhone);
      return requestShipment(t.id, p);
    }, 'No se ha podido crear la solicitud');
    if (!sid) { setBusy(false); return; }
    if (!payments) { setBusy(false); go(sid); return; }
    try {
      const r = await payShipment(sid);
      setBusy(false);
      if (r === 'paid') go(sid);
      else notify('Pago cancelado', 'Tu solicitud no se ha enviado. Puedes completar el pago desde Trayectos durante los próximos 30 minutos.');
    } catch (e) {
      setBusy(false);
      notify('No se ha podido pagar', errorText(e));
    }
  };

  return (
    <Screen title="Pago"
      footer={<>
        <Button label={payments ? `Pagar ${euros(t.total)}` : 'Enviar solicitud'} loading={busy} onPress={send} />
        {payments ? <Row style={{ justifyContent: 'center' }} gap={6}><Ionicons name="lock-closed" size={14} color={colors.muted} /><Small>Pago seguro con Stripe. WannaSend nunca ve los datos de tu tarjeta.</Small></Row> : null}
      </>}
    >
      <Steps step={2} of={2} />
      <Card>
        <H3>Detalle del precio</H3>
        <KeyValue k={`Aportación para ${carrier?.name ?? 'el carrier'}`} v={euros(t.pricePerPackage)} />
        <KeyValue k="Gastos de gestión e IVA" v={euros(Math.round((t.total - t.pricePerPackage) * 100) / 100)} />
        <Divider />
        <KeyValue k="Precio total" v={euros(t.total)} bold accent />
        <Small>Los gastos de gestión se destinan a mantener la plataforma y construir una comunidad segura.</Small>
      </Card>
      <Card>
        <H3>Tu paquete</H3>
        <KeyValue k="Tamaño y peso" v={`${p.size} · ${String(p.weightKg).replace('.', ',')} kg`} />
        <KeyValue k="Contenido" v={p.content} />
        <KeyValue k="Destinatario" v={p.recipientName} />
      </Card>
      {payments ? (
        <InfoBox icon="shield-checkmark-outline">
          Cobramos ahora y guardamos el dinero hasta la entrega. Si {carrier?.name ?? 'el carrier'} rechaza la solicitud o no responde en 12 h, te lo devolvemos automáticamente.
        </InfoBox>
      ) : (
        <InfoBox icon="flask-outline" tone="amber">Beta de prueba: todavía no se cobra nada.</InfoBox>
      )}
      {payments ? <Small style={{ textAlign: 'center' }}>Modo prueba: usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.</Small> : null}
    </Screen>
  );
}
