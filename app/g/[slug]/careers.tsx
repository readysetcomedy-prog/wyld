import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useGymSite } from '@/components/GymSiteContext';
import { supabase } from '@/lib/supabase';

type Posting = {
  id: string;
  gym_id: string;
  title: string;
  role_id: string | null;
  location_id: string | null;
  description: string | null;
  employment_type: string | null;
  compensation: string | null;
  status: string;
  display_order: number | null;
  created_at: string;
  role_name: string | null;
  location_label: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Careers() {
  const site = useGymSite();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);

  const locId = site.currentLocation?.id ?? null;

  useEffect(() => {
    if (!site.modules.applications_enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);

      // Fetch the postings first.
      const { data: postingRows, error: postErr } = await supabase
        .from('gym_job_postings')
        .select(
          'id, gym_id, title, role_id, location_id, description, employment_type, compensation, status, display_order, created_at'
        )
        .eq('gym_id', site.gym.id)
        .eq('status', 'open')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (postErr) {
        setLoadError(postErr.message);
        setLoading(false);
        return;
      }

      let rows = (postingRows ?? []) as any[];

      // If a current location is set in the URL, show only postings for that
      // location or "all locations" (location_id IS NULL).
      if (locId) {
        rows = rows.filter(
          (r) => r.location_id == null || r.location_id === locId
        );
      }

      // Fetch role names and location labels via separate selects, then merge.
      const roleIds = Array.from(
        new Set(rows.map((r) => r.role_id).filter((v): v is string => !!v))
      );
      const locIds = Array.from(
        new Set(rows.map((r) => r.location_id).filter((v): v is string => !!v))
      );

      let rolesMap: Record<string, string> = {};
      if (roleIds.length > 0) {
        const { data: roleRows } = await supabase
          .from('gym_roles')
          .select('id, name')
          .in('id', roleIds);
        if (cancelled) return;
        (roleRows ?? []).forEach((r: any) => {
          rolesMap[r.id] = r.name;
        });
      }

      let locsMap: Record<string, string> = {};
      if (locIds.length > 0) {
        const { data: locRows } = await supabase
          .from('gym_locations')
          .select('id, label')
          .in('id', locIds);
        if (cancelled) return;
        (locRows ?? []).forEach((l: any) => {
          locsMap[l.id] = l.label;
        });
      }

      const merged: Posting[] = rows.map((r) => ({
        ...r,
        role_name: r.role_id ? rolesMap[r.role_id] ?? null : null,
        location_label: r.location_id ? locsMap[r.location_id] ?? null : null,
      }));

      setPostings(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [site.modules.applications_enabled, site.gym.id, locId]);

  // Module disabled: graceful, branded message.
  if (!site.modules.applications_enabled) {
    return (
      <View style={[styles.page, isWide && styles.pageWide]}>
        <Text style={[styles.eyebrow, { color: accent }]}>CAREERS</Text>
        <Text style={[styles.title, { color: primary }]}>
          Careers at {site.gym.name}
        </Text>
        <Text style={styles.body}>
          Careers aren't enabled for this gym right now. Reach out via our
          Contact page if you'd like to be considered for future openings.
        </Text>
      </View>
    );
  }

  const careersPage = (site.pages.careers ?? {}) as { headline?: string; subheadline?: string; body?: string };
  const headline = (careersPage.headline?.trim()) || `Careers at ${site.gym.name}`;
  const eyebrow = (careersPage.subheadline?.trim()) || 'JOIN OUR TEAM';
  const intro =
    (careersPage.body?.trim()) ||
    `Browse our open positions${site.currentLocation ? ` at ${site.currentLocation.label}` : ''} and apply directly below.`;

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: primary }]}>{headline}</Text>
      <Text style={styles.intro}>{intro}</Text>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
      ) : loadError ? (
        <Text style={styles.errorBlock}>Couldn't load openings: {loadError}</Text>
      ) : postings.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: accent }]}>
          <Text style={[styles.emptyTitle, { color: primary }]}>
            No open positions right now
          </Text>
          <Text style={styles.emptyBody}>
            Check back later, or reach out via our Contact page.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {postings.map((p) => (
            <PostingCard
              key={p.id}
              posting={p}
              primary={primary}
              accent={accent}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PostingCard({
  posting,
  primary,
  accent,
}: {
  posting: Posting;
  primary: string;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wasLoggedIn, setWasLoggedIn] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coverNote, setCoverNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pills: string[] = [];
  if (posting.role_name) pills.push(posting.role_name);
  if (posting.location_label) pills.push(posting.location_label);
  if (posting.employment_type) pills.push(posting.employment_type);
  if (posting.compensation) pills.push(posting.compensation);

  const descParas = (posting.description ?? '')
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  async function handleSubmit() {
    setFormError(null);

    const name = fullName.trim();
    const mail = email.trim();
    if (!name) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!mail || !EMAIL_RE.test(mail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);

    // Check if visitor is logged in. If so, link the application to their
    // account and auto-join the gym as a member.
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    const payload: any = {
      posting_id: posting.id,
      full_name: name,
      email: mail,
    };
    if (phone.trim()) payload.phone = phone.trim();
    if (coverNote.trim()) payload.cover_note = coverNote.trim();
    if (userId) payload.user_id = userId;

    const { error } = await supabase
      .from('gym_job_applications')
      .insert(payload);

    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    // Auto-join the gym for logged-in applicants. Try upsert first; if that
    // fails (e.g. no matching unique constraint), fall back to select-then-
    // insert so we silently no-op when the row already exists.
    if (userId) {
      const { error: upsertErr } = await supabase
        .from('gym_memberships')
        .upsert(
          { member_id: userId, gym_id: posting.gym_id, status: 'active' },
          { onConflict: 'member_id,gym_id' }
        );
      if (upsertErr) {
        const { data: existing } = await supabase
          .from('gym_memberships')
          .select('id')
          .eq('member_id', userId)
          .eq('gym_id', posting.gym_id)
          .maybeSingle();
        if (!existing) {
          await supabase
            .from('gym_memberships')
            .insert({
              member_id: userId,
              gym_id: posting.gym_id,
              status: 'active',
            });
        }
      }
    }

    setWasLoggedIn(!!userId);
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, { color: primary }]}>{posting.title}</Text>

      {pills.length > 0 ? (
        <View style={styles.pillRow}>
          {pills.map((label, i) => (
            <View
              key={`${label}-${i}`}
              style={[styles.pill, { backgroundColor: accent }]}
            >
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {descParas.length > 0 ? (
        <View style={styles.descBlock}>
          {descParas.map((para, i) => (
            <Text key={i} style={styles.descPara}>
              {para}
            </Text>
          ))}
        </View>
      ) : null}

      {submitted ? (
        <View style={[styles.successBox, { borderColor: accent }]}>
          <Text style={[styles.successTitle, { color: primary }]}>
            Thanks for applying — we'll be in touch.
          </Text>
          {!wasLoggedIn ? (
            <Text style={styles.successHint}>
              Have a WyLD account? You can also apply from inside the app — your
              application will be linked automatically.
            </Text>
          ) : null}
        </View>
      ) : !expanded ? (
        <Pressable
          onPress={() => setExpanded(true)}
          style={[styles.applyBtn, { backgroundColor: primary }]}
        >
          <Text style={styles.applyBtnText}>Apply</Text>
        </Pressable>
      ) : (
        <View style={[styles.form, { borderColor: accent }]}>
          <Text style={[styles.formTitle, { color: primary }]}>
            Apply for {posting.title}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Doe"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cover note (optional)</Text>
            <TextInput
              value={coverNote}
              onChangeText={setCoverNote}
              placeholder="Tell us why you're a fit..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              style={[styles.input, styles.textarea]}
            />
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.formActions}>
            <Pressable
              onPress={() => {
                setExpanded(false);
                setFormError(null);
              }}
              style={styles.cancelBtn}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                { backgroundColor: primary, opacity: submitting ? 0.7 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit application</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    gap: 24,
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 36, fontWeight: '900', lineHeight: 42 },
  intro: { fontSize: 16, color: '#475569', lineHeight: 25, maxWidth: 720 },
  body: { fontSize: 16, color: '#475569', lineHeight: 25, maxWidth: 620 },

  errorBlock: {
    color: '#DC2626',
    fontSize: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },

  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#fff',
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptyBody: { fontSize: 15, color: '#475569', lineHeight: 22 },

  list: { gap: 20, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  descBlock: { gap: 8 },
  descPara: { fontSize: 15, color: '#0F172A', lineHeight: 23 },

  applyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  form: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  formTitle: { fontSize: 16, fontWeight: '800' },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  formError: { color: '#DC2626', fontSize: 13 },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  successBox: {
    marginTop: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  successTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  successHint: { fontSize: 13, color: '#475569', lineHeight: 19 },
});
