import { router, useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';
import { BigIcon, Button, Muted, Screen } from '@/components/ui';
import { useDerived } from '@/data/store';
import { longDate } from '@/lib/format';

export default function Publicado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip } = useDerived();
  const t = trip(id)!;
  return (
    <Screen title="¡Publicado!" back={false}
      footer={<>
        <Button label="Ver mi trayecto" onPress={() => router.replace(`/mi-trayecto/${t.id}`)} />
        <Button variant="secondary" label="Compartir trayecto" icon="share-social-outline"
          onPress={() => Share.share({ message: `Voy de ${t.from} a ${t.to} el ${longDate(t.date)}. ¿Necesitas enviar algo? Búscame en WannaSend.` })} />
      </>}
    >
      <BigIcon name="checkmark" size={120} />
      <Muted style={{ textAlign: 'center', fontSize: 16, lineHeight: 23 }}>
        Tu trayecto {t.from} → {t.to} ya está visible. Te avisaremos cuando un sender te envíe una solicitud.
      </Muted>
    </Screen>
  );
}
