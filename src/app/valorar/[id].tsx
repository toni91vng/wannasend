import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, BigIcon, Body, Button, Card, Field, H2, H3, InfoBox, Loading, Muted, Rating, Row, Screen, Small } from '@/components/ui';
import { submitReview } from '@/data/api';
import { useProfile, useShipment } from '@/data/hooks';
import { useMe } from '@/data/session';
import { run } from '@/lib/run';
import { colors, fonts } from '@/lib/theme';

const LABELS = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', '¡Genial!'];

/**
 * Valorar un envío entregado. Sirve para los dos lados: el sender valora al carrier y el carrier al sender.
 * Antes de publicar se enseña cómo quedará (doble confirmación): una vez publicada no se puede cambiar.
 */
export default function Valorar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const { data: sh } = useShipment(id);
  const iAmSender = !!sh && sh.senderId === me;
  const { data: other } = useProfile(sh ? (iAmSender ? sh.trip?.carrierId : sh.senderId) : undefined);
  const { data: myProfile } = useProfile(me);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [step, setStep] = useState<'escribir' | 'revisar' | 'hecho'>('escribir');
  const [busy, setBusy] = useState(false);

  if (step === 'hecho') {
    return (
      <Screen title="Valorar" back={false} footer={<Button label="Volver" onPress={() => router.back()} />}>
        <BigIcon name="heart-outline" size={110} />
        <H2 style={{ textAlign: 'center' }}>Gracias por valorar el envío</H2>
        <Muted style={{ textAlign: 'center' }}>Tu valoración ya aparece en el perfil de {other?.name}.</Muted>
      </Screen>
    );
  }
  if (!sh || !other) return <Screen title="Valorar"><Loading /></Screen>;

  const publish = async () => {
    setBusy(true);
    const ok = await run(async () => { await submitReview(id, stars, text.trim()); return true; }, 'No se ha podido publicar la valoración');
    setBusy(false);
    if (!ok) return;
    qc.invalidateQueries({ queryKey: ['reviewed'] });
    qc.invalidateQueries({ queryKey: ['profile', other.id] });
    qc.invalidateQueries({ queryKey: ['reviews', other.id] });
    setStep('hecho');
  };

  if (step === 'revisar') {
    return (
      <Screen title="Revisa tu valoración" subtitle="Así la verán todos en el perfil. Una vez publicada no se puede cambiar."
        footer={<>
          <Button label="Publicar valoración" icon="checkmark" loading={busy} onPress={publish} />
          <Button variant="ghost" label="Editar" onPress={() => setStep('escribir')} />
        </>}
      >
        <Small style={{ textAlign: 'center' }}>En el perfil de {other.name} · {iAmSender ? 'como carrier' : 'como sender'}</Small>
        <Card style={{ gap: 8 }}>
          <Row>
            <Avatar name={myProfile?.name ?? 'Tú'} size={36} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: fonts.semibold }}>{myProfile?.name ?? 'Tú'}</Body>
              <Small>{iAmSender ? 'Envió un paquete' : 'Llevó su paquete'} · ahora</Small>
            </View>
            <Rating value={stars} />
          </Row>
          {text.trim() ? <Body style={{ color: colors.textSecondary }}>{text.trim()}</Body> : <Muted>Sin comentario</Muted>}
        </Card>
        <InfoBox icon="information-circle-outline">Sé concreto y respetuoso: ayuda a otros a decidir con quién envían o llevan paquetes.</InfoBox>
      </Screen>
    );
  }

  return (
    <Screen title="Valorar"
      footer={<>
        <Button label="Continuar" disabled={!stars} onPress={() => setStep('revisar')} />
        <Button variant="ghost" label="Valorar más tarde" onPress={() => router.back()} />
      </>}
    >
      <Avatar name={other.name} size={96} />
      <H2 style={{ textAlign: 'center' }}>
        {iAmSender ? `¿Qué tal ha llevado ${other.name} tu paquete?` : `¿Qué tal ha ido con ${other.name} como sender?`}
      </H2>
      <Row gap={10} style={{ justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} estrellas`} hitSlop={4}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={38} color={colors.primary} />
          </Pressable>
        ))}
      </Row>
      {stars ? <H3 style={{ textAlign: 'center', color: colors.primaryDark }}>{LABELS[stars]}</H3> : null}
      <Field label={`Deja una opinión a ${other.name} (opcional)`} multiline value={text} onChangeText={setText} maxLength={500}
        placeholder={iAmSender ? '¿Qué tal la comunicación, la puntualidad, el cuidado del paquete…?' : '¿El paquete era como lo declaró? ¿Fue puntual en la recogida?'}
        textAlignVertical="top" />
    </Screen>
  );
}
