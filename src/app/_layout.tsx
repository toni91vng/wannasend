import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NoticeHost } from '@/components/NoticeHost';
import { PaymentsProvider } from '@/components/PaymentsProvider';
import { AppProviders } from '@/data/session';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Lobster_400Regular });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.primary }} />;
  return (
    <SafeAreaProvider>
      <AppProviders>
        <PaymentsProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
          <NoticeHost />
        </PaymentsProvider>
      </AppProviders>
    </SafeAreaProvider>
  );
}
