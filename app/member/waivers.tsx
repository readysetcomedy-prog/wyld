import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { SignaturePad } from '@/components/SignaturePad';
import { WaiverBlocksView } from '@/components/WaiverBlocksView';
import { UNAUTHORIZED_ENTRY_NOTICE, parseBlocks } from '@/lib/waiverTemplate';

type Waiver = {
  id: string;
  gym_id: string;
  title: string;
  content: string;
};
type Sig = { waiver_id: string; signed_at: string };

type SignState = {
  participant_name: string;
  date_of_birth: string;
  phone: string;
  email: string;
  emergency_contact: string;
  emergency_contact_phone: string;
  typed_signature: string;
  unauthorized_initials: string;
  agreed: boolean;
};

const emptySign = (name: string): SignState => ({
  participant_name: name,
  date_of_birth: '',
  phone: '',
  email: '',
  emergency_contact: '',
  emergency_contact_phone: '',
  typed_signature: '',
  unauthorized_initials: '',
  agreed: false,
});

export default function MemberWaivers() {
  const { profile } = useAuth();
  const myId = profile?.id ?? null;

  const [gymNames, setGymNames] = useState<Record<string, string>>({});
  const [waivers, setWaivers] = useState<Waiver[] | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({}); // waiver_id -> signed_at
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<SignState | null>(null);
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data: memberships } = await supabase
      .from('gym_memberships')
      .select('gym_id')
      .eq('member_id', myId)
      .eq('status', 'active');
    const gymIds = Array.from(new Set((memberships ?? []).map((m: any) => m.gym_id)));
    if (gymIds.length === 0) {
      setWaivers([]);
      return;
    }
    const [{ data: gyms }, { data: w }, { data: sigs }] = await Promise.all([
      supabase.from('gyms').select('id, name').in('id', gymIds),
      supabase.from('gym_waivers').select('id, gym_id, title, content').in('gym_id', gymIds),
      supabase
        .from('gym_waiver_signatures')
        .select('waiver_id, signed_at')
        .eq('member_id', myId),
    ]);
    const names: Record<string, string> = {};
    (gyms ?? []).forEach((g: any) => {
      names[g.id] = g.name;
    });
    setGymNames(names);
    setWaivers((w as Waiver[]) ?? []);
    const sigMap: Record<string, string> = {};
    (sigs as Sig[] | null ?? []).forEach((s) => {
      sigMap[s.waiver_id] = s.signed_at;
    });
    setSigned(sigMap);
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);

  function openSign(w: Waiver) {
    setOpenId(w.id);
    setForm(emptySign(profile?.full_name || ''));
    setDrawnSig(null);
    setErr(null);
  }

  async function submit(w: Waiver) {
    if (!form || !myId) return;
    setErr(null);
    if (!form.participant_name.trim()) {
      setErr('Enter the participant name.');
      return;
    }
    if (!form.typed_signature.trim()) {
      setErr('Type your signature.');
      return;
    }
    if (!form.unauthorized_initials.trim()) {
      setErr('Add your initials to the unauthorized-entry box.');
      return;
    }
    if (!form.agreed) {
      setErr('You must agree to the waiver to sign it.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('gym_waiver_signatures').insert({
      waiver_id: w.id,
      gym_id: w.gym_id,
      member_id: myId,
      participant_name: form.participant_name.trim(),
      date_of_birth: form.date_of_birth.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      emergency_contact: form.emergency_contact.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      typed_signature: form.typed_signature.trim(),
      signature_data_url: drawnSig,
      unauthorized_initials: form.unauthorized_initials.trim(),
      waiver_title: w.title,
      waiver_snapshot: w.content,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOpenId(null);
    setForm(null);
    load();
  }

  if (waivers === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.charcoal} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Waivers</Text>
        <Text style={styles.sub}>Review and sign your gyms&apos; waivers.</Text>
      </View>

      {waivers.length === 0 ? (
        <Text style={styles.dim}>No waivers to sign right now.</Text>
      ) : (
        waivers.map((w) => {
          const isSigned = !!signed[w.id];
          const isOpen = openId === w.id;
          return (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{w.title}</Text>
                  <Text style={styles.cardGym}>{gymNames[w.gym_id] ?? 'Gym'}</Text>
                </View>
                {isSigned ? (
                  <View style={styles.signedBadge}>
                    <Text style={styles.signedBadgeText}>
                      Signed {new Date(signed[w.id]).toLocaleDateString()}
                    </Text>
                  </View>
                ) : isOpen ? (
                  <Pressable style={styles.ghostBtn} onPress={() => setOpenId(null)}>
                    <Text style={styles.ghostBtnText}>Close</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.btn} onPress={() => openSign(w)}>
                    <Text style={styles.btnText}>Review &amp; sign</Text>
                  </Pressable>
                )}
              </View>

              {isOpen && form ? (
                <View style={styles.signArea}>
                  <View style={styles.waiverBox}>
                    <WaiverBlocksView blocks={parseBlocks(w.content)} />
                  </View>

                  <Text style={styles.section}>Your information</Text>
                  <Field label="Participant name" value={form.participant_name}
                    onChange={(v) => setForm({ ...form, participant_name: v })} />
                  <View style={styles.row}>
                    <Field label="Date of birth" value={form.date_of_birth} flex
                      onChange={(v) => setForm({ ...form, date_of_birth: v })} />
                    <Field label="Phone" value={form.phone} flex
                      onChange={(v) => setForm({ ...form, phone: v })} />
                  </View>
                  <Field label="Email" value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })} />
                  <View style={styles.row}>
                    <Field label="Emergency contact" value={form.emergency_contact} flex
                      onChange={(v) => setForm({ ...form, emergency_contact: v })} />
                    <Field label="Emergency contact phone" value={form.emergency_contact_phone} flex
                      onChange={(v) => setForm({ ...form, emergency_contact_phone: v })} />
                  </View>

                  <Text style={styles.section}>Signature</Text>
                  <Field label="Type your full legal name as signature"
                    value={form.typed_signature}
                    onChange={(v) => setForm({ ...form, typed_signature: v })} />
                  <Text style={styles.label}>Draw your signature</Text>
                  <SignaturePad onChange={setDrawnSig} />

                  <View style={styles.initialsBox}>
                    <Text style={styles.initialsNotice}>{UNAUTHORIZED_ENTRY_NOTICE}</Text>
                    <Field label="Initials" value={form.unauthorized_initials}
                      onChange={(v) => setForm({ ...form, unauthorized_initials: v })} />
                  </View>

                  <Pressable
                    style={styles.agreeRow}
                    onPress={() => setForm({ ...form, agreed: !form.agreed })}
                  >
                    <View style={[styles.checkBox, form.agreed && styles.checkBoxOn]}>
                      {form.agreed ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.agreeText}>
                      I have read this Agreement, understand it, and sign it voluntarily.
                    </Text>
                  </Pressable>

                  {err ? <Text style={styles.err}>{err}</Text> : null}
                  <Pressable
                    style={[styles.btn, styles.signBtn, saving && { opacity: 0.6 }]}
                    onPress={() => submit(w)}
                    disabled={saving}
                  >
                    <Text style={styles.btnText}>{saving ? 'Submitting…' : 'Sign waiver'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && { flex: 1, minWidth: 150 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  center: { padding: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 14, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  cardGym: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  signedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
  },
  signedBadgeText: { fontSize: 12, fontWeight: '800', color: '#047857' },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  signBtn: { alignSelf: 'flex-start', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghostBtnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },

  signArea: { gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12 },
  waiverBox: {
    maxHeight: 320,
    overflow: 'scroll',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fbfcfe',
  },
  section: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.charcoal,
    marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  initialsBox: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  initialsNotice: { fontSize: 13, color: '#92400e', lineHeight: 19 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  agreeText: { flex: 1, fontSize: 14, color: theme.colors.charcoal, lineHeight: 20 },
});
