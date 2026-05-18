import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { GymHours, hasAnyHours, HoursMap } from '@/components/GymHours';
import { useGymSite } from '@/components/GymSiteContext';
import { PhoneLink, EmailLink } from '@/components/ContactLink';

type LocContact = {
  id: string;
  location_id: string;
  kind: 'email' | 'phone';
  value: string;
  label: string | null;
};
type Loc = {
  id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  hours: HoursMap | null;
  contacts: LocContact[];
};

export function PublicContactSection() {
  const site = useGymSite();
  const { session, profile } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [locations, setLocations] = useState<Loc[] | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: locs }, { data: contacts }] = await Promise.all([
        supabase
          .from('gym_locations')
          .select('*')
          .eq('gym_id', site.gym.id)
          .order('display_order'),
        supabase.from('gym_location_contacts').select('*').order('display_order'),
      ]);
      if (cancelled) return;
      const byLoc: Record<string, LocContact[]> = {};
      (contacts ?? []).forEach((c: any) => {
        (byLoc[c.location_id] ??= []).push(c);
      });
      // Paused locations are hidden from the public site.
      setLocations(
        (locs ?? [])
          .filter((l: any) => !l.is_paused)
          .map((l: any) => ({ ...l, contacts: byLoc[l.id] ?? [] }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [site.gym.id]);

  // The location the visitor is on — fall back to the first location for a
  // single-location gym, or null if the gym has none.
  const loc: Loc | null = useMemo(() => {
    if (!locations) return null;
    if (site.currentLocation) {
      return locations.find((l) => l.id === site.currentLocation!.id) ?? null;
    }
    return locations[0] ?? null;
  }, [locations, site.currentLocation]);

  async function sendMessage() {
    setErr(null);
    if (!body.trim()) {
      setErr('Please write a message.');
      return;
    }
    setSending(true);

    if (session && profile) {
      // Member / signed-in: open-or-find a member_gym thread, then a message.
      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('kind', 'member_gym')
        .eq('gym_id', site.gym.id)
        .eq('user_id', profile.id)
        .maybeSingle();
      let threadId = existing?.id as string | undefined;
      if (!threadId) {
        const { data: created, error: tErr } = await supabase
          .from('message_threads')
          .insert({
            kind: 'member_gym',
            gym_id: site.gym.id,
            user_id: profile.id,
            location_id: loc?.id ?? null,
            subject: 'From contact page',
          })
          .select('id')
          .single();
        if (tErr) {
          setErr(tErr.message);
          setSending(false);
          return;
        }
        threadId = (created as any).id as string;
      }
      const { error: mErr } = await supabase.from('messages').insert({
        thread_id: threadId,
        sender_user_id: profile.id,
        body: body.trim(),
      });
      setSending(false);
      if (mErr) {
        setErr(mErr.message);
        return;
      }
      setSent(true);
      setBody('');
    } else {
      // Anonymous: a SECURITY DEFINER RPC creates the thread + message.
      if (!name.trim() || !email.trim()) {
        setErr('Please enter your name and email.');
        setSending(false);
        return;
      }
      const { error } = await supabase.rpc('submit_contact_message', {
        p_gym_id: site.gym.id,
        p_location_id: loc?.id ?? null,
        p_name: name.trim(),
        p_email: email.trim(),
        p_body: body.trim(),
      });
      setSending(false);
      if (error) {
        setErr(error.message);
        return;
      }
      setSent(true);
      setBody('');
      setName('');
      setEmail('');
    }
  }

  const accent = site.theme.accent_color;
  const primary = site.theme.primary_color;
  const fallback = site.settings;

  // Hours: location's own if set, else gym-level.
  const hours: HoursMap | null = loc?.hours ?? fallback.hours ?? null;

  // HQ / main office: gym-level contact info, shown only if it has an
  // address that differs from the location being viewed.
  const hqDiffers =
    !!fallback.address_line1 &&
    fallback.address_line1.trim() !== (loc?.address_line1 ?? '').trim();

  if (locations === null) return <ActivityIndicator color={primary} />;

  const emails = (loc?.contacts ?? []).filter((c) => c.kind === 'email');
  const phones = (loc?.contacts ?? []).filter((c) => c.kind === 'phone');

  const locationCard = (
    <View style={[styles.col, isWide && styles.colWide]}>
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: primary }]}>
          {loc?.label || 'Visit us'}
        </Text>
        {loc?.address_line1 ? (
          <Text style={styles.addr}>
            {loc.address_line1}
            {loc.address_line2 ? `, ${loc.address_line2}` : ''}
          </Text>
        ) : fallback.address_line1 ? (
          <Text style={styles.addr}>{fallback.address_line1}</Text>
        ) : null}
        {loc && (loc.city || loc.state || loc.zip) ? (
          <Text style={styles.addr}>
            {[loc.city, loc.state, loc.zip].filter(Boolean).join(', ')}
          </Text>
        ) : !loc && (fallback.city || fallback.state || fallback.zip) ? (
          <Text style={styles.addr}>
            {[fallback.city, fallback.state, fallback.zip].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {emails.length > 0 ? (
          <View style={styles.contactGroup}>
            {emails.map((c) => (
              <EmailLink
                key={c.id}
                email={c.value}
                prefix={c.label ? `${c.label}: ` : ''}
                style={styles.contactLine}
              />
            ))}
          </View>
        ) : fallback.contact_email ? (
          <EmailLink email={fallback.contact_email} prefix="Email: " style={styles.contactLine} />
        ) : null}

        {phones.length > 0 ? (
          <View style={styles.contactGroup}>
            {phones.map((c) => (
              <PhoneLink
                key={c.id}
                phone={c.value}
                prefix={c.label ? `${c.label}: ` : ''}
                style={styles.contactLine}
              />
            ))}
          </View>
        ) : fallback.contact_phone ? (
          <PhoneLink phone={fallback.contact_phone} prefix="Phone: " style={styles.contactLine} />
        ) : null}
      </View>

      {hasAnyHours(hours) ? (
        <View style={styles.card}>
          <GymHours hours={hours ?? {}} primaryColor={primary} />
        </View>
      ) : null}
    </View>
  );

  const messageForm = (
    <View style={[styles.col, isWide && styles.colWide]}>
      <View style={styles.formCard}>
        <Text style={[styles.formTitle, { color: primary }]}>Send a message</Text>
        {sent ? (
          <View>
            <Text style={styles.sentText}>
              Thanks — your message has been sent to {loc?.label || site.gym.name}.
            </Text>
            <Pressable onPress={() => setSent(false)} style={styles.linkBtn}>
              <Text style={[styles.linkBtnText, { color: accent }]}>Send another</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!session ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Your name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Jane Doe"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
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
              </View>
            ) : (
              <Text style={styles.signedInNote}>
                Signed in as {profile?.full_name || profile?.email}. Your reply will appear in
                your WyLD messages.
              </Text>
            )}
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={`Hi ${loc?.label || site.gym.name}…`}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
            />
            {err ? <Text style={styles.error}>{err}</Text> : null}
            <Pressable
              onPress={sendMessage}
              disabled={sending}
              style={[styles.cta, { backgroundColor: accent }, sending && { opacity: 0.6 }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Send message</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.twoCol, isWide && styles.twoColWide]}>
        {locationCard}
        {messageForm}
      </View>

      {hqDiffers ? (
        <View style={styles.hqCard}>
          <Text style={styles.hqTitle}>Main office</Text>
          <Text style={styles.hqLine}>
            {fallback.address_line1}
            {fallback.city ? `, ${fallback.city}` : ''}
            {fallback.state ? `, ${fallback.state}` : ''}
            {fallback.zip ? ` ${fallback.zip}` : ''}
          </Text>
          {fallback.contact_phone ? (
            <PhoneLink phone={fallback.contact_phone} prefix="Phone: " style={styles.hqLine} />
          ) : null}
          {fallback.contact_email ? (
            <EmailLink email={fallback.contact_email} prefix="Email: " style={styles.hqLine} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  twoCol: { gap: 20, flexDirection: 'column' },
  twoColWide: { flexDirection: 'row', alignItems: 'flex-start' },
  // Column stacks full-width on mobile; only splits width (flex:1) when wide.
  col: { gap: 16, width: '100%' },
  colWide: { flex: 1, width: 'auto', minWidth: 0 },

  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  addr: { fontSize: 15, color: '#0F172A', lineHeight: 22 },
  contactGroup: { marginTop: 6, gap: 2 },
  contactLine: { fontSize: 14, color: '#475569' },

  formCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  formTitle: { fontSize: 20, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 0, minWidth: 140, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  signedInNote: { fontSize: 13, color: '#475569', fontStyle: 'italic' },
  cta: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#DC2626', fontSize: 13 },
  sentText: { fontSize: 15, color: '#0F172A', lineHeight: 22 },
  linkBtn: { marginTop: 8 },
  linkBtnText: { fontSize: 14, fontWeight: '700' },

  hqCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    gap: 3,
    maxWidth: 420,
  },
  hqTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  hqLine: { fontSize: 14, color: '#475569', lineHeight: 20 },
});
