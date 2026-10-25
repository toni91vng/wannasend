import { errorText } from './supabase';
import { notify } from './notify';

/** Ejecuta una acción y muestra el error del servidor de forma legible si falla. */
export async function run<T>(fn: () => Promise<T>, title = 'No se ha podido completar'): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    notify(title, errorText(e));
    return undefined;
  }
}
