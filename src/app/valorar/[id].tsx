import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Avatar, BigIcon, Button, Field, H2, Muted, Row, Screen } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { colors } from '@/lib/theme';

export default function Valorar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipments, rate } = useStore();
  const { trip, user } = useDerived();
  const sh = shipments.find((s) => s.id === id)!;
  const c = user(trip(sh.tripId)!.carrierId);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Screen title="Valorar" back={false} footer={<Button label="Volver al inicio" onPress={() => { router.dismissAll(); router.navigate('/trayectos'); }} />}>
        <BigIcon name="heart-outline" size={110} />
        <H2 style={{ textAlign: 'center' }}>Gracias por valorar el envío</H2>
        <Muted style={{ textAlign: 'center' }}>¡Tu experiencia nos ayuda a todos a mejorar!</Muted>
      </Screen>
    );
  }

  return (
    <Screen title="Valorar"
      footer={<>
        <Button label="Enviar valoración" disabled={!stars} onPress={() => { rate(sh.id, c.id, stars, text.trim()); setDone(true); }} />
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
      <Field label={`Deja una opinión a ${c.name}`} multiline value={text} onChangeText={setText} placeholder="¿Qué tal la comunicación, la puntualidad…?" textAlignVertical="top" />
    </Screen>
  );
}
