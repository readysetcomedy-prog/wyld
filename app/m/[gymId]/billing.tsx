// Membership billing — placeholder for v1. Will eventually show payment
// method on file, payment history, upcoming charge dates, and let the
// member update their card. Wiring a payments processor (Stripe?) is the
// next step; for now this is a friendly stub so the tab isn't empty.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

export default function MemberGymBilling() {
  const { session } = useAuth();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const [info, setInfo] = useState<{ status: string; joined_at: string } | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!session || !gymId) return;
    const { data } = await supabase
      .from('gym_memberships')
      .select('status, joined_at')
      .eq('gym_id', gymId)
      .eq('member_id', session.user.id)
      .maybeSingle();
    setInfo((data as any) ?? null);
  }, [session, gymId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Membership Billing</Text>
      <Text style={styles.sub}>
        Your membership, payment method, and history at this gym.
      </Text>

      {info === undefined ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Current Membership</Text>
            {info ? (
              <>
                <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{info.status}</Text>
                <Text style={styles.cardDetail}>
                  Member since {new Date(info.joined_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </Text>
              </>
            ) : (
              <Text style={styles.cardValue}>No active membership</Text>
            )}
          </View>

          <View style={[styles.card, styles.comingSoonCard]}>
            <Text style={styles.cardLabel}>Payment</Text>
            <Text style={styles.cardValue}>Coming soon</Text>
            <Text style={styles.cardDetail}>
              We're wiring up automated billing. For now, ask the front desk how
              your gym handles dues.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, maxWidth: 720 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary },

  card: {
    padding: 18, borderRadius: theme.radius.lg, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border, gap: 6,
  },
  comingSoonCard: { backgroundColor: theme.colors.surface },
  cardLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  cardDetail: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
});
