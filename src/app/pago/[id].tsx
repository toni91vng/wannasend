import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Divider, H3, InfoBox, KeyValue, Loading, Screen, Small, Steps } from '@/components/ui';
import { NewPackage, requestShipment, setMyPhone } from '@/data/api';
import { useProfile, useTrip } from '@/data/hooks';
import { useMe } from '@/data/session';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';

/**
 * Paso 2: precio y confirmación.
 * Fase 1 (beta sin pagos): la solicitud se envía sin cobrar. En la fase 2 aquí se abre el formulario seguro de Stripe
 * y el importe queda retenido; la app nunca ve los datos de la tarjeta.
 */
export default function Pago() {
  const { id, pkg, myPhone } = useLocalSearchParams<{ id: string; pkg: string; myPhone?: string }>();
  const me = useMe();
  const { data: t } = useTrip(id);
  const { data: carrier } = useProfile(t?.carrierId);
  const [busy, setBusy] = useState(false);
  if (!t) return <Screen title="Confirmar"><Loading /></Screen>;
  const p: NewPackage = JSON.parse(pkg);

  const send = async () => {
    setBusy(true);
    const sid = await run(async () => {
      if (myPhone) await setMyPhone(me, myPhone);
      return requestShipment(t.id, p);
    }, 'No se ha podido enviar la solicitud');
    setBusy(false);
    if (sid) { router.dismissAll(); router.push(`/envio/${sid}`); }
  };

  return (
    <Screen title="Confirmar" footer={<Button label="Enviar solicitud" loading={busy} onPress={send} />}>
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
      <InfoBox icon="flask-outline" tone="amber">
        Beta de prueba: todavía no se cobra nada. Cuando activemos los pagos, el importe quedará retenido y se devolverá si el carrier rechaza o no responde en 12 h.
      </InfoBox>
    </Screen>
  );
}
