import { View, Text, StyleSheet } from 'react-native';
import { CostBreakdown } from '@/lib/pricingModel';
import { money } from '@/lib/pricing';
import { theme } from '@/lib/theme';

// Itemized monthly-cost breakdown — shared by the admin pricing calculator
// and the per-gym cost card.
export function CostBreakdownView({ breakdown }: { breakdown: CostBreakdown }) {
  if (breakdown.lines.length === 0) {
    return <Text style={styles.empty}>Nothing enabled yet.</Text>;
  }
  return (
    <View style={styles.root}>
      {breakdown.lines.map((l) => (
        <View key={l.key} style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.label}>{l.label}</Text>
            {l.note ? <Text style={styles.note}>{l.note}</Text> : null}
          </View>
          {l.cents === 0 ? (
            <Text style={styles.free}>Free</Text>
          ) : l.discountPct > 0 ? (
            <View style={styles.priceWrap}>
              <Text style={styles.strike}>{money(l.baseCents)}</Text>
              <Text style={styles.amount}>{money(l.cents)}</Text>
            </View>
          ) : (
            <Text style={styles.amount}>{money(l.cents)}</Text>
          )}
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Estimated monthly total</Text>
        <Text style={styles.totalAmount}>{money(breakdown.totalCents)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2 },
  empty: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  note: { fontSize: 12, color: theme.colors.textSecondary },
  amount: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  free: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  priceWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strike: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  totalRow: { borderBottomWidth: 0, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  totalAmount: { fontSize: 20, fontWeight: '900', color: theme.colors.wyldPurple },
});
