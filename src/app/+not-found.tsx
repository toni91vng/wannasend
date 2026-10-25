import { Redirect } from 'expo-router';

/** Cualquier ruta desconocida vuelve a la portada. */
export default function NotFound() {
  return <Redirect href="/" />;
}
