import { router, useLocalSearchParams } from 'expo-router';
import { BigIcon, Button, Loading, Muted, Screen } from '@/components/ui';
import { useTrip } from '@/data/hooks';
import { longDate } from '@/lib/format';
import { shareText } from '@/lib/notify';

export default function Publicado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t } = useTrip(id);
  if (!t) return <Screen title="¡Publicado!" back={false}><Loading /></Screen>;
  return (
    <Screen title="¡Publicado!" back={false}
      footer={<>
        <Button label="Ver mi trayecto" onPress={() => router.replace(`/mi-trayecto/${t.id}`)} />
        <Button variant="secondary" label="Compartir trayecto" icon="share-social-outline"
          onPress={() => shareText(`Voy de ${t.from} a ${t.to} el ${longDate(t.date)}. ¿Necesitas enviar algo? Búscame en WannaSend.`)} />
      </>}
    >
      <BigIcon name="checkmark" size={120} />
      <Muted style={{ textAlign: 'center', fontSize: 16, lineHeight: 23 }}>
        Tu trayecto {t.from} → {t.to} ya está visible. Te avisaremos cuando un sender te envíe una solicitud.
      </Muted>
    </Screen>
  );
}
