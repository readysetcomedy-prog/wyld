import { View, Text, StyleSheet } from 'react-native';
import { CostBreakdown, SetupFeesPending } from '@/lib/pricingModel';
import { money } from '@/lib/pricing';
import { theme } from '@/lib/theme';

// Itemized monthly-cost breakdown — shared by the admin pricing calculator
// and the per-gym cost card. Optional setupFees block renders ABOVE the
// recurring breakdown as a one-time-fee section, so it's clear those won't
// repeat next month.
export function CostBreakdownView({
  breakdown,
  setupFees,
}: {
  breakdown: CostBreakdown;
  setupFees?: SetupFeesPending;
}) {
  if (breakdown.lines.length === 0 && (!setupFees || setupFees.lines.length === 0)) {
    return <Text style={styles.empty}>Nothing enabled yet.</Text>;
  }
  return (
    <View style={styles.root}>
      {setupFees && setupFees.lines.length > 0 ? (
        <View style={styles.setupBlock}>
          <Text style={styles.setupHeader}>One-time setup fees (next bill only)</Text>
          {setupFees.lines.map((l) => (
            <View key={l.fee_key} style={styles.row}>
              <View style={styles.left}>
                <Text style={styles.label}>{l.label}</Text>
              </View>
              <Text style={styles.amount}>{money(l.cents)}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.subtotalRow]}>
            <Text style={styles.subtotalLabel}>Setup fees total</Text>
            <Text style={styles.subtotalAmount}>{money(setupFees.totalCents)}</Text>
          </View>
          <Text style={styles.setupHint}>
            These appear on the next bill once and are not charged again,
            even if a feature is later toggled off and back on.
          </Text>
        </View>
      ) : null}

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
      {setupFees && setupFees.lines.length > 0 ? (
        <View style={[styles.row, styles.grandRow]}>
          <Text style={styles.grandLabel}>Next bill (recurring + setup)</Text>
          <Text style={styles.grandAmount}>
            {money(breakdown.totalCents + setupFees.totalCents)}
          </Text>
        </View>
      ) : null}
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

  setupBlock: {
    padding: 12, marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1, borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  setupHeader: { fontSize: 12, fontWeight: '800', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  setupHint: { fontSize: 11, color: '#92400e', marginTop: 6, lineHeight: 16 },
  subtotalRow: { borderBottomWidth: 0, marginTop: 2 },
  subtotalLabel: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  subtotalAmount: { fontSize: 15, fontWeight: '900', color: '#92400e' },

  totalRow: { borderBottomWidth: 0, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  totalAmount: { fontSize: 20, fontWeight: '900', color: theme.colors.wyldPurple },

  grandRow: { borderBottomWidth: 0, marginTop: 2 },
  grandLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  grandAmount: { fontSize: 16, fontWeight: '900', color: theme.colors.charcoal },
});
