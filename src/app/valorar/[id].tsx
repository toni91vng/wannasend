import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Avatar, BigIcon, Button, Field, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { submitReview } from '@/data/api';
import { useProfile, useShipment } from '@/data/hooks';
import { run } from '@/lib/run';
import { colors } from '@/lib/theme';

export default function Valorar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: sh } = useShipment(id);
  const { data: c } = useProfile(sh?.trip?.carrierId);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <Screen title="Valorar" back={false} footer={<Button label="Volver al inicio" onPress={() => { router.dismissAll(); router.navigate('/trayectos'); }} />}>
        <BigIcon name="heart-outline" size={110} />
        <H2 style={{ textAlign: 'center' }}>Gracias por valorar el envío</H2>
        <Muted style={{ textAlign: 'center' }}>¡Tu experiencia nos ayuda a todos a mejorar!</Muted>
      </Screen>
    );
  }
  if (!c) return <Screen title="Valorar"><Loading /></Screen>;

  const send = async () => {
    setBusy(true);
    const ok = await run(() => submitReview(id, stars, text.trim()));
    setBusy(false);
    if (ok !== undefined) {
      qc.invalidateQueries({ queryKey: ['reviewed'] });
      qc.invalidateQueries({ queryKey: ['profile', c.id] });
      setDone(true);
    }
  };

  return (
    <Screen title="Valorar"
      footer={<>
        <Button label="Enviar valoración" loading={busy} disabled={!stars} onPress={send} />
        <Button variant="ghost" label="Valorar más tarde" onPress={() => router.back()} />
      </>}
    >
      <Avatar name={c.name} size={96} />
      <H2 style={{ textAlign: 'center' }}>¿Cómo ha ido el envío con {c.name}?</H2>
      <Row gap={10} style={{ justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} estrellas`} hitSlop={4}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={38} color={colors.primary} />
          </Pressable>
        ))}
      </Row>
      <Field label={`Deja una opinión a ${c.name}`} multiline value={text} onChangeText={setText} maxLength={500} placeholder="¿Qué tal la comunicación, la puntualidad…?" textAlignVertical="top" />
    </Screen>
  );
}
