import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, MenuRow, Screen, Small } from '@/components/ui';
import { signOut } from '@/data/api';
import { notify } from '@/lib/notify';
import { fonts } from '@/lib/theme';

const soon = (what: string) => () => notify(what, 'Disponible en la siguiente versión.');

export default function Ajustes() {
  const section = (title: string, rows: React.ReactNode[]) => (
    <View style={{ gap: 6 }}>
      <Small style={{ fontFamily: fonts.semibold, letterSpacing: 0.5 }}>{title}</Small>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {rows.map((r, i) => <View key={i}>{r}{i < rows.length - 1 ? <Divider /> : null}</View>)}
      </Card>
    </View>
  );
  return (
    <Screen title="Ajustes">
      {section('CUENTA', [
        <MenuRow key="a" label="Editar perfil" onPress={() => router.push('/editar-perfil')} />,
        <MenuRow key="b" label="Verificar identidad" onPress={soon('Verificar identidad')} />,
        <MenuRow key="c" label="Método de cobro" onPress={soon('Método de cobro')} />,
      ])}
      {section('PREFERENCIAS', [
        <MenuRow key="a" label="Notificaciones" onPress={soon('Notificaciones')} />,
        <MenuRow key="b" label="Idioma" value="Español" onPress={soon('Idioma')} />,
      ])}
      {section('AYUDA', [
        <MenuRow key="a" label="Preguntas frecuentes" onPress={() => router.push('/faqs')} />,
        <MenuRow key="b" label="Contactar con soporte" onPress={() => router.push('/incidencia/general')} />,
        <MenuRow key="c" label="Términos y privacidad" onPress={soon('Términos y privacidad')} />,
        <MenuRow key="d" label="Cerrar sesión" danger onPress={async () => { await signOut(); router.dismissAll(); router.replace('/bienvenida'); }} />,
      ])}
    </Screen>
  );
}
