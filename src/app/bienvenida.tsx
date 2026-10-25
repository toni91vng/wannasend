import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

/** Portada sin log in */
export default function Bienvenida() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, padding: 24, paddingBottom: 24 + insets.bottom }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={52} />
        <Text style={{ fontFamily: fonts.medium, color: colors.white, fontSize: 15, marginTop: 4 }}>Anything anywhere</Text>
        <Text style={{ fontFamily: fonts.medium, color: colors.primaryLight, fontSize: 15, marginTop: 28, textAlign: 'center', lineHeight: 22 }}>
          Envía paquetes con personas que ya hacen ese trayecto, o comparte gastos llevando los de otros.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Button label="Regístrate" variant="secondary" onPress={() => router.push('/registro')} style={{ backgroundColor: colors.white, borderColor: colors.white }} />
        <Button label="Iniciar sesión" variant="secondary" color={colors.white} onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}
