// Single entry point for the Schedule. Looks up the user's relationship to
// this gym and renders either the manager UI (owner / perm_schedule) or the
// read-only employee UI. Anyone not employed by or owning this gym is
// redirected away.
//
// Branded in the gym's primary color + logo so it feels continuous with
// the per-gym dashboard the user came from. Accepts an optional `back`
// URL param so the back button returns to that exact route — otherwise
// it falls back to a sensible default for the caller's role.

import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Schedule } from '@/components/schedule/Schedule';

type Brand = { primary_color: string; accent_color: string; logo_url: string | null };

export default function ScheduleEntry() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { gymId, back: backParam } = useLocalSearchParams<{ gymId: string; back?: string }>();

  const [resolved, setResolved] = useState<
    | { state: 'loading' }
    | { state: 'denied' }
    | { state: 'ok'; mode: 'manage' | 'view'; gymName: string; myEmployeeId: string | null; isOwner: boolean }
  >({ state: 'loading' });
  const [brand, setBrand] = useState<Brand | null>(null);

  useEffect(() => {
    if (authLoading || !session || !profile || !gymId) return;
    let cancelled = false;
    (async () => {
      const [{ data: gym }, { data: emp }, { data: canManage }, { data: th }] = await Promise.all([
        supabase.from('gyms').select('name, owner_id').eq('id', gymId).maybeSingle(),
        supabase
          .from('gym_employees')
          .select('id, perm_schedule, terminate_date')
          .eq('gym_id', gymId)
          .or(`user_id.eq.${session.user.id},email.eq.${profile.email}`)
          .maybeSingle(),
        supabase.rpc('can_manage_schedule', { p_gym_id: gymId }),
        supabase.from('gym_themes').select('primary_color, accent_color, logo_url')
          .eq('gym_id', gymId).is('location_id', null).maybeSingle(),
      ]);

      if (cancelled) return;
      if (!gym) { setResolved({ state: 'denied' }); return; }

      const employmentActive =
        emp && (!(emp as any).terminate_date || (emp as any).terminate_date > new Date().toISOString().slice(0, 10));
      const canMgr = canManage === true;
      const isOwner = (gym as any).owner_id === session.user.id;

      if (!canMgr && !employmentActive && profile.role !== 'admin') {
        setResolved({ state: 'denied' });
        return;
      }

      setBrand({
        primary_color: (th as any)?.primary_color ?? theme.colors.wyldPurple,
        accent_color: (th as any)?.accent_color ?? theme.colors.tealDark,
        logo_url: (th as any)?.logo_url ?? null,
      });
      setResolved({
        state: 'ok',
        mode: canMgr ? 'manage' : 'view',
        gymName: (gym as any).name,
        myEmployeeId: (emp as any)?.id ?? null,
        isOwner,
      });
    })();
    return () => { cancelled = true; };
  }, [authLoading, session, profile, gymId]);

  if (authLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile || profile.id !== session.user.id) return null;
  if (!gymId) return <Redirect href="/" />;

  function goBack() {
    // Prefer the explicit ?back= URL (set by per-gym dashboard "Schedule"
    // tab). Otherwise pick a sane home for the caller's role.
    if (backParam) {
      router.replace(backParam as never);
      return;
    }
    if (resolved.state === 'ok' && resolved.isOwner) {
      router.replace('/owner' as never);
      return;
    }
    // Default: return to this gym's member dashboard.
    router.replace(`/m/${gymId}` as never);
  }

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
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const bg = brand?.primary_color ?? theme.colors.wyldPurple;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { backgroundColor: bg, borderBottomColor: bg }]}>
        <Pressable onPress={goBack} style={styles.topBarBtn}>
          <Text style={styles.topBarBtnText}>‹ Back to {resolved.gymName}</Text>
        </Pressable>
        <View style={styles.topBarBrand}>
          {brand?.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.topBarLogo} resizeMode="contain" />
          ) : null}
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {resolved.gymName} · Schedule
          </Text>
        </View>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  topBarBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  topBarBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  topBarLogo: { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  topBarTitle: { color: '#fff', fontWeight: '800', fontSize: 15, maxWidth: 280 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  deniedTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
