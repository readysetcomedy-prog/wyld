// Per-gym landing — quick snapshot of the member's status at this gym
// (membership, waivers signed, employment) with deep links to each section.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

type Snapshot = {
  membership: { status: string; joined_at: string; location_id: string | null } | null;
  homeLocationLabel: string | null;
  waiverCount: number;
  signedWaiverCount: number;
  isEmployee: boolean;
  empPosition: string | null;
  sisterLocations: { id: string; label: string | null; city: string | null; state: string | null; fee_cents: number }[];
};

export default function GymOverview() {
  const { session, profile } = useAuth();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    if (!session || !gymId) return;
    const [{ data: mem }, { data: waivers }, { data: signed }, { data: emp }, { data: locs }] = await Promise.all([
      supabase.from('gym_memberships').select('status, joined_at, location_id').eq('gym_id', gymId).eq('member_id', session.user.id).maybeSingle(),
      supabase.from('gym_waivers').select('id', { count: 'exact' }).eq('gym_id', gymId).eq('is_active', true),
      supabase
        .from('gym_waiver_signatures')
        .select('waiver_id, gym_waivers!inner(gym_id)')
        .eq('signer_user_id', session.user.id)
        .eq('gym_waivers.gym_id', gymId),
      supabase.from('gym_employees').select('position, terminate_date').eq('gym_id', gymId)
        .or(`user_id.eq.${session.user.id},email.eq.${profile?.email ?? ''}`).maybeSingle(),
      supabase.from('gym_locations')
        .select('id, label, city, state, allow_visiting_members, visiting_fee_cents')
        .eq('gym_id', gymId)
        .eq('is_paused', false),
    ]);

    const empActive = emp && (!(emp as any).terminate_date || (emp as any).terminate_date > new Date().toISOString().slice(0, 10));
    const myLocId = (mem as any)?.location_id ?? null;
    const allLocs = ((locs as any[]) ?? []);
    const myLoc = allLocs.find((l) => l.id === myLocId) ?? null;
    // "Sister locations" — all other locations on this gym that have
    // opted into visiting members. Show the per-visit fee if any.
    const sisterLocations = allLocs
      .filter((l) => l.id !== myLocId && l.allow_visiting_members)
      .map((l) => ({
        id: l.id,
        label: l.label,
        city: l.city,
        state: l.state,
        fee_cents: l.visiting_fee_cents ?? 0,
      }));

    setSnap({
      membership: mem as any,
      homeLocationLabel: myLoc?.label ?? null,
      waiverCount: (waivers as any)?.length ?? 0,
      signedWaiverCount: (signed as any[])?.length ?? 0,
      isEmployee: !!empActive,
      empPosition: empActive ? (emp as any)?.position ?? null : null,
      sisterLocations,
    });
  }, [session, gymId, profile?.email]);

  useEffect(() => { load(); }, [load]);

  if (!snap) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  const unsignedWaivers = Math.max(0, snap.waiverCount - snap.signedWaiverCount);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>
        Your status at this gym at a glance.
      </Text>

      <View style={styles.cards}>
        <StatusCard
          label="Membership"
          value={snap.membership ? snap.membership.status : 'Not a member'}
          accent={snap.membership?.status === 'active' ? '#15803d' : theme.colors.textSecondary}
          detail={
            snap.membership
              ? `Since ${new Date(snap.membership.joined_at).toLocaleDateString()}${
                  snap.homeLocationLabel ? `  ·  ${snap.homeLocationLabel}` : ''
                }`
              : null
          }
          onPress={() => router.push(`/m/${gymId}/billing` as never)}
        />
        <StatusCard
          label="Waivers"
          value={
            snap.waiverCount === 0 ? 'None required' :
            unsignedWaivers === 0 ? 'All signed' :
            `${unsignedWaivers} unsigned`
          }
          accent={unsignedWaivers === 0 || snap.waiverCount === 0 ? '#15803d' : '#B45309'}
          detail={snap.waiverCount > 0 ? `${snap.signedWaiverCount} of ${snap.waiverCount} signed` : null}
          onPress={() => router.push(`/m/${gymId}/waivers` as never)}
        />
        {snap.isEmployee && (
          <StatusCard
            label="Employment"
            value={snap.empPosition || 'Employee'}
            accent={theme.colors.wyldPurple}
            detail="Active staff member"
            onPress={() => router.push(`/m/${gymId}/employee` as never)}
          />
        )}
      </View>

      {snap.sisterLocations.length > 0 ? (
        <View style={styles.sisterBlock}>
          <Text style={styles.sectionLabel}>Other locations you can use</Text>
          <Text style={styles.sectionSub}>
            Your membership lets you drop in at these locations too.
          </Text>
          {snap.sisterLocations.map((l) => (
            <View key={l.id} style={styles.sisterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sisterName}>
                  {l.label || [l.city, l.state].filter(Boolean).join(', ') || 'Location'}
                </Text>
                {l.label && (l.city || l.state) ? (
                  <Text style={styles.sisterMeta}>
                    {[l.city, l.state].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.feePill, l.fee_cents === 0 ? styles.feePillFree : styles.feePillPaid]}>
                <Text style={[styles.feePillText, l.fee_cents === 0 ? styles.feePillTextFree : styles.feePillTextPaid]}>
                  {l.fee_cents === 0 ? 'Free' : `$${(l.fee_cents / 100).toFixed(2)} / visit`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StatusCard({
  label, value, accent, detail, onPress,
}: {
  label: string; value: string; accent: string; detail: string | null; onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardValue} numberOfLines={1}>{value}</Text>
        {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, maxWidth: 800 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary },

  cards: { gap: 8, marginTop: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: theme.radius.lg, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal, textTransform: 'capitalize' },
  cardDetail: { fontSize: 12, color: theme.colors.textSecondary },
  chevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },

  sisterBlock: {
    marginTop: 16, padding: 16, gap: 8,
    borderRadius: theme.radius.lg, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionSub: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },
  sisterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  sisterName: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  sisterMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  feePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  feePillFree: { backgroundColor: '#dcfce7' },
  feePillPaid: { backgroundColor: '#fef3c7' },
  feePillText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },
  feePillTextFree: { color: '#15803d' },
  feePillTextPaid: { color: '#92400e' },
});
