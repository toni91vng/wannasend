import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

/** Escáner de QR a pantalla completa. Devuelve el texto del primer QR que lee. */
export function QrScanner({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (data: string) => void }) {
  const [perm, requestPerm] = useCameraPermissions();
  const done = useRef(false);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => { done.current = false; }}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? (
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(r) => {
              if (done.current) return;
              done.current = true;
              onScan(r.data);
            }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.white, textAlign: 'center' }}>
              Para escanear el QR del sender necesitamos usar la cámara.
            </Text>
            <Button label="Permitir cámara" onPress={requestPerm} />
          </View>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          {perm?.granted ? <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: colors.white, borderRadius: 16 }} /> : null}
        </View>
        <Pressable onPress={onClose} accessibilityLabel="Cerrar" hitSlop={12}
          style={{ position: 'absolute', top: insets.top + 12, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={26} color={colors.white} />
        </Pressable>
        <Text style={{ position: 'absolute', bottom: insets.bottom + 32, left: 24, right: 24, textAlign: 'center', fontFamily: fonts.medium, fontSize: 15, color: colors.white }}>
          Apunta al QR de recogida que ve el sender en su app
        </Text>
      </View>
    </Modal>
  );
}
