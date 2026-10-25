import { router } from 'expo-router';
import { useState } from 'react';
import { Avatar, Button, Field, Screen, Small } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/notify';

export default function EditarPerfil() {
  const { users, updateMe } = useStore();
  const [name, setName] = useState(users.me.name);
  const [bio, setBio] = useState(users.me.bio);
  return (
    <Screen title="Editar perfil" footer={<Button label="Guardar" disabled={!name.trim()} onPress={() => { updateMe({ name: name.trim(), bio }); router.back(); }} />}>
      <Avatar name={name || '?'} size={96} />
      <Button variant="ghost" label="Editar foto de perfil" onPress={() => notify('Foto de perfil', 'Podrás elegir una foto de la galería en la app instalada.')} />
      <Field label="Nombre" value={name} onChangeText={setName} />
      <Field label="Sobre ti" value={bio} onChangeText={setBio} multiline placeholder="Cuéntales a los demás quién eres y qué trayectos haces." />
      <Small>Una buena presentación genera confianza y consigue más solicitudes.</Small>
    </Screen>
  );
}
