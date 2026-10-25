import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { BigIcon, Button, Checkbox, ErrorBox, Field, H2, Muted, Screen, Small } from '@/components/ui';
import { signUp } from '@/data/api';
import { errorText } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Registro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [news, setNews] = useState(false); // opt-in: desmarcada por defecto (RGPD)
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  const errors = {
    name: !name.trim() ? 'Escribe tu nombre' : '',
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Email no válido' : '',
    pass: pass.length < 8 ? 'Mínimo 8 caracteres' : '',
  };
  const valid = !errors.name && !errors.email && !errors.pass;

  const submit = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true); setError('');
    try {
      const { needsConfirmation } = await signUp(name.trim(), email.trim().toLowerCase(), pass, news);
      if (needsConfirmation) setCheckEmail(true);
      else router.replace('/buscar');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <Screen title="Registro" footer={<Button label="Ir a iniciar sesión" onPress={() => router.replace('/login')} />}>
        <BigIcon name="mail-outline" />
        <H2 style={{ textAlign: 'center' }}>Confirma tu email</H2>
        <Muted style={{ textAlign: 'center' }}>Te hemos enviado un enlace a {email.trim()}. Ábrelo desde el móvil y después inicia sesión.</Muted>
      </Screen>
    );
  }

  return (
    <Screen
      title="Registro"
      subtitle="Bienvenido a la era de los envíos colaborativos."
      footer={
        <>
          <Button label="Regístrate" loading={busy} onPress={submit} />
          <Small style={{ textAlign: 'center', lineHeight: 18 }}>
            Al registrarte aceptas los{' '}
            <Small style={{ color: colors.primaryDark, fontFamily: fonts.semibold }}>Términos</Small> y la{' '}
            <Small style={{ color: colors.primaryDark, fontFamily: fonts.semibold }}>Política de privacidad</Small>.
          </Small>
          <Button variant="ghost" label="Ya estoy registrado. Inicia sesión" onPress={() => router.replace('/login')} />
        </>
      }
    >
      <Field label="Nombre" icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} error={tried ? errors.name : ''} autoComplete="name" maxLength={60} />
      <Field label="Email" icon="mail-outline" placeholder="tu@email.com" value={email} onChangeText={setEmail} error={tried ? errors.email : ''} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field
        label="Contraseña" icon="lock-closed-outline" placeholder="Mínimo 8 caracteres" value={pass} onChangeText={setPass}
        secureTextEntry={!show} error={tried ? errors.pass : ''} autoComplete="new-password"
        right={<Pressable onPress={() => setShow((v) => !v)} accessibilityLabel="Mostrar contraseña"><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>}
      />
      <Checkbox checked={news} onChange={setNews}>
        <Muted>Quiero recibir novedades y promociones de WannaSend.</Muted>
      </Checkbox>
      {error ? <ErrorBox text={error} /> : null}
      <Small>Te pediremos el móvil antes de tu primer envío.</Small>
    </Screen>
  );
}
