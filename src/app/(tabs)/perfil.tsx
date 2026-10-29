import { router } from 'expo-router';
import { ProfileView } from '@/components/ProfileView';
import { Card, Divider, ErrorBox, Loading, MenuRow, Screen } from '@/components/ui';
import { useBalance, useMyProfile, useMyVerification } from '@/data/hooks';
import { euros } from '@/lib/pricing';
import { errorText } from '@/lib/supabase';

export default function Perfil() {
  const { data: me, isLoading, error, refetch } = useMyProfile();
  const { data: ver } = useMyVerification();
  const { data: balance } = useBalance();
  return (
    <Screen title="Mi perfil" back={false} tabs>
      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox text={errorText(error)} onRetry={() => refetch()} /> : null}
      {me ? <ProfileView u={me} isMe /> : null}
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <MenuRow icon="wallet-outline" label="Mis ganancias" value={balance ? euros(balance.available) : undefined} onPress={() => router.push('/ganancias')} />
        <Divider />
        <MenuRow icon="shield-checkmark-outline" label="Verificar identidad" value={ver?.verified ? 'Verificada' : ver?.identityStatus === 'pendiente' ? 'En revisión' : 'Pendiente'} onPress={() => router.push('/verificar')} />
        <Divider />
        <MenuRow icon="person-outline" label="Editar perfil" onPress={() => router.push('/editar-perfil')} />
        <Divider />
        <MenuRow icon="settings-outline" label="Ajustes" onPress={() => router.push('/ajustes')} />
      </Card>
    </Screen>
  );
}
