import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

// Valores públicos por diseño: la clave publicable solo permite lo que dejan las políticas RLS.
export const SUPABASE_URL = 'https://ublutvpumxtdiuvqbbfa.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_VCUezw1llA6EzD4__96Kmg_ylWumdX5';
// Clave publicable de Stripe (modo prueba). Es pública por diseño; la secreta vive solo en el servidor.
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_PENDIENTE';

/**
 * Sesión cifrada en el móvil: la clave AES vive en el almacén seguro del sistema (Keychain/Keystore)
 * y el token cifrado en AsyncStorage (SecureStore no admite valores de más de 2 KB).
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }
  private async decrypt(key: string, value: string) {
    const keyHex = await SecureStore.getItemAsync(key);
    if (!keyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }
  async getItem(key: string) {
    const v = await AsyncStorage.getItem(key);
    return v ? this.decrypt(key, v) : null;
  }
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, await this.encrypt(key, value));
  }
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

const webStorage = {
  getItem: (k: string) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  setItem: (k: string, v: string) => { try { globalThis.localStorage?.setItem(k, v); } catch { /* sin almacenamiento */ } },
  removeItem: (k: string) => { try { globalThis.localStorage?.removeItem(k); } catch { /* sin almacenamiento */ } },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresca el token solo con la app en primer plano (recomendación de Supabase para móvil)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensaje legible a partir de un error de Supabase o de las funciones del servidor. */
export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con este email.';
  if (/Password should be/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/Failed to fetch|Network request failed/i.test(msg)) return 'Sin conexión. Revisa tu internet.';
  return msg;
}
