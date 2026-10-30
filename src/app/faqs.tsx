import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Card, Divider, H3, Muted, Row, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

const FAQS = [
  ['¿Qué es un carrier y un sender?', 'El sender es quien envía un paquete. El carrier es quien ya hace un trayecto y lo lleva a cambio de una aportación que le ayuda a compartir gastos.'],
  ['¿Cuándo se me cobra?', 'Al enviar la solicitud. El dinero queda retenido y solo se libera al carrier cuando se confirma la entrega. Si el carrier rechaza o no responde en 12 h, te lo devolvemos.'],
  ['¿Cómo se confirma la entrega?', 'El destinatario recibe por WhatsApp o SMS un código de 4 dígitos y un QR. Se lo da al carrier al recibir el paquete. No necesita tener la app.'],
  ['¿Qué no puedo enviar?', 'Dinero, objetos de valor sin declarar, animales, armas, sustancias ilegales, productos inflamables o perecederos sin embalaje adecuado.'],
  ['¿Cómo se calcula el precio?', 'Proponemos una aportación según la distancia, el tamaño y el peso. El carrier puede ajustarla dentro de un rango. El carrier recibe íntegra su aportación; el sender paga además una cuota de servicio (IVA incluido) que mantiene WannaSend.'],
  ['¿Qué pasa si hay un problema?', 'Desde el envío, pulsa "Reportar una incidencia". El pago al carrier queda en pausa hasta que lo resolvamos.'],
];

export default function Faqs() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen title="Preguntas">
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {FAQS.map(([q, a], i) => (
          <View key={q}>
            <Pressable onPress={() => setOpen(open === i ? null : i)} style={{ paddingVertical: 14, gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H3 style={{ flex: 1, fontSize: 15 }}>{q}</H3>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Row>
              {open === i ? <Muted>{a}</Muted> : null}
            </Pressable>
            {i < FAQS.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>
      <Body style={{ textAlign: 'center', color: colors.textSecondary }}>¿No encuentras tu respuesta? Escríbenos desde Mensajes → Soporte WannaSend.</Body>
    </Screen>
  );
}
