import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type FaqItem = { q: string; a: string; id?: string };

export function FaqAccordion({
  items,
  primaryColor,
  accentColor,
}: {
  items: FaqItem[];
  primaryColor: string;
  accentColor: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <View style={styles.list}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <View key={item.id ?? i} style={styles.item}>
            <Pressable
              style={styles.row}
              onPress={() => setOpen(isOpen ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={[styles.q, { color: primaryColor }]}>{item.q || 'Question'}</Text>
              <Text style={[styles.chev, { color: accentColor }]}>{isOpen ? '−' : '+'}</Text>
            </Pressable>
            {isOpen ? (
              <View style={styles.answer}>
                {(item.a || '')
                  .split('\n')
                  .filter((p) => p.trim())
                  .map((para, idx) => (
                    <Text key={idx} style={styles.aText}>
                      {para}
                    </Text>
                  ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, maxWidth: 760 },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  q: { flex: 1, fontSize: 17, fontWeight: '700' },
  chev: { fontSize: 24, fontWeight: '800', lineHeight: 26, width: 24, textAlign: 'center' },
  answer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  aText: { fontSize: 15, color: '#0F172A', lineHeight: 24 },
});
