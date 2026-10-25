import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { useSession } from '@/data/session';
import { colors, fonts } from '@/lib/theme';

/** Portada: splash verde con el logo, como en el Figma. */
export default function Portada() {
  const { userId, loading } = useSession();
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => router.replace(userId ? '/buscar' : '/bienvenida'), 900);
    return () => clearTimeout(t);
  }, [userId, loading]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Logo size={52} />
      <Text style={{ fontFamily: fonts.medium, color: colors.white, fontSize: 15, marginTop: 4 }}>Anything anywhere</Text>
      <ActivityIndicator color={colors.white} style={{ position: 'absolute', bottom: 80 }} />
    </View>
  );
}
