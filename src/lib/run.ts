import { errorText } from './supabase';
import { notify } from './notify';

/**
 * Ejecuta una acción y muestra el error del servidor de forma legible si falla.
 * `then` permite reaccionar a errores concretos (por ejemplo, llevar a "Verificar identidad").
 */
export async function run<T>(
  fn: () => Promise<T>,
  title = 'No se ha podido completar',
  then?: (message: string) => (() => void) | undefined,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    const msg = errorText(e);
    notify(title, msg);
    then?.(msg)?.();
    return undefined;
  }
}
