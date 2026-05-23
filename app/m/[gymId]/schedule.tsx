// Member-side schedule + booking inside the per-gym dashboard. The same
// component the public website uses (`PublicScheduleSection`) is mounted
// here against a minimal GymSiteProvider seeded from the per-gym data,
// so members can browse the gym's calendar and book classes without
// leaving the dashboard. Employees of the gym additionally see a button
// to jump to the full-screen work-schedule view (/schedule/[gymId]).

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { PublicScheduleSection } from '@/components/PublicScheduleSection';
import { GymSiteProvider, GymSite, GymSiteLocation } from '@/components/GymSiteContext';

export default function MemberGymSchedule() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const { session, profile } = useAuth();
  const router = useRouter();

  const [site, setSite] = useState<GymSite | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [calendarOff, setCalendarOff] = useState(false);

  const load = useCallback(async () => {
    if (!gymId || !session) return;
    const [{ data: gym }, { data: th }, { data: mods }, { data: locs }, { data: emp }] = await Promise.all([
      supabase.from('gyms').select('id, name, slug, city, state').eq('id', gymId).maybeSingle(),
      supabase.from('gym_themes').select('primary_color, accent_color, logo_url').eq('gym_id', gymId).is('location_id', null).maybeSingle(),
      supabase.from('gym_modules').select('*').eq('gym_id', gymId).maybeSingle(),
      supabase.from('gym_locations').select('id, label, slug, is_primary, address_line1, address_line2, city, state, zip').eq('gym_id', gymId).eq('is_paused', false).order('display_order'),
      supabase.from('gym_employees').select('id, terminate_date').eq('gym_id', gymId)
        .or(`user_id.eq.${session.user.id},email.eq.${profile?.email ?? ''}`).maybeSingle(),
    ]);

    if (!gym) return;
    const m = (mods as any) ?? {};
    if (!m.calendar_enabled) { setCalendarOff(true); return; }

    const today = new Date().toISOString().slice(0, 10);
    const empActive = emp && (!(emp as any).terminate_date || (emp as any).terminate_date > today);
    setIsEmployee(!!empActive);

    const locations = ((locs as any[]) ?? []) as GymSiteLocation[];
    const primaryLoc = locations.find((l) => l.is_primary) ?? locations[0] ?? null;

    setSite({
      gym: {
        id: (gym as any).id,
        name: (gym as any).name,
        slug: (gym as any).slug,
        city: (gym as any).city,
        state: (gym as any).state,
      },
      locations,
      currentLocation: primaryLoc,
      multiLocationEnabled: !!m.multi_location_enabled,
      theme: {
        primary_color: (th as any)?.primary_color ?? theme.colors.wyldPurple,
        accent_color: (th as any)?.accent_color ?? theme.colors.tealDark,
        logo_url: (th as any)?.logo_url ?? null,
        style_preset: 'clean',
        hero_variant: 'split',
        section_dividers: true,
      },
      modules: {
        calendar_enabled: !!m.calendar_enabled,
        store_enabled: !!m.store_enabled,
        news_enabled: !!m.news_enabled,
        faq_enabled: !!m.faq_enabled,
        bookings_enabled: !!m.bookings_enabled,
        about_enabled: !!m.about_enabled,
        services_enabled: !!m.services_enabled,
        contact_enabled: !!m.contact_enabled,
        news_visible: !!m.news_visible,
        faq_visible: !!m.faq_visible,
        store_visible: !!m.store_visible,
        applications_enabled: !!m.applications_enabled,
      },
      // Member-side schedule doesn't need contact/social/page content.
      settings: {
        contact_email: null, contact_phone: null,
        address_line1: null, city: null, state: null, zip: null,
        hours: null,
        social_instagram: null, social_facebook: null, social_x: null, social_tiktok: null,
      },
      pages: {},
    });
  }, [gymId, session, profile?.email]);

  useEffect(() => { load(); }, [load]);

  if (calendarOff) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.body}>
          This gym hasn't turned on a public schedule yet. Check back later or
          message them for class times.
        </Text>
      </View>
    );
  }
  if (!site) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  return (
    <View style={styles.root}>
      {isEmployee ? (
        <Pressable
          style={styles.workBtn}
          onPress={() => router.push(`/schedule/${gymId}?back=${encodeURIComponent(`/m/${gymId}/schedule`)}` as never)}
        >
          <Text style={styles.workBtnText}>My work schedule →</Text>
        </Pressable>
      ) : null}

      <GymSiteProvider value={site}>
        <PublicScheduleSection />
      </GymSiteProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  empty: { gap: 8, padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },

  workBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  workBtnText: { color: theme.colors.charcoal, fontWeight: '800', fontSize: 13 },
});
