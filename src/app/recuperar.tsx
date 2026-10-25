import { router } from 'expo-router';
import { useState } from 'react';
import { BigIcon, Button, Field, InfoBox, Screen } from '@/components/ui';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <Screen title="Contraseña" subtitle="Escribe tu email y te enviaremos un enlace para crear una nueva.">
      <BigIcon name="mail-outline" />
      <Field label="Email" icon="mail-outline" placeholder="tu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {sent ? <InfoBox icon="checkmark-circle-outline">Si existe una cuenta con {email}, recibirás el enlace en unos minutos.</InfoBox> : null}
      <Button label={sent ? 'Reenviar enlace' : 'Enviar enlace'} disabled={!/^\S+@\S+\.\S+$/.test(email)} onPress={() => setSent(true)} />
      <Button variant="ghost" label="¿Ya la recuerdas? Inicia sesión" onPress={() => router.back()} />
    </Screen>
  );
}
