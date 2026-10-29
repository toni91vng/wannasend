import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BigIcon, Body, Button, Card, H2, H3, InfoBox, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { useMyVerification } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { identityStatus, verifyIdentity } from '@/lib/payments';
import { errorText } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const STEPS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'card-outline', text: 'Haz una foto de tu DNI, NIE o pasaporte.' },
  { icon: 'happy-outline', text: 'Hazte un selfie para comprobar que eres tú.' },
  { icon: 'shield-checkmark-outline', text: 'Stripe lo comprueba en unos minutos y tu perfil muestra «Identidad verificada».' },
];

/**
 * Verificar identidad (una vez por persona; sirve como sender y como carrier).
 * El proceso ocurre en la web de Stripe: WannaSend solo recibe si está verificado o no.
 */
export default function Verificar() {
  const qc = useQueryClient();
  const { data: ver, isLoading, refetch } = useMyVerification();
  const [busy, setBusy] = useState(false);

  // Al volver de Stripe (o al abrir la pantalla), consulta el resultado
  useEffect(() => {
    if (ver?.identityStatus === 'pendiente') identityStatus().then(() => refetch()).catch(() => undefined);
  }, [ver?.identityStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true);
    try {
      await verifyIdentity();
    } catch (e) {
      notify('Verificación', errorText(e));
    }
    setBusy(false);
    await refetch();
    qc.invalidateQueries({ queryKey: ['profile'] });
  };
  const check = async () => {
    setBusy(true);
    try { await identityStatus(); } catch { /* se reintenta luego */ }
    await refetch();
    setBusy(false);
  };

  if (isLoading || !ver) return <Screen title="Verificar identidad"><Loading /></Screen>;

  if (ver.verified) {
    return (
      <Screen title="Verificar identidad" footer={<Button label="Continuar" onPress={() => router.back()} />}>
        <BigIcon name="shield-checkmark" />
        <H2 style={{ textAlign: 'center' }}>Identidad verificada</H2>
        <Muted style={{ textAlign: 'center' }}>Ya puedes enviar y llevar paquetes. Tu perfil muestra la insignia de verificado.</Muted>
      </Screen>
    );
  }

  const pending = ver.identityStatus === 'pendiente';
  const failed = ver.identityStatus === 'fallido';

  return (
    <Screen title="Verificar identidad" subtitle="Una sola vez. Tarda unos 2 minutos."
      footer={pending
        ? <Button label="Comprobar de nuevo" icon="refresh" loading={busy} onPress={check} />
        : <Button label={failed ? 'Intentarlo de nuevo' : 'Verificar con Stripe'} icon="shield-checkmark-outline" loading={busy} onPress={start} />}
    >
      {pending ? (
        <InfoBox icon="time-outline" tone="amber">Estamos comprobando tus datos. Si ya terminaste en Stripe, en unos minutos estará listo.</InfoBox>
      ) : null}
      {failed ? (
        <InfoBox icon="alert-circle-outline" tone="amber">No hemos podido verificarte. Suele pasar si la foto está borrosa o con reflejos. Prueba de nuevo con buena luz.</InfoBox>
      ) : null}
      <Card>
        <H3>Cómo funciona</H3>
        {STEPS.map((s) => (
          <Row key={s.text} gap={12} style={{ alignItems: 'flex-start' }}>
            <Ionicons name={s.icon} size={22} color={colors.primary} />
            <Body style={{ flex: 1 }}>{s.text}</Body>
          </Row>
        ))}
      </Card>
      <Card>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Ionicons name="lock-closed" size={20} color={colors.primaryDark} />
          <View style={{ flex: 1, gap: 4 }}>
            <H3>WannaSend nunca ve tu DNI</H3>
            <Muted>La verificación la hace Stripe, la plataforma de pagos que usan millones de empresas. Nosotros solo recibimos si estás verificado o no.</Muted>
          </View>
        </Row>
      </Card>
      <Card>
        <H3>¿Por qué lo pedimos?</H3>
        <Muted>Para que todo envío quede oficializado: senders y carriers están verificados, así cada uno sabe con quién trata.</Muted>
      </Card>
      <Small style={{ textAlign: 'center' }}>Al continuar aceptas que Stripe trate tu documento y tu selfie para verificar tu identidad, según su política de privacidad.</Small>
    </Screen>
  );
}
