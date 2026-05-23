// Member-side schedule + booking inside the per-gym dashboard. The same
// component the public website uses (`PublicScheduleSection`) is mounted
// here against a minimal GymSiteProvider seeded from the per-gym data,
// so members can browse the gym's calendar and book classes without
// leaving the dashboard. Employees of the gym additionally see a button
// to jump to the full-screen work-schedule view (/schedule/[gymId]).
//
// Multi-location gyms show a location picker above the calendar. The
// default is the user's "home" location — for active employees it's the
// first location on their gym_employee_locations row; otherwise it's
// the gym's primary location.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { PublicScheduleSection } from '@/components/PublicScheduleSection';
import { GymSiteProvider, GymSite, GymSiteLocation } from '@/components/GymSiteContext';
import { Select } from '@/components/Select';

type GymData = {
  gymRow: { id: string; name: string; slug: string | null; city: string | null; state: string | null };
  theme: { primary_color: string; accent_color: string; logo_url: string | null };
  modules: any;
  locations: GymSiteLocation[];
};

export default function MemberGymSchedule() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const { session, profile } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<GymData | null>(null);
  const [activeLocId, setActiveLocId] = useState<string | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [calendarOff, setCalendarOff] = useState(false);

  const load = useCallback(async () => {
    if (!gymId || !session) return;
    const [{ data: gym }, { data: th }, { data: mods }, { data: locs }, { data: emp }] = await Promise.all([
      supabase.from('gyms').select('id, name, slug, city, state').eq('id', gymId).maybeSingle(),
      supabase.from('gym_themes').select('primary_color, accent_color, logo_url').eq('gym_id', gymId).is('location_id', null).maybeSingle(),
      supabase.from('gym_modules').select('*').eq('gym_id', gymId).maybeSingle(),
      supabase
        .from('gym_locations')
        .select('id, label, slug, is_primary, address_line1, address_line2, city, state, zip')
        .eq('gym_id', gymId)
        .eq('is_paused', false)
        .order('display_order'),
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

    // Default location: an employee's own location if they have one
    // assigned (gym_employee_locations), else the gym's primary.
    let defaultLoc: GymSiteLocation | null = locations.find((l) => l.is_primary) ?? locations[0] ?? null;
    if (empActive && (emp as any).id) {
      const { data: empLocs } = await supabase
        .from('gym_employee_locations')
        .select('location_id')
        .eq('employee_id', (emp as any).id)
        .limit(1);
      const empLocId = ((empLocs as any[]) ?? [])[0]?.location_id;
      if (empLocId) {
        const match = locations.find((l) => l.id === empLocId);
        if (match) defaultLoc = match;
      }
    }

    setData({
      gymRow: gym as any,
      theme: {
        primary_color: (th as any)?.primary_color ?? theme.colors.wyldPurple,
        accent_color: (th as any)?.accent_color ?? theme.colors.tealDark,
        logo_url: (th as any)?.logo_url ?? null,
      },
      modules: m,
      locations,
    });
    setActiveLocId(defaultLoc?.id ?? null);
  }, [gymId, session, profile?.email]);

  useEffect(() => { load(); }, [load]);

  // Rebuild the GymSite shape whenever the active location flips so
  // PublicScheduleSection re-runs its event/booking query for the new
  // location (it depends on site.currentLocation).
  const site: GymSite | null = useMemo(() => {
    if (!data) return null;
    const currentLocation = data.locations.find((l) => l.id === activeLocId) ?? null;
    return {
      gym: data.gymRow,
      locations: data.locations,
      currentLocation,
      multiLocationEnabled: !!data.modules.multi_location_enabled,
      theme: {
        primary_color: data.theme.primary_color,
        accent_color: data.theme.accent_color,
        logo_url: data.theme.logo_url,
        style_preset: 'clean',
        hero_variant: 'split',
        section_dividers: true,
      },
      modules: {
        calendar_enabled: !!data.modules.calendar_enabled,
        store_enabled: !!data.modules.store_enabled,
        news_enabled: !!data.modules.news_enabled,
        faq_enabled: !!data.modules.faq_enabled,
        bookings_enabled: !!data.modules.bookings_enabled,
        about_enabled: !!data.modules.about_enabled,
        services_enabled: !!data.modules.services_enabled,
        contact_enabled: !!data.modules.contact_enabled,
        news_visible: !!data.modules.news_visible,
        faq_visible: !!data.modules.faq_visible,
        store_visible: !!data.modules.store_visible,
        applications_enabled: !!data.modules.applications_enabled,
      },
      settings: {
        contact_email: null, contact_phone: null,
        address_line1: null, city: null, state: null, zip: null,
        hours: null,
        social_instagram: null, social_facebook: null, social_x: null, social_tiktok: null,
      },
      pages: {},
    };
  }, [data, activeLocId]);

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
  if (!site || !data) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {data.locations.length > 1 ? (
          <View style={styles.locField}>
            <Text style={styles.locLabel}>Location</Text>
            <Select
              ariaLabel="Pick a location"
              value={activeLocId ?? ''}
              onChange={(v) => setActiveLocId(v || null)}
              options={data.locations.map((l) => ({
                value: l.id,
                label: l.label || [l.city, l.state].filter(Boolean).join(', ') || 'Location',
              }))}
            />
          </View>
        ) : null}
        {isEmployee ? (
          <Pressable
            style={styles.workBtn}
            onPress={() => router.push(`/schedule/${gymId}?back=${encodeURIComponent(`/m/${gymId}/schedule`)}` as never)}
          >
            <Text style={styles.workBtnText}>My work schedule →</Text>
          </Pressable>
        ) : null}
      </View>

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

  toolbar: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
  locField: { gap: 4, minWidth: 220 },
  locLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  workBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  workBtnText: { color: theme.colors.charcoal, fontWeight: '800', fontSize: 13 },
});
