import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export type SelectOption = { value: string; label: string };

// Cross-platform dropdown: a Pressable trigger that opens a Modal list.
// Works identically on web and native.
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  fullWidth,
  placeholder = 'Select…',
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  fullWidth?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        onPress={() => setOpen(true)}
        style={[styles.trigger, fullWidth && { alignSelf: 'stretch' }]}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => {
                const sel = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={[styles.option, sel && styles.optionSel]}
                  >
                    <Text style={[styles.optionText, sel && styles.optionTextSel]}>
                      {o.label}
                    </Text>
                    {sel ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  triggerText: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal, flexShrink: 1 },
  caret: { fontSize: 12, color: theme.colors.textSecondary },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionSel: { backgroundColor: '#f1f5f9' },
  optionText: { fontSize: 15, color: theme.colors.charcoal },
  optionTextSel: { fontWeight: '800', color: theme.colors.wyldPurple },
  check: { fontSize: 14, fontWeight: '900', color: theme.colors.wyldPurple },
});
