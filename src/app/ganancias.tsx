import { Text, View } from 'react-native';
import { Body, Button, Card, Divider, H3, Row, Screen, Small } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { colors, fonts, radius } from '@/lib/theme';

export default function Ganancias() {
  const { movements, users, withdraw } = useStore();
  const { balance, pending } = useDerived();
  const me = users.me;
  const carried = movements.filter((m) => m.amount > 0).length;

  return (
    <Screen title="Ganancias">
      <View style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: 20, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: fonts.medium, color: colors.white, fontSize: 14 }}>Saldo disponible</Text>
        <Text style={{ fontFamily: fonts.semibold, color: colors.white, fontSize: 40 }}>{euros(balance)}</Text>
        {pending ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryLight, fontSize: 13 }}>{euros(pending)} pendientes de entrega</Text> : null}
        <Button small label="Retirar a mi cuenta" color={colors.primaryDark} style={{ backgroundColor: colors.white, paddingHorizontal: 24, marginTop: 6 }} disabled={balance <= 0}
          onPress={() => { withdraw(balance); notify('Retirada solicitada', `Recibirás ${euros(balance)} en tu cuenta ES•• 4417 en 1–2 días laborables.`); }} />
      </View>
      <Row gap={10}>
        {[[String(carried), 'paquetes llevados'], [String(me.trips), 'trayectos'], [me.rating ? me.rating.toFixed(1).replace('.', ',') : '–', 'valoración']].map(([v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.primaryDark }}>{v}</Text>
            <Small>{l}</Small>
          </View>
        ))}
      </Row>
      <H3>Movimientos</H3>
      <Card style={{ gap: 12 }}>
        {movements.map((m, i) => (
          <View key={m.id} style={{ gap: 12 }}>
            <Row>
              <View style={{ flex: 1 }}><Body style={{ fontFamily: fonts.semibold }}>{m.title}</Body><Small>{m.subtitle}</Small></View>
              <Body style={{ fontFamily: fonts.semibold, color: m.amount > 0 ? colors.primaryDark : colors.text }}>{m.amount > 0 ? '+' : '−'}{euros(Math.abs(m.amount))}</Body>
            </Row>
            {i < movements.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
