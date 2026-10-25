import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Divider, EmptyState, H3, InfoBox, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { useBalance, useMovements, useMyProfile, usePaymentsEnabled } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { openPayouts, paymentsSupported, payoutStatus } from '@/lib/payments';
import { euros } from '@/lib/pricing';
import { errorText } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';

/** Ganancias del carrier. Stripe envía el dinero a su banco automáticamente cuando el alta de cobros está completa. */
export default function Ganancias() {
  const { data: balance } = useBalance();
  const { data: movements } = useMovements();
  const { data: me } = useMyProfile();
  const { data: payments } = usePaymentsEnabled();
  const status = useQuery({ queryKey: ['payoutStatus'], queryFn: payoutStatus, enabled: !!payments && paymentsSupported });
  const [busy, setBusy] = useState(false);

  const open = async (kind: 'onboarding' | 'dashboard') => {
    setBusy(true);
    try { await openPayouts(kind); } catch (e) { notify('Cobros', errorText(e)); }
    setBusy(false);
    status.refetch();
  };

  return (
    <Screen title="Ganancias">
      <View style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: 20, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: fonts.medium, color: colors.white, fontSize: 14 }}>Ganado con entregas</Text>
        <Text style={{ fontFamily: fonts.semibold, color: colors.white, fontSize: 40 }}>{balance ? euros(balance.available) : '–'}</Text>
        {balance?.pending ? <Text style={{ fontFamily: fonts.medium, color: colors.primaryLight, fontSize: 13 }}>{euros(balance.pending)} más cuando entregues los paquetes aceptados</Text> : null}
      </View>

      {payments ? (
        <Card>
          <Row>
            <Ionicons name={status.data?.ready ? 'checkmark-circle' : 'card-outline'} size={22} color={status.data?.ready ? colors.primary : colors.warning} />
            <H3 style={{ flex: 1 }}>{status.data?.ready ? 'Cobros activados' : 'Configura tus cobros'}</H3>
          </Row>
          {status.isLoading ? <Loading label="Comprobando…" /> : status.data?.ready ? (
            <>
              <Muted>Cuando confirmas una entrega, te transferimos tu parte y Stripe la envía a tu banco automáticamente.</Muted>
              <Button small variant="secondary" label="Ver mis cobros en Stripe" loading={busy} onPress={() => open('dashboard')} />
            </>
          ) : (
            <>
              <Muted>Para recibir el dinero de tus entregas, completa tu alta en Stripe (datos personales y cuenta bancaria). Tarda unos 5 minutos.</Muted>
              <Button small label={status.data?.hasAccount ? 'Continuar el alta' : 'Configurar cobros'} loading={busy} onPress={() => open('onboarding')} />
              <Small>Lo que ganes antes de completarlo se te transferirá en cuanto termines.</Small>
            </>
          )}
        </Card>
      ) : (
        <InfoBox icon="flask-outline" tone="amber">Beta de prueba: los cobros todavía no están activados.</InfoBox>
      )}

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
                  <Body style={{ fontFamily: fonts.semibold }}>{m.description || 'Paquete entregado'}</Body>
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
