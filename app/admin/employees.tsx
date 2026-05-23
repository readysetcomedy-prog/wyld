// WyLD staff roster — same component as the gym-owner Employees page, but
// pointed at the WyLD gym row and using the WyLD perm subset (Collaboration,
// Demo, admin pages) instead of gym-side perms (Billing, Website, etc.).

import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { SubTabsPage } from '@/components/SubTabs';
import { Roster, RolesEditor } from '@/app/owner/employees';

export default function AdminEmployees() {
  const [wyldGymId, setWyldGymId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id')
        .eq('slug', 'wyld')
        .maybeSingle();
      setWyldGymId((data as any)?.id ?? null);
    })();
  }, []);

  if (wyldGymId === undefined) {
    return <ActivityIndicator color={theme.colors.wyldPurple} />;
  }
  if (!wyldGymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>WyLD gym row missing.</Text>
        <Text style={styles.emptyBody}>
          The WyLD organization record (slug='wyld') doesn't exist yet. Run the
          20260608000000_wyld_gym migration to create it.
        </Text>
      </View>
    );
  }

  return (
    <SubTabsPage
      title="WyLD Employees"
      blurb="Roles, schedules, payroll, and HR for the WyLD team."
      tabs={[
        { key: 'roster', label: 'Roster', body: <Roster gymId={wyldGymId} kind="wyld" /> },
        { key: 'roles', label: 'Roles', body: <RolesEditor gymId={wyldGymId} /> },
        {
          key: 'time-cards',
          label: 'Time Cards',
          body: 'Clock-ins and clock-outs, total hours per pay period, and exports for payroll.',
        },
        { key: 'scheduling', label: 'Scheduling', body: <WyldSchedulingLauncher gymId={wyldGymId} /> },
        {
          key: 'hr',
          label: 'HR',
          body: 'Onboarding, employment documents, certifications, and time-off tracking.',
        },
        {
          key: 'payroll',
          label: 'Payroll',
          body: 'Run payroll from time cards, manage rates and deductions, and export tax forms.',
        },
      ]}
    />
  );
}

function WyldSchedulingLauncher({ gymId }: { gymId: string }) {
  const router = useRouter();
  return (
    <View style={launcherStyles.card}>
      <Text style={launcherStyles.title}>WyLD Shift Schedule</Text>
      <Text style={launcherStyles.body}>
        Build the WyLD office shift schedule — coverage targets per location,
        pickup requests, rotations, and history. Employees with perm_schedule
        can edit; everyone else gets the read-only view.
      </Text>
      <Pressable
        onPress={() => router.push(`/schedule/${gymId}?back=${encodeURIComponent('/admin/employees')}` as never)}
        style={launcherStyles.btn}
      >
        <Text style={launcherStyles.btnText}>Open Schedule</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: theme.spacing.xl, gap: 6,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
});

const launcherStyles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  btn: {
    alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
