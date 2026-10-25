import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, MenuRow, Screen, Small } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/notify';

const soon = (what: string) => () => notify(what, 'Disponible en la siguiente versión.');

export default function Ajustes() {
  const { logout } = useStore();
  const section = (title: string, rows: React.ReactNode[]) => (
    <View style={{ gap: 6 }}>
      <Small style={{ fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>{title}</Small>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {rows.map((r, i) => <View key={i}>{r}{i < rows.length - 1 ? <Divider /> : null}</View>)}
      </Card>
    </View>
  );
  return (
    <Screen title="Ajustes">
      {section('CUENTA', [
        <MenuRow key="a" label="Editar perfil" onPress={() => router.push('/editar-perfil')} />,
        <MenuRow key="b" label="Verificar identidad" value="Verificado" onPress={soon('Verificar identidad')} />,
        <MenuRow key="c" label="Método de cobro" value="ES•• 4417" onPress={soon('Método de cobro')} />,
        <MenuRow key="d" label="Métodos de pago" value="Visa •• 2201" onPress={soon('Métodos de pago')} />,
      ])}
      {section('PREFERENCIAS', [
        <MenuRow key="a" label="Notificaciones" onPress={soon('Notificaciones')} />,
        <MenuRow key="b" label="Idioma" value="Español" onPress={soon('Idioma')} />,
        <MenuRow key="c" label="Privacidad" onPress={soon('Privacidad')} />,
      ])}
      {section('AYUDA', [
        <MenuRow key="a" label="Preguntas frecuentes" onPress={() => router.push('/faqs')} />,
        <MenuRow key="b" label="Términos y privacidad" onPress={soon('Términos y privacidad')} />,
        <MenuRow key="c" label="Cerrar sesión" danger onPress={() => { logout(); router.dismissAll(); router.replace('/bienvenida'); }} />,
      ])}
    </Screen>
  );
}
