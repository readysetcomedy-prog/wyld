import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@/lib/theme';

export async function pickColorViaDialog(initial: string): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = /^#[0-9a-f]{6}$/i.test(initial) ? initial : '#000000';
    let done = false;
    input.addEventListener('change', () => {
      done = true;
      resolve(input.value);
    });
    // No reliable cancel signal on color inputs; if the user dismisses,
    // the promise just stays unresolved — fine for one-shot UI.
    setTimeout(() => {
      if (!done) {
        // Trigger click after attach so 'cancel' on some browsers
        // can be observed via 'blur'.
      }
    }, 0);
    input.click();
  });
}

export async function pickColorViaEyeDropper(): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  const W = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
  if (typeof W.EyeDropper === 'undefined') return null;
  try {
    const r = await new W.EyeDropper().open();
    return r.sRGBHex;
  } catch {
    return null;
  }
}

export function isEyeDropperSupported() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return typeof (window as unknown as { EyeDropper?: unknown }).EyeDropper !== 'undefined';
}

export function ColorPickerField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const eyedropSupported = isEyeDropperSupported();

  async function openPicker() {
    const c = await pickColorViaDialog(value);
    if (c) {
      onChange(c);
      onCommit(c);
    }
  }
  async function openEyedropper() {
    const c = await pickColorViaEyeDropper();
    if (c) {
      onChange(c);
      onCommit(c);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.swatch, { backgroundColor: value }]}
          onPress={openPicker}
          accessibilityLabel="Open color picker"
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={() => onCommit(value)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="#000000"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        <Pressable style={styles.btn} onPress={openPicker}>
          <Text style={styles.btnText}>Pick</Text>
        </Pressable>
        {eyedropSupported ? (
          <Pressable style={styles.btn} onPress={openEyedropper} accessibilityLabel="Eye dropper">
            <Text style={styles.btnText}>Eyedropper</Text>
          </Pressable>
        ) : null}
      </View>
      {!eyedropSupported ? (
        <Text style={styles.hint}>
          (Eyedropper supported in Chrome/Edge — pick from anywhere on screen.)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, minWidth: 240, flexGrow: 1, flexBasis: 280 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    minWidth: 120,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.charcoal,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic' },
});
