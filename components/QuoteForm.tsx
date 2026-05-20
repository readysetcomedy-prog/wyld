import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

const FEATURE_OPTIONS = [
  'Website',
  'Scheduling & booking',
  'Smart-lock entry',
  'Memberships & payments',
  'Retail store',
  'Staff & time cards',
  'Marketing',
  'Analytics & reporting',
  'Multi-location',
];

// The detailed "Get a Quote" form. Used inline on the landing page and
// inside the QuoteButton modal. Submits a structured summary into the admin
// message box via the submit_quote_request RPC.
export function QuoteForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gym, setGym] = useState('');
  const [locations, setLocations] = useState('');
  const [members, setMembers] = useState('');
  const [feats, setFeats] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleFeat(f: string) {
    setFeats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  function reset() {
    setName('');
    setEmail('');
    setPhone('');
    setGym('');
    setLocations('');
    setMembers('');
    setFeats([]);
    setNotes('');
    setSent(false);
    setErr(null);
  }

  async function submit() {
    setErr(null);
    if (!name.trim() || !email.trim() || !gym.trim()) {
      setErr('Please fill in your name, email, and gym name.');
      return;
    }
    const body = [
      phone.trim() ? `Phone: ${phone.trim()}` : null,
      `Gym: ${gym.trim()}`,
      `Locations: ${locations.trim() || 'not specified'}`,
      `Members: ${members.trim() || 'not specified'}`,
      `Interested in: ${feats.length ? feats.join(', ') : 'not specified'}`,
      notes.trim() ? `Notes: ${notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    setSending(true);
    const { error } = await supabase.rpc('submit_quote_request', {
      p_name: name.trim(),
      p_email: email.trim(),
      p_body: body,
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.done}>
        <Text style={styles.doneTitle}>Thanks — we&apos;ve got it.</Text>
        <Text style={styles.doneSub}>
          Our team will follow up shortly with pricing built around your gym.
        </Text>
        <Pressable style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetText}>Send another request</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <Field label="Your name" value={name} onChange={setName} placeholder="Jane Doe" />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@yourgym.com"
          email
        />
      </View>
      <Field
        label="Phone (optional)"
        value={phone}
        onChange={setPhone}
        placeholder="(555) 555-5555"
        tel
      />
      <Field
        label="Gym / business name"
        value={gym}
        onChange={setGym}
        placeholder="Iron Works Gym"
      />
      <View style={styles.row}>
        <Field
          label="Number of locations"
          value={locations}
          onChange={(v) => setLocations(v.replace(/[^0-9]/g, ''))}
          placeholder="1"
          numeric
        />
        <Field
          label="Approx. members"
          value={members}
          onChange={(v) => setMembers(v.replace(/[^0-9]/g, ''))}
          placeholder="150"
          numeric
        />
      </View>

      <Text style={styles.label}>Which features are you interested in?</Text>
      <View style={styles.chips}>
        {FEATURE_OPTIONS.map((f) => {
          const on = feats.includes(f);
          return (
            <Pressable
              key={f}
              onPress={() => toggleFeat(f)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {on ? '✓ ' : ''}
                {f}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Anything else? (optional)"
        value={notes}
        onChange={setNotes}
        placeholder="Goals, timeline, current tools, questions…"
        multiline
      />

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable
        style={[styles.submit, sending && styles.submitDisabled]}
        onPress={submit}
        disabled={sending}
      >
        <Text style={styles.submitText}>{sending ? 'Sending…' : 'Request my quote'}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  email,
  tel,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  email?: boolean;
  tel?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={
          numeric ? 'number-pad' : tel ? 'phone-pad' : email ? 'email-address' : 'default'
        }
        autoCapitalize={email ? 'none' : 'sentences'}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 200, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  chipOn: {
    backgroundColor: '#f3effe',
    borderColor: theme.colors.wyldPurple,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.wyldPurple },
  err: { color: theme.colors.danger, fontSize: 13 },
  submit: {
    backgroundColor: theme.colors.wyldPurple,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  done: { gap: 10, paddingVertical: 8 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  doneSub: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },
  resetBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  resetText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
});
