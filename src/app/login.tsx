import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Screen } from '@/components/ui';
import { useStore } from '@/data/store';

export default function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('sara@email.com');
  const [pass, setPass] = useState('demo1234');
  return (
    <Screen
      title="Iniciar sesión"
      subtitle="Bienvenido a la era de los envíos colaborativos."
      footer={
        <>
          <Button label="Iniciar sesión" disabled={!email || !pass} onPress={() => { login(); router.replace('/buscar'); }} />
          <Button variant="ghost" label="Soy nuevo. Regístrate" onPress={() => router.replace('/registro')} />
        </>
      }
    >
      <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Contraseña" icon="lock-closed-outline" value={pass} onChangeText={setPass} secureTextEntry />
      <Button variant="ghost" label="¿Has olvidado tu contraseña?" onPress={() => router.push('/recuperar')} />
    </Screen>
  );
}
