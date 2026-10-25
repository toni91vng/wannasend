import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Button, Checkbox, Field, Muted, Screen, Small } from '@/components/ui';
import { useStore } from '@/data/store';
import { colors, fonts } from '@/lib/theme';

export default function Registro() {
  const { login } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [news, setNews] = useState(false); // opt-in: desmarcada por defecto (RGPD)
  const [tried, setTried] = useState(false);

  const errors = {
    name: !name.trim() ? 'Escribe tu nombre' : '',
    email: !/^\S+@\S+\.\S+$/.test(email) ? 'Email no válido' : '',
    pass: pass.length < 8 ? 'Mínimo 8 caracteres' : '',
  };
  const valid = !errors.name && !errors.email && !errors.pass;

  return (
    <Screen
      title="Registro"
      subtitle="Bienvenido a la era de los envíos colaborativos."
      footer={
        <>
          <Button label="Regístrate" onPress={() => { setTried(true); if (valid) { login(name.trim()); router.replace('/buscar'); } }} />
          <Small style={{ textAlign: 'center', lineHeight: 18 }}>
            Al registrarte aceptas los{' '}
            <Small style={{ color: colors.primaryDark, fontFamily: fonts.semibold }}>Términos</Small> y la{' '}
            <Small style={{ color: colors.primaryDark, fontFamily: fonts.semibold }}>Política de privacidad</Small>.
          </Small>
          <Button variant="ghost" label="Ya estoy registrado. Inicia sesión" onPress={() => router.replace('/login')} />
        </>
      }
    >
      <Field label="Nombre" icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} error={tried ? errors.name : ''} autoComplete="name" />
      <Field label="Email" icon="mail-outline" placeholder="tu@email.com" value={email} onChangeText={setEmail} error={tried ? errors.email : ''} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field
        label="Contraseña" icon="lock-closed-outline" placeholder="Mínimo 8 caracteres" value={pass} onChangeText={setPass}
        secureTextEntry={!show} error={tried ? errors.pass : ''}
        right={<Pressable onPress={() => setShow((v) => !v)} accessibilityLabel="Mostrar contraseña"><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>}
      />
      <Checkbox checked={news} onChange={setNews}>
        <Muted>Quiero recibir novedades y promociones de WannaSend.</Muted>
      </Checkbox>
      <Small>Te pediremos el móvil y la fecha de nacimiento para verificar tu cuenta antes de tu primer envío.</Small>
    </Screen>
  );
}
