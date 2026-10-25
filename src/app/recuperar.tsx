import { router } from 'expo-router';
import { useState } from 'react';
import { BigIcon, Button, ErrorBox, Field, InfoBox, Screen } from '@/components/ui';
import { resetPassword } from '@/data/api';
import { errorText } from '@/lib/supabase';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true); setError('');
    try { await resetPassword(email.trim().toLowerCase()); setSent(true); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Screen title="Contraseña" subtitle="Escribe tu email y te enviaremos un enlace para crear una nueva.">
      <BigIcon name="mail-outline" />
      <Field label="Email" icon="mail-outline" placeholder="tu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {sent ? <InfoBox icon="checkmark-circle-outline">Si existe una cuenta con {email.trim()}, recibirás el enlace en unos minutos.</InfoBox> : null}
      {error ? <ErrorBox text={error} /> : null}
      <Button label={sent ? 'Reenviar enlace' : 'Enviar enlace'} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} onPress={send} />
      <Button variant="ghost" label="¿Ya la recuerdas? Inicia sesión" onPress={() => router.back()} />
    </Screen>
  );
}
