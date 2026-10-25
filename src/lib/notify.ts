import { Alert, Platform } from 'react-native';

type Listener = (title: string, message?: string) => void;
let listener: Listener | null = null;

/** Lo usa <NoticeHost /> para mostrar avisos dentro de la app en web. */
export function setNoticeListener(l: Listener | null) {
  listener = l;
}

/** Alert.alert no funciona en web; allí mostramos un aviso propio dentro de la app. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && listener) listener(title, message);
  else Alert.alert(title, message);
}

/** Compartir texto: hoja nativa en el móvil; en web muestra el mensaje para copiarlo. */
export async function shareText(message: string) {
  if (Platform.OS === 'web') { notify('Mensaje para compartir', message); return; }
  const { Share } = await import('react-native');
  Share.share({ message });
}
