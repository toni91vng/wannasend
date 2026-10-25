import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { BigIcon, Body, Button, Card, Field, H2, H3, Muted, Row, Screen } from '@/components/ui';
import { report } from '@/data/api';
import { useShipment } from '@/data/hooks';
import { run } from '@/lib/run';
import { colors } from '@/lib/theme';

const SHIPMENT_REASONS = ['El carrier no se presentó', 'El paquete ha llegado dañado', 'El paquete no ha llegado', 'Problema con el pago', 'Otro motivo'];
const GENERAL_REASONS = ['Problema con mi cuenta', 'Error en la app', 'Sugerencia', 'Otro motivo'];

/** Incidencia de un envío, o contacto general con soporte (id = "general"). */
export default function Incidencia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const general = id === 'general';
  const { data: sh } = useShipment(general ? undefined : id);
  const [reason, setReason] = useState<string>();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const reasons = general ? GENERAL_REASONS : SHIPMENT_REASONS;

  if (sent) {
    return (
      <Screen title={general ? 'Soporte' : 'Incidencia'} footer={<Button label="Volver" onPress={() => router.back()} />}>
        <BigIcon name="chatbubble-ellipses-outline" size={110} />
        <H2 style={{ textAlign: 'center' }}>Hemos recibido tu mensaje</H2>
        <Muted style={{ textAlign: 'center' }}>Te responderemos en menos de 24 h.</Muted>
      </Screen>
    );
  }

  const send = async () => {
    setBusy(true);
    const ok = await run(() => report({ shipmentId: general ? undefined : id, reason: reason!, details: text }));
    setBusy(false);
    if (ok !== undefined) setSent(true);
  };

  return (
    <Screen title={general ? 'Soporte' : 'Incidencia'} subtitle={sh?.trip ? `${sh.trip.from} → ${sh.trip.to}` : general ? '¿En qué podemos ayudarte?' : undefined}
      footer={<Button label="Enviar" loading={busy} disabled={!reason || (reason === 'Otro motivo' && !text.trim())} onPress={send} />}
    >
      <Card style={{ gap: 4 }}>
        <H3 style={{ marginBottom: 6 }}>{general ? 'Motivo' : '¿Qué ha pasado?'}</H3>
        {reasons.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }}>
            <Row gap={12} style={{ paddingVertical: 10 }}>
              <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={22} color={reason === r ? colors.primary : colors.muted} />
              <Body>{r}</Body>
            </Row>
          </Pressable>
        ))}
      </Card>
      <Field label="Cuéntanos más" multiline value={text} onChangeText={setText} placeholder="Describe lo que ha pasado" textAlignVertical="top" maxLength={2000} />
    </Screen>
  );
}
