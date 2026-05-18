import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { QuoteForm } from '@/components/QuoteForm';

type Variant = 'solid' | 'light' | 'outline';

// "Get a Quote" button that opens the detailed quote form in a modal.
export function QuoteButton({
  label = 'Get a Quote',
  variant = 'solid',
  big = false,
}: {
  label?: string;
  variant?: Variant;
  big?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatedPressable
        onPress={() => setOpen(true)}
        style={[
          big ? styles.btnBig : styles.btn,
          variant === 'solid' && styles.solid,
          variant === 'light' && styles.light,
          variant === 'outline' && styles.outline,
        ]}
      >
        <Text
          style={[
            big ? styles.btnBigText : styles.btnText,
            variant === 'solid' ? styles.textLight : styles.textDark,
          ]}
        >
          {label}
        </Text>
      </AnimatedPressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.title}>Get a quote</Text>
                <Text style={styles.sub}>A few details and we&apos;ll send pricing.</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollInner}
              showsVerticalScrollIndicator={false}
            >
              <QuoteForm />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnBig: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnText: { fontSize: 14, fontWeight: '800' },
  btnBigText: { fontSize: 17, fontWeight: '800' },
  textLight: { color: '#fff' },
  textDark: { color: theme.colors.charcoal },
  solid: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  light: { backgroundColor: '#fff', borderColor: '#fff' },
  outline: { backgroundColor: 'transparent', borderColor: theme.colors.border },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 26, color: theme.colors.charcoal, lineHeight: 26 },
  scroll: { maxHeight: 460 },
  scrollInner: { padding: 18, paddingTop: 12 },
});
