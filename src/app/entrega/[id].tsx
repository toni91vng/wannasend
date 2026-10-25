import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, TextInputInstance, View } from 'react-native';
import { Avatar, BigIcon, Button, Card, Divider, H2, H3, InfoBox, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { confirmDelivery } from '@/data/api';
import { useShipment } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { colors, fonts, radius } from '@/lib/theme';

/** Confirmar entrega (carrier): el código se valida en el servidor y se bloquea tras 5 intentos fallidos. */
export default function Entrega() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: sh } = useShipment(id);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<'incorrecto' | 'bloqueado' | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInputInstance>(null);

  if (!sh || !sh.trip) return <Screen title="Entrega"><Loading /></Screen>;
  const t = sh.trip;

  if (sh.status === 'entregado') {
    return (
      <Screen title="Entrega" footer={<Button label="Volver a mi trayecto" onPress={() => router.back()} />}>
        <BigIcon name="checkmark-done" size={120} />
        <H2 style={{ textAlign: 'center' }}>¡Paquete entregado!</H2>
        <Muted style={{ textAlign: 'center' }}>Hemos sumado {euros(sh.carrierAmount)} a tus ganancias y avisado al sender.</Muted>
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    const r = await run(() => confirmDelivery(sh.id, code));
    setBusy(false);
    if (r === 'ok') {
      qc.invalidateQueries({ queryKey: ['shipment', id] });
      qc.invalidateQueries({ queryKey: ['tripShipments'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
    } else if (r) { setResult(r); setCode(''); }
  };
  const locked = result === 'bloqueado';

  return (
    <Screen title="Entrega" subtitle="Pide al destinatario su código de entrega."
      footer={<Button label="Confirmar entrega" loading={busy} disabled={code.length !== 4 || locked} onPress={submit} />}
    >
      <Card style={{ alignItems: 'center' }}>
        <Row style={{ alignSelf: 'stretch' }}>
          <Avatar name={sh.recipientName} />
          <View style={{ flex: 1 }}><H3>Destinatario: {sh.recipientName}</H3><Small>{t.toPoint}</Small></View>
        </Row>
        <Divider />
        <Muted>Código de 4 dígitos</Muted>
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Introducir código">
          <Row gap={12}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: 56, height: 64, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: i === code.length ? 2 : 1, borderColor: result ? colors.danger : i === code.length ? colors.primary : colors.border }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 28 }}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </Row>
        </Pressable>
        <TextInput ref={input} value={code} onChangeText={(v) => { setResult(null); setCode(v.replace(/\D/g, '').slice(0, 4)); }} keyboardType="number-pad" maxLength={4} autoFocus editable={!locked}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} accessibilityLabel="Código de entrega" />
        {result === 'incorrecto' ? <Small style={{ color: colors.danger }}>El código no es correcto. Compruébalo con el destinatario.</Small> : null}
        {locked ? <Small style={{ color: colors.danger, textAlign: 'center' }}>Demasiados intentos fallidos. Hemos bloqueado la entrega por seguridad: escríbenos desde Mensajes → Soporte.</Small> : null}
        <Button variant="secondary" icon="qr-code-outline" label="Escanear QR del destinatario" style={{ alignSelf: 'stretch', borderRadius: radius.pill }}
          onPress={() => notify('Escanear QR', 'Disponible en la siguiente versión. De momento, introduce el código.')} />
      </Card>
      <InfoBox icon="wallet-outline">Al confirmar, se suman {euros(sh.carrierAmount)} a tus ganancias y el sender recibe un aviso de entrega.</InfoBox>
    </Screen>
  );
}
