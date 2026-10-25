import { router } from 'expo-router';
import { ProfileView } from '@/components/ProfileView';
import { Card, Divider, MenuRow, Screen } from '@/components/ui';
import { useDerived, useStore } from '@/data/store';
import { euros } from '@/lib/pricing';

export default function Perfil() {
  const { users } = useStore();
  const { balance } = useDerived();
  return (
    <Screen title="Mi perfil" back={false} tabs>
      <ProfileView u={users.me} isMe />
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <MenuRow icon="wallet-outline" label="Mis ganancias" value={euros(balance)} onPress={() => router.push('/ganancias')} />
        <Divider />
        <MenuRow icon="person-outline" label="Editar perfil" onPress={() => router.push('/editar-perfil')} />
        <Divider />
        <MenuRow icon="settings-outline" label="Ajustes" onPress={() => router.push('/ajustes')} />
      </Card>
    </Screen>
  );
}
