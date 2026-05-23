// Simple cross-platform time picker. On web it uses an <input type="time">
// which gives us the OS native picker; on native it falls back to a plain
// HH:MM text input. Always emits "HH:MM" (24-hour) so DB values stay clean.

import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { theme } from '@/lib/theme';

type Props = {
  label?: string;
  value: string;       // "HH:MM"
  onChange: (v: string) => void;
};

export function TimePicker({ label, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {Platform.OS === 'web' ? (
        // react-native-web lets us render a DOM <input> directly
        (() => {
          const Input = 'input' as any;
          return (
            <Input
              type="time"
              value={value}
              onChange={(e: any) => onChange(e.target.value || '00:00')}
              style={styles.webInput}
              step={300}
            />
          );
        })()
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create<any>({
  wrap: { gap: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  webInput: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  },
});
