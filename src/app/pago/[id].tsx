import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Button, Card, Checkbox, Divider, Field, H3, InfoBox, KeyValue, Muted, Row, Screen, Small, Steps } from '@/components/ui';
import { NewPackage, useDerived, useStore } from '@/data/store';
import { breakdown, euros } from '@/lib/pricing';
import { colors, fonts, radius } from '@/lib/theme';

type Method = 'PayPal' | 'Google Pay' | 'Tarjeta bancaria';
const METHODS: { m: Method; sub?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { m: 'PayPal', icon: 'logo-paypal' },
  { m: 'Google Pay', icon: 'logo-google' },
  { m: 'Tarjeta bancaria', sub: 'Mastercard, Visa', icon: 'card-outline' },
];

/** Paso 2: detalle del precio y método de pago. El importe queda retenido hasta que el carrier responda. */
export default function Pago() {
  const { id, pkg } = useLocalSearchParams<{ id: string; pkg: string }>();
  const { trip, user } = useDerived();
  const { requestShipment } = useStore();
  const t = trip(id)!;
  const carrier = user(t.carrierId);
  const p: NewPackage = JSON.parse(pkg);
  const b = breakdown(t.pricePerPackage);

  const [method, setMethod] = useState<Method>('Tarjeta bancaria');
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvv: '' });
  const [save, setSave] = useState(true);
  const [paying, setPaying] = useState(false);
  const cardOk = method !== 'Tarjeta bancaria' || (card.number.replace(/\D/g, '').length >= 15 && card.name && /^\d\d\/\d\d$/.test(card.exp) && card.cvv.length >= 3);

  const pay = () => {
    setPaying(true);
    setTimeout(() => { // simulación de Stripe
      const sid = requestShipment(t.id, p);
      router.dismissAll();
      router.push(`/envio/${sid}`);
    }, 900);
  };

  return (
    <Screen title="Pago"
      footer={<>
        <Button label={`Pagar ${euros(b.total)}`} disabled={!cardOk} loading={paying} onPress={pay} />
        <Row style={{ justifyContent: 'center' }} gap={6}><Ionicons name="lock-closed" size={14} color={colors.muted} /><Small>Tu pago se realiza de forma completamente segura.</Small></Row>
      </>}
    >
      <Steps step={2} of={2} />
      <Card>
        <H3>Detalle del precio</H3>
        <KeyValue k={`Aportación para ${carrier.name}`} v={euros(b.carrier)} />
        <KeyValue k="Gastos de gestión e IVA" v={euros(b.fees)} />
        <Divider />
        <KeyValue k="Precio total" v={euros(b.total)} bold accent />
        <Small>Los gastos de gestión se destinan a mantener la plataforma y construir una comunidad segura.</Small>
      </Card>
      <InfoBox icon="time-outline">
        El importe queda retenido. Si {carrier.name} rechaza la solicitud o no responde en 12 h, te lo devolvemos automáticamente.
      </InfoBox>
      <Card style={{ gap: 10 }}>
        <H3>Método de pago</H3>
        {METHODS.map(({ m, sub, icon }) => (
          <Pressable key={m} onPress={() => setMethod(m)} accessibilityRole="radio" accessibilityState={{ selected: method === m }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: method === m ? colors.primary : colors.border }}>
            <Ionicons name={icon} size={22} color={colors.primaryDark} />
            <View style={{ flex: 1 }}><Body style={{ fontFamily: fonts.semibold }}>{m}</Body>{sub ? <Small>{sub}</Small> : null}</View>
            <Ionicons name={method === m ? 'radio-button-on' : 'radio-button-off'} size={22} color={method === m ? colors.primary : colors.muted} />
          </Pressable>
        ))}
        {method === 'Tarjeta bancaria' ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Field placeholder="Número de tarjeta" icon="card-outline" keyboardType="number-pad" value={card.number} onChangeText={(v) => setCard({ ...card, number: v })} />
            <Field placeholder="Nombre del titular" value={card.name} onChangeText={(v) => setCard({ ...card, name: v })} />
            <Row gap={10}>
              <Field style={{ flex: 1 }} placeholder="MM/AA" value={card.exp} maxLength={5}
                onChangeText={(v) => setCard({ ...card, exp: v.length === 2 && !v.includes('/') && card.exp.length < 2 ? v + '/' : v })} keyboardType="number-pad" />
              <Field style={{ flex: 1 }} placeholder="CVV" value={card.cvv} maxLength={4} secureTextEntry keyboardType="number-pad" onChangeText={(v) => setCard({ ...card, cvv: v })} />
            </Row>
            <Checkbox checked={save} onChange={setSave}><Muted>Guardar esta tarjeta para la próxima vez</Muted></Checkbox>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
