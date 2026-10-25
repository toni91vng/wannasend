import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Divider, EmptyState, H3, Loading, Row, Screen, Small } from '@/components/ui';
import { requestWithdrawal } from '@/data/api';
import { useBalance, useMovements, useMyProfile } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { colors, fonts, radius } from '@/lib/theme';

export default function Ganancias() {
  const qc = useQueryClient();
  const { data: balance } = useBalance();
  const { data: movements } = useMovements();
  const { data: me } = useMyProfile();
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    setBusy(true);
    const amount = await run(requestWithdrawal, 'No se ha podido solicitar la retirada');
    setBusy(false);
    if (amount !== undefined) {
      qc.invalidateQueries({ queryKey: ['balance'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      notify('Retirada registrada', `En la beta las retiradas son de prueba (${euros(amount)}). Con los pagos activos, llegarán a tu cuenta en 1–2 días laborables.`);
    }
  };

  return (
    <Screen title="Ganancias">
      <View style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: 20, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: fonts.medium, color: colors.white, fontSize: 14 }}>Saldo disponible</Text>
        <Text style={{ fontFamily: fonts.semibold, color: colors.white, fontSize: 40 }}>{balance ? euros(balance.available) : '–'}</Text>
        {balance?.pending ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryLight, fontSize: 13 }}>{euros(balance.pending)} pendientes de entrega</Text> : null}
        <Button small label="Retirar a mi cuenta" color={colors.primaryDark} loading={busy} style={{ backgroundColor: colors.white, paddingHorizontal: 24, marginTop: 6 }}
          disabled={!balance || balance.available <= 0} onPress={withdraw} />
      </View>
      {me ? (
        <Row gap={10}>
          {[[String(me.carried), 'paquetes llevados'], [String(me.trips), 'trayectos'], [me.rating ? me.rating.toFixed(1).replace('.', ',') : '–', 'valoración']].map(([v, l]) => (
            <View key={l} style={{ flex: 1, backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.primaryDark }}>{v}</Text>
              <Small>{l}</Small>
            </View>
          ))}
        </Row>
      ) : null}
      <H3>Movimientos</H3>
      {!movements ? <Loading /> : movements.length ? (
        <Card style={{ gap: 12 }}>
          {movements.map((m, i) => (
            <View key={m.id} style={{ gap: 12 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: fonts.semibold }}>{m.description || (m.kind === 'ganancia' ? 'Paquete entregado' : 'Retirada')}</Body>
                  <Small>{new Date(m.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</Small>
                </View>
                <Body style={{ fontFamily: fonts.semibold, color: m.amount > 0 ? colors.primaryDark : colors.text }}>{m.amount > 0 ? '+' : '−'}{euros(Math.abs(m.amount))}</Body>
              </Row>
              {i < movements.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      ) : <EmptyState icon="wallet-outline" title="Aún no tienes movimientos" text="Cuando entregues tu primer paquete como carrier, verás aquí lo que has ganado." />}
    </Screen>
  );
}
