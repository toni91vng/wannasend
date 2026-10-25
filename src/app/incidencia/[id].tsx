import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { BigIcon, Body, Button, Card, Field, H2, H3, Muted, Row, Screen } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { notify } from '@/lib/notify';
import { colors, radius } from '@/lib/theme';

const REASONS = ['El carrier no se presentó', 'El paquete ha llegado dañado', 'El paquete no ha llegado', 'Problema con el pago', 'Otro motivo'];

export default function Incidencia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipments } = useStore();
  const { trip, user } = useDerived();
  const sh = shipments.find((s) => s.id === id)!;
  const t = trip(sh.tripId)!;
  const [reason, setReason] = useState<string>();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Screen title="Incidencia" footer={<Button label="Volver" onPress={() => router.back()} />}>
        <BigIcon name="chatbubble-ellipses-outline" size={110} />
        <H2 style={{ textAlign: 'center' }}>Hemos recibido tu incidencia</H2>
        <Muted style={{ textAlign: 'center' }}>Te responderemos por Mensajes en menos de 24 h. Mientras, el pago al carrier queda en pausa.</Muted>
      </Screen>
    );
  }

  return (
    <Screen title="Incidencia" subtitle={`Envío con ${user(t.carrierId).name} · ${t.from} → ${t.to}`}
      footer={<Button label="Enviar incidencia" disabled={!reason} onPress={() => setSent(true)} />}
    >
      <Card style={{ gap: 4 }}>
        <H3 style={{ marginBottom: 6 }}>¿Qué ha pasado?</H3>
        {REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }}>
            <Row gap={12} style={{ paddingVertical: 10 }}>
              <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={22} color={reason === r ? colors.primary : colors.muted} />
              <Body>{r}</Body>
            </Row>
          </Pressable>
        ))}
      </Card>
      <Field label="Cuéntanos más" multiline value={text} onChangeText={setText} placeholder="Describe lo que ha pasado" textAlignVertical="top" />
      <Button variant="secondary" label="+ Añadir fotos" style={{ borderStyle: 'dashed', borderRadius: radius.sm }}
        onPress={() => notify('Añadir fotos', 'Podrás adjuntar fotos desde la galería en la app instalada.')} />
    </Screen>
  );
}
