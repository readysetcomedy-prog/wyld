// Single entry point for the Schedule. Looks up the user's relationship to
// this gym and renders either the manager UI (owner / perm_schedule) or the
// read-only employee UI. Anyone not employed by or owning this gym is
// redirected away.

import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Schedule } from '@/components/schedule/Schedule';

export default function ScheduleEntry() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();

  const [resolved, setResolved] = useState<
    | { state: 'loading' }
    | { state: 'denied' }
    | { state: 'ok'; mode: 'manage' | 'view'; gymName: string; myEmployeeId: string | null }
  >({ state: 'loading' });

  useEffect(() => {
    if (authLoading || !session || !profile || !gymId) return;
    let cancelled = false;
    (async () => {
      // Resolve gym name + ownership + employment + perm_schedule in parallel.
      const [{ data: gym }, { data: emp }, { data: canManage }] = await Promise.all([
        supabase.from('gyms').select('name, owner_id').eq('id', gymId).maybeSingle(),
        supabase
          .from('gym_employees')
          .select('id, perm_schedule, terminate_date')
          .eq('gym_id', gymId)
          .or(`user_id.eq.${session.user.id},email.eq.${profile.email}`)
          .maybeSingle(),
        supabase.rpc('can_manage_schedule', { p_gym_id: gymId }),
      ]);

      if (cancelled) return;
      if (!gym) { setResolved({ state: 'denied' }); return; }

      const employmentActive =
        emp && (!(emp as any).terminate_date || (emp as any).terminate_date > new Date().toISOString().slice(0, 10));
      const canMgr = canManage === true;

      if (!canMgr && !employmentActive && profile.role !== 'admin') {
        setResolved({ state: 'denied' });
        return;
      }

      setResolved({
        state: 'ok',
        mode: canMgr ? 'manage' : 'view',
        gymName: (gym as any).name,
        myEmployeeId: (emp as any)?.id ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [authLoading, session, profile, gymId]);

  if (authLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile || profile.id !== session.user.id) return null;
  if (!gymId) return <Redirect href="/" />;

  if (resolved.state === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }
  if (resolved.state === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>You don't have access to this schedule.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.topBarBtn}>
          <Text style={styles.topBarBtnText}>‹ Back</Text>
        </Pressable>
      </View>
      <Schedule
        gymId={gymId}
        gymName={resolved.gymName}
        mode={resolved.mode}
        myEmployeeId={resolved.myEmployeeId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  topBarBtn: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4 },
  topBarBtnText: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 14 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  deniedTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
