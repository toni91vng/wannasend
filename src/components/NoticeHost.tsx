import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { setNoticeListener } from '@/lib/notify';
import { colors, fonts, radius } from '@/lib/theme';

/** Diálogo simple para web (sustituye a Alert.alert). */
export function NoticeHost() {
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null);
  useEffect(() => {
    setNoticeListener((title, message) => setNotice({ title, message }));
    return () => setNoticeListener(null);
  }, []);
  return (
    <Modal transparent visible={!!notice} animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.md, padding: 20, gap: 10, width: '100%', maxWidth: 360 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.text }}>{notice?.title}</Text>
          {notice?.message ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textSecondary }}>{notice.message}</Text> : null}
          <Pressable onPress={() => setNotice(null)} style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.primaryDark }}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
