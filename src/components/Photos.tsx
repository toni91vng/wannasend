import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { photoUrl, uploadPackagePhoto } from '@/data/api';
import { notify } from '@/lib/notify';
import { errorText } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';
import { Button, Row, Small } from './ui';

/**
 * Hacer o elegir una foto del paquete y subirla. La foto se reduce y pierde la ubicación GPS antes de subirse.
 * Devuelve la ruta en el almacenamiento privado mediante onChange.
 */
export function PhotoPicker({ value, onChange, label = 'Foto del paquete', hint }: {
  value?: string; onChange: (path: string | undefined) => void; label?: string; hint?: string;
}) {
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);

  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permiso necesario', camera ? 'Activa el acceso a la cámara en los ajustes del móvil.' : 'Activa el acceso a tus fotos en los ajustes del móvil.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      setBusy(true);
      const uri = res.assets[0].uri;
      const path = await uploadPackagePhoto(uri);
      setPreview(uri);
      onChange(path);
    } catch (e) {
      notify('No se ha podido subir la foto', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      {value && preview ? (
        <View>
          <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: colors.surface }} accessibilityLabel={label} />
          <Pressable onPress={() => { onChange(undefined); setPreview(undefined); }} accessibilityLabel="Quitar foto"
            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 6 }}>
            <Ionicons name="close" size={18} color={colors.white} />
          </Pressable>
        </View>
      ) : busy ? (
        <View style={{ height: 120, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ActivityIndicator color={colors.primary} />
          <Small>Subiendo foto…</Small>
        </View>
      ) : (
        <Row gap={10}>
          <Button small variant="secondary" icon="camera-outline" label="Hacer foto" style={{ flex: 1 }} onPress={() => pick(true)} />
          <Button small variant="neutral" icon="image-outline" label="Galería" style={{ flex: 1 }} onPress={() => pick(false)} />
        </Row>
      )}
      {hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

/** Muestra una foto privada de un envío (enlace temporal). */
export function PackagePhoto({ path, height = 180 }: { path?: string | null; height?: number }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['photo', path], queryFn: () => photoUrl(path!), enabled: !!path, staleTime: 50 * 60_000 });
  if (!path) return null;
  if (isLoading) return <View style={{ height, borderRadius: radius.sm, backgroundColor: colors.surface }} />;
  if (!url) return <Small>Foto no disponible.</Small>;
  return <Image source={{ uri: url }} style={{ width: '100%', height, borderRadius: radius.sm, backgroundColor: colors.surface }} resizeMode="cover" accessibilityLabel="Foto del paquete" />;
}

/** Insignia "Identidad verificada" / "Sin verificar". */
export function VerifiedBadge({ verified, compact }: { verified?: boolean; compact?: boolean }) {
  if (verified === undefined) return null;
  const color = verified ? colors.primaryDark : colors.textSecondary;
  return (
    <Row gap={4} style={{ alignSelf: 'flex-start' }}>
      <Ionicons name={verified ? 'shield-checkmark' : 'shield-outline'} size={14} color={color} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color }}>{verified ? (compact ? 'Verificado' : 'Identidad verificada') : 'Sin verificar'}</Text>
    </Row>
  );
}
