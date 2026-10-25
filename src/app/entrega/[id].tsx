import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, TextInputInstance, View } from 'react-native';
import { Avatar, BigIcon, Button, Card, Divider, H2, H3, InfoBox, Muted, Row, Screen, Small } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { colors, fonts, radius } from '@/lib/theme';

/** Confirmar entrega (carrier): código de 4 dígitos del destinatario. */
export default function Entrega() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipments, confirmDelivery } = useStore();
  const { trip } = useDerived();
  const sh = shipments.find((s) => s.id === id)!;
  const t = trip(sh.tripId)!;
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const input = useRef<TextInputInstance>(null);

  if (sh.status === 'entregado') {
    return (
      <Screen title="Entrega" footer={<Button label="Volver a mi trayecto" onPress={() => router.back()} />}>
        <BigIcon name="checkmark-done" size={120} />
        <H2 style={{ textAlign: 'center' }}>¡Paquete entregado!</H2>
        <Muted style={{ textAlign: 'center' }}>Hemos liberado tus {euros(t.pricePerPackage)} y avisado al sender.</Muted>
      </Screen>
    );
  }

  return (
    <Screen title="Entrega" subtitle="Pide al destinatario su código de entrega o escanea su QR."
      footer={<Button label="Confirmar entrega" disabled={code.length !== 4} onPress={() => { const ok = confirmDelivery(sh.id, code); setError(!ok); if (!ok) setCode(''); }} />}
    >
      <Card style={{ alignItems: 'center' }}>
        <Row style={{ alignSelf: 'stretch' }}>
          <Avatar name={sh.recipientName} />
          <View style={{ flex: 1 }}><H3>Destinatario: {sh.recipientName}</H3><Small>{t.toPoint}, {t.to}</Small></View>
        </Row>
        <Divider />
        <Muted>Código de 4 dígitos</Muted>
        <Pressable onPress={() => input.current?.focus()}>
          <Row gap={12}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: 56, height: 64, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: i === code.length ? 2 : 1, borderColor: error ? colors.danger : i === code.length ? colors.primary : colors.border }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 28 }}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </Row>
        </Pressable>
        <TextInput ref={input} value={code} onChangeText={(v) => { setError(false); setCode(v.replace(/\D/g, '').slice(0, 4)); }} keyboardType="number-pad" maxLength={4} autoFocus
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} accessibilityLabel="Código de entrega" />
        {error ? <Small style={{ color: colors.danger }}>El código no es correcto. Compruébalo con el destinatario.</Small> : null}
        <Button variant="secondary" icon="qr-code-outline" label="Escanear QR del destinatario" style={{ alignSelf: 'stretch', borderRadius: radius.pill }}
          onPress={() => notify('Escanear QR', 'El escáner usará la cámara en la app instalada. En esta demo, introduce el código.')} />
      </Card>
      <InfoBox icon="wallet-outline">Al confirmar, se liberan tus {euros(t.pricePerPackage)} y el sender recibe un aviso de entrega.</InfoBox>
      <Small style={{ textAlign: 'center' }}>Demo: el código de este paquete es {sh.deliveryCode}</Small>
    </Screen>
  );
}
