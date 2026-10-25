import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorBox, Field, Screen } from '@/components/ui';
import { signIn } from '@/data/api';
import { errorText } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await signIn(email.trim().toLowerCase(), pass);
      router.replace('/buscar');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Iniciar sesión"
      subtitle="Bienvenido a la era de los envíos colaborativos."
      footer={
        <>
          <Button label="Iniciar sesión" loading={busy} disabled={!email || !pass} onPress={submit} />
          <Button variant="ghost" label="Soy nuevo. Regístrate" onPress={() => router.replace('/registro')} />
        </>
      }
    >
      <Field label="Email" icon="mail-outline" placeholder="tu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Contraseña" icon="lock-closed-outline" value={pass} onChangeText={setPass} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      {error ? <ErrorBox text={error} /> : null}
      <Button variant="ghost" label="¿Has olvidado tu contraseña?" onPress={() => router.push('/recuperar')} />
    </Screen>
  );
}
