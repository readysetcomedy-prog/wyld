import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useGymTheme } from '@/lib/gymTheme';
import { money } from '@/lib/pricing';
import { CostBreakdownView } from '@/components/CostBreakdown';
import {
  FEATURES,
  CostBreakdown,
  SetupFeesPending,
  computeCost,
  computePendingSetupFees,
  fetchPricingModel,
} from '@/lib/pricingModel';

type Upgrade = { key: string; label: string; addCents: number };

export default function OwnerBilling() {
  const { profile } = useAuth();
  const gymTheme = useGymTheme();
  const gymId = profile?.gym_id ?? null;

  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CostBreakdown | null>(null);
  const [setupFees, setSetupFees] = useState<SetupFeesPending | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);

  useEffect(() => {
    if (!gymId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [
        model,
        { data: mods },
        { count: locCount },
        { count: memCount },
        { count: empCount },
        { data: paidFees },
      ] = await Promise.all([
        fetchPricingModel(),
        supabase.from('gym_modules').select('*').eq('gym_id', gymId).maybeSingle(),
        supabase
          .from('gym_locations')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('is_paused', false),
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('status', 'active'),
        supabase
          .from('gym_employees')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .is('terminate_date', null),
        supabase
          .from('gym_setup_fees_paid')
          .select('fee_key')
          .eq('gym_id', gymId),
      ]);
      if (cancelled) return;

      const m = (mods as any) ?? {};
      const loc = locCount ?? 0;
      const mem = memCount ?? 0;
      const emp = empCount ?? 0;
      const active = new Set(
        FEATURES.filter((f) => f.flag && m[f.flag]).map((f) => f.key)
      );
      const paidKeys = new Set(((paidFees as any[]) ?? []).map((r) => r.fee_key));
      const cur = computeCost(model, active, loc, mem, emp);
      setCurrent(cur);
      setSetupFees(computePendingSetupFees(model, active, paidKeys));

      // For each feature the gym doesn't have, the marginal cost to add it —
      // which naturally shows $0 when the feature is included or free.
      const ups: Upgrade[] = FEATURES.filter(
        (f) => f.flag && !active.has(f.key)
      ).map((f) => {
        const withF = new Set(active);
        withF.add(f.key);
        const addCents =
          computeCost(model, withF, loc, mem, emp).totalCents - cur.totalCents;
        return { key: f.key, label: f.label, addCents: Math.max(0, addCents) };
      });
      setUpgrades(ups);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  if (loading) return <ActivityIndicator color={theme.colors.charcoal} />;

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Billing</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Billing</Text>
        <Text style={styles.sub}>
          What your gym costs each month, based on what you have turned on and your
          current location and member counts.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current monthly cost</Text>
        {current ? (
          <CostBreakdownView breakdown={current} setupFees={setupFees ?? undefined} />
        ) : null}
      </View>

      {upgrades.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available upgrades</Text>
          <Text style={styles.sub}>
            Features you don&apos;t have yet, and what each would add to your monthly
            cost. Contact WyLD to turn any of them on.
          </Text>
          <View style={styles.upList}>
            {upgrades.map((u) => (
              <View key={u.key} style={styles.upRow}>
                <Text style={styles.upLabel}>{u.label}</Text>
                {u.addCents === 0 ? (
                  <Text style={styles.upFree}>Included — free</Text>
                ) : (
                  <Text style={[styles.upPrice, { color: gymTheme.primary }]}>+{money(u.addCents)}/mo</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },

  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },

  upList: { gap: 2 },
  upRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  upLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal, flex: 1 },
  upPrice: { fontSize: 14, fontWeight: '800', color: theme.colors.wyldPurple },
  upFree: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
});
