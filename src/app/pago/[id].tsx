import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { askFeedback, markShipmentSent } from '@/components/FeedbackHost';
import { useState } from 'react';
import { Button, Card, Divider, H3, InfoBox, KeyValue, Loading, Row, Screen, Small, Steps } from '@/components/ui';
import { NewPackage, requestShipment } from '@/data/api';
import { VALUE_TIERS } from '@/data/types';
import { useAppConfig, useMyVerification, useProfile, useTrip } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { saveCardForShipment } from '@/lib/payments';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/**
 * Paso 2: precio y método de pago.
 * Cobro al aceptar (07/11/2026): el sender guarda su método de pago con el formulario oficial de Stripe (la app
 * nunca ve la tarjeta) y la solicitud llega al carrier. No se cobra nada hasta que el carrier acepta; si rechaza
 * o no responde en 12 h, no se cobra.
 */
export default function Pago() {
  const { id, pkg } = useLocalSearchParams<{ id: string; pkg: string }>();
  const { data: t } = useTrip(id);
  const { data: carrier } = useProfile(t?.carrierId);
  const { data: cfg } = useAppConfig();
  const { data: ver } = useMyVerification();
  const payments = cfg?.paymentsEnabled;
  const [busy, setBusy] = useState(false);
  if (!t || !cfg) return <Screen title="Pago"><Loading /></Screen>;
  const p: NewPackage = JSON.parse(pkg);
  // Todos los senders verifican su identidad una vez, al contratar su primer envío
  const needsIdentity = cfg.senderVerificationEnabled && !ver?.verified;

  const go = (sid: string) => {
    markShipmentSent();
    router.dismissAll();
    router.push(`/envio/${sid}`);
    askFeedback('enviar', { delayMs: 2000 });
  };

  const send = async () => {
    setBusy(true);
    const sid = await run(() => requestShipment(t.id, p), 'No se ha podido crear la solicitud', (msg) => /Verifica tu identidad/.test(msg) ? () => router.push('/verificar') : undefined);
    if (!sid) { setBusy(false); return; }
    if (!payments) { setBusy(false); go(sid); return; }
    try {
      const r = await saveCardForShipment(sid);
      setBusy(false);
      if (r === 'saved') go(sid);
      else notify('Solicitud sin enviar', 'Falta tu método de pago. Puedes añadirlo desde Trayectos durante los próximos 30 minutos.');
    } catch (e) {
      setBusy(false);
      notify('No se ha podido guardar el método de pago', errorText(e));
    }
  };

  return (
    <Screen title="Pago"
      footer={<>
        {needsIdentity
          ? <Button label="Verificar mi identidad" icon="shield-checkmark-outline" onPress={() => router.push('/verificar')} />
          : <Button label={payments ? 'Añadir método de pago y enviar' : 'Enviar solicitud'} loading={busy} onPress={send} />}
        {payments ? <Row style={{ justifyContent: 'center' }} gap={6}><Ionicons name="lock-closed" size={14} color={colors.muted} /><Small>Pago seguro con Stripe. WannaSend nunca ve los datos de tu tarjeta.</Small></Row> : null}
      </>}
    >
      <Steps step={2} of={2} />
      <Card>
        <H3>Detalle del precio</H3>
        <KeyValue k={`Aportación para ${carrier?.name ?? 'el carrier'}`} v={euros(t.pricePerPackage)} />
        <KeyValue k="Cuota de servicio (IVA incluido)" v={euros(Math.round((t.total - t.pricePerPackage) * 100) / 100)} />
        <Divider />
        <KeyValue k="Precio total" v={euros(t.total)} bold accent />
        <Small>La cuota de servicio mantiene WannaSend: pago seguro, verificación de identidad y ayuda si hay una incidencia. El carrier recibe íntegra su aportación.</Small>
      </Card>
      <Card>
        <H3>Tu paquete</H3>
        <KeyValue k="Tamaño y peso" v={`${p.size} · ${String(p.weightKg).replace('.', ',')} kg`} />
        <KeyValue k="Valor aproximado (solo lo ves tú)" v={VALUE_TIERS.find((v) => v.id === p.valueTier)?.label ?? ''} />
        <KeyValue k="Contenido" v={p.content} />
        <KeyValue k="Se lo entrega a" v={p.recipientName} />
      </Card>
      {needsIdentity ? (
        <Card>
          <H3>Verifica tu identidad para continuar</H3>
          <Small>Para oficializar el envío, {carrier?.name ?? 'el carrier'} y tú tenéis la identidad verificada. Se hace una sola vez con Stripe y tarda 2 minutos. WannaSend nunca ve tu DNI.</Small>
        </Card>
      ) : null}
      {payments ? (
        <InfoBox icon="shield-checkmark-outline">
          Ahora no te cobramos nada ni te bloqueamos dinero. Solo te cobraremos {euros(t.total)} si {carrier?.name ?? 'el carrier'} acepta; si rechaza la solicitud o no responde en 12 h, no pagas nada. Guardamos el dinero hasta la entrega.
        </InfoBox>
      ) : (
        <InfoBox icon="flask-outline" tone="amber">Beta de prueba: todavía no se cobra nada.</InfoBox>
      )}
      {payments ? <Small style={{ textAlign: 'center' }}>Modo prueba: usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.</Small> : null}
    </Screen>
  );
}
