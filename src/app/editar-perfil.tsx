import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Avatar, Button, Field, Loading, Screen, Small } from '@/components/ui';
import { updateProfile } from '@/data/api';
import { useMyProfile } from '@/data/hooks';
import { useMe } from '@/data/session';
import { run } from '@/lib/run';

export default function EditarPerfil() {
  const me = useMe();
  const qc = useQueryClient();
  const { data: p } = useMyProfile();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (p) { setName(p.name); setBio(p.bio); } }, [p]);
  if (!p) return <Screen title="Editar perfil"><Loading /></Screen>;

  const save = async () => {
    setBusy(true);
    const ok = await run(async () => {
      await updateProfile(me, { name: name.trim(), bio: bio.trim() });
      return true;
    }, 'No se ha podido guardar');
    setBusy(false);
    if (ok) { qc.invalidateQueries({ queryKey: ['profile'] }); router.back(); }
  };

  return (
    <Screen title="Editar perfil" footer={<Button label="Guardar" loading={busy} disabled={!name.trim()} onPress={save} />}>
      <Avatar name={name || '?'} size={96} />
      <Field label="Nombre" value={name} onChangeText={setName} maxLength={60} />
      <Field label="Sobre ti" value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="Cuéntales a los demás quién eres y qué trayectos haces." textAlignVertical="top" />
      <Small>Una buena presentación genera confianza y consigue más solicitudes.</Small>
    </Screen>
  );
}
