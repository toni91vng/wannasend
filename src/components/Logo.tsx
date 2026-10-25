import { Text } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export function Logo({ size = 48, color = colors.white }: { size?: number; color?: string }) {
  return <Text style={{ fontFamily: fonts.brand, fontSize: size, color }}>WannaSend</Text>;
}
