import { Alert, Platform } from 'react-native';

/** Alert.alert no hace nada en web; esto funciona en las tres plataformas. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') (globalThis as { alert?: (m: string) => void }).alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
