// Employee-side profile for one specific gym — the employee can edit their
// personal info + emergency contacts (the soft stuff); job/credentials are
// read-only, owner-managed. The avatar shown is the cross-gym profile
// avatar (uploaded from /member/profile), not a per-gym one.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';

const WORK_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  seasonal: 'Seasonal',
  intern: 'Intern',
};

type Employee = {
  id: string;
  gym_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  avatar_url: string | null;
  position: string | null;
  is_management: boolean;
  hire_date: string | null;
  terminate_date: string | null;
  work_type: string | null;
  direct_supervisor_id: string | null;
};

type Credential = { id: string; label: string; number: string | null; expires_at: string | null };
type EmergencyContact = { id?: string; name: string; relation: string; phone: string; email: string };

type Extras = {
  supervisorName: string | null;
  locationLabels: string[];
  credentials: Credential[];
};

export function EmployeeProfileEditor({ gymId }: { gymId: string }) {
  const { profile } = useAuth();
  const router = useRouter();

  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [personal, setPersonal] = useState({
    phone: '', address_line1: '', address_line2: '', city: '', state: '', zip: '',
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id || !gymId) return;
    const { data } = await supabase
      .from('gym_employees')
      .select('*')
      .eq('gym_id', gymId)
      .or(`user_id.eq.${profile.id},email.eq.${profile.email}`)
      .maybeSingle();
    setEmployee((data as Employee) ?? null);
  }, [profile?.id, profile?.email, gymId]);

  useEffect(() => { load(); }, [load]);

  // Pull extras + populate editable fields when the employee record loads.
  useEffect(() => {
    if (!employee) { setExtras(null); return; }
    setPersonal({
      phone: employee.phone ?? '',
      address_line1: employee.address_line1 ?? '',
      address_line2: employee.address_line2 ?? '',
      city: employee.city ?? '',
      state: employee.state ?? '',
      zip: employee.zip ?? '',
    });
    (async () => {
      const [supervisor, { data: locLinks }, { data: creds }, { data: ecs }] = await Promise.all([
        employee.direct_supervisor_id
          ? supabase.from('gym_employees').select('full_name').eq('id', employee.direct_supervisor_id).maybeSingle()
          : Promise.resolve({ data: null as any }),
        supabase.from('gym_employee_locations').select('location_id').eq('employee_id', employee.id),
        supabase.from('gym_employee_credentials').select('*').eq('employee_id', employee.id).order('display_order'),
        supabase.from('gym_employee_emergency_contacts').select('*').eq('employee_id', employee.id).order('display_order'),
      ]);
      const locIds = ((locLinks as any) ?? []).map((r: any) => r.location_id);
      const labels: string[] = [];
      if (locIds.length > 0) {
        const { data: locs } = await supabase.from('gym_locations').select('label').in('id', locIds);
        (locs ?? []).forEach((l: any) => labels.push(l.label || 'Location'));
      }
      setExtras({
        supervisorName: (supervisor.data as any)?.full_name ?? null,
        locationLabels: labels,
        credentials: (creds as Credential[]) ?? [],
      });
      setEmergencyContacts(((ecs as any) ?? []).map((c: any) => ({
        id: c.id, name: c.name ?? '', relation: c.relation ?? '',
        phone: c.phone ?? '', email: c.email ?? '',
      })));
    })();
  }, [employee?.id]);

  async function savePersonal() {
    if (!employee) return;
    setErr(null);
    setSaving(true);
    const { error } = await supabase.rpc('update_my_employee_profile', {
      p_employee_id: employee.id,
      p_phone: personal.phone.trim() || null,
      p_address_line1: personal.address_line1.trim() || null,
      p_address_line2: personal.address_line2.trim() || null,
      p_city: personal.city.trim() || null,
      p_state: personal.state.trim() || null,
      p_zip: personal.zip.trim() || null,
      p_avatar_url: null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSavedAt(Date.now());
    load();
  }

  async function saveEmergencyContacts() {
    if (!employee) return;
    setErr(null);
    setSaving(true);
    await supabase.from('gym_employee_emergency_contacts').delete().eq('employee_id', employee.id);
    const cleaned = emergencyContacts.filter((c) => c.name.trim() || c.phone.trim());
    if (cleaned.length > 0) {
      const { error } = await supabase.from('gym_employee_emergency_contacts').insert(
        cleaned.map((c, i) => ({
          employee_id: employee.id,
          name: c.name.trim() || 'Contact',
          relation: c.relation.trim() || null,
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
          display_order: i,
        }))
      );
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setSavedAt(Date.now());
  }

  if (employee === undefined) {
    return <ActivityIndicator color={theme.colors.charcoal} />;
  }
  if (!employee) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Employee Profile</Text>
        <Text style={styles.body}>
          You aren't on this gym's staff roster. If they've hired you, ask them
          to add you using your email: <Text style={styles.mono}>{profile?.email}</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Employee Profile</Text>
        <Text style={styles.sub}>
          {employee.position || 'Employee'}{employee.is_management ? '  ·  Management' : ''}
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.headerCard}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>
              {(employee.full_name || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.headerName}>{employee.full_name}</Text>
          <Text style={styles.headerMeta}>{employee.email}</Text>
          <Pressable onPress={() => router.push('/member/profile' as never)}>
            <Text style={styles.headerLink}>
              {profile?.avatar_url ? 'Change photo in your profile →' : 'Add a profile photo →'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Personal info</Text>
          <Text style={styles.sectionHint}>You can edit this.</Text>
        </View>
        <View style={styles.row}>
          <Field label="Phone" value={personal.phone} onChange={(v) => setPersonal({ ...personal, phone: v })} />
          <Field label="Email" value={employee.email} onChange={() => {}} disabled hint="Ask your supervisor to change this." />
        </View>
        <Field label="Street address" value={personal.address_line1} onChange={(v) => setPersonal({ ...personal, address_line1: v })} />
        <Field label="Suite / unit" value={personal.address_line2} onChange={(v) => setPersonal({ ...personal, address_line2: v })} />
        <View style={styles.row}>
          <Field label="City" value={personal.city} onChange={(v) => setPersonal({ ...personal, city: v })} />
          <Field label="State" value={personal.state} onChange={(v) => setPersonal({ ...personal, state: v })} />
          <Field label="ZIP" value={personal.zip} onChange={(v) => setPersonal({ ...personal, zip: v })} />
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={savePersonal} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save personal info'}</Text>
          </Pressable>
          {savedAt ? <Text style={styles.savedText}>Saved.</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Emergency contacts</Text>
          <Text style={styles.sectionHint}>You can edit these.</Text>
        </View>
        {emergencyContacts.map((c, i) => (
          <View key={i} style={styles.subRow}>
            <TextInput value={c.name}
              onChangeText={(v) => setEmergencyContacts(emergencyContacts.map((x, j) => j === i ? { ...x, name: v } : x))}
              placeholder="Name" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 2, minWidth: 140 }]} />
            <TextInput value={c.relation}
              onChangeText={(v) => setEmergencyContacts(emergencyContacts.map((x, j) => j === i ? { ...x, relation: v } : x))}
              placeholder="Relation" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1, minWidth: 100 }]} />
            <TextInput value={c.phone}
              onChangeText={(v) => setEmergencyContacts(emergencyContacts.map((x, j) => j === i ? { ...x, phone: v } : x))}
              placeholder="Phone" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1.5, minWidth: 120 }]} />
            <TextInput value={c.email}
              onChangeText={(v) => setEmergencyContacts(emergencyContacts.map((x, j) => j === i ? { ...x, email: v } : x))}
              placeholder="Email" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 2, minWidth: 150 }]} />
            <Pressable onPress={() => setEmergencyContacts(emergencyContacts.filter((_, j) => j !== i))} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.btnSmall}
          onPress={() => setEmergencyContacts([...emergencyContacts, { name: '', relation: '', phone: '', email: '' }])}>
          <Text style={styles.btnSmallText}>+ Add emergency contact</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={saveEmergencyContacts} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save emergency contacts'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.lockedSection}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Job</Text>
          <Text style={styles.lockedHint}>Request changes from your supervisor.</Text>
        </View>
        <View style={styles.readGrid}>
          <ReadField label="Position" value={employee.position} />
          <ReadField label="Work type" value={employee.work_type ? WORK_TYPE_LABEL[employee.work_type] || employee.work_type : null} />
          <ReadField label="Hire date" value={employee.hire_date} />
          <ReadField label="Termination date" value={employee.terminate_date} />
          <ReadField label="Direct supervisor" value={extras?.supervisorName ?? null} />
          <ReadField label="Locations" value={extras && extras.locationLabels.length > 0 ? extras.locationLabels.join(', ') : null} />
          <ReadField label="Management role" value={employee.is_management ? 'Yes' : 'No'} />
        </View>
      </View>

      <View style={styles.lockedSection}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Credentials &amp; licenses</Text>
          <Text style={styles.lockedHint}>Request changes from your supervisor.</Text>
        </View>
        {extras && extras.credentials.length > 0 ? (
          <View style={{ gap: 6 }}>
            {extras.credentials.map((c) => (
              <View key={c.id} style={styles.credRow}>
                <Text style={styles.credLabel}>{c.label}</Text>
                <Text style={styles.credMeta}>
                  {c.number ? c.number : '—'}{c.expires_at ? `  ·  expires ${c.expires_at}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.dim}>None on file.</Text>
        )}
      </View>
    </View>
  );
}

function Field({
  label, value, onChange, disabled, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} editable={!disabled} placeholderTextColor="#94a3b8"
        style={[styles.input, disabled && styles.inputDisabled]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.readItem}>
      <Text style={styles.readLabel}>{label}</Text>
      <Text style={styles.readValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, maxWidth: 900 },
  empty: { gap: 8, padding: theme.spacing.lg, maxWidth: 720 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  body: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 23, marginTop: 4 },
  mono: { fontFamily: 'monospace', color: theme.colors.charcoal },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  hint: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  savedText: { color: theme.colors.tealDark, fontWeight: '700', fontSize: 14 },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  headerName: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  headerMeta: { fontSize: 13, color: theme.colors.textSecondary },
  headerLink: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e2e8f0' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },

  section: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' },
  lockedSection: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  sectionHint: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  lockedHint: { fontSize: 12, color: theme.colors.wyldPurple, fontWeight: '700' },

  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 180, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff', color: theme.colors.charcoal,
  },
  inputDisabled: { backgroundColor: theme.colors.surface, color: theme.colors.textSecondary },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.wyldPurple },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSmall: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  btnSmallText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },

  subRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: theme.colors.charcoal, fontWeight: '700' },

  readGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  readItem: { minWidth: 200, gap: 2 },
  readLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
  readValue: { fontSize: 15, color: theme.colors.charcoal, fontWeight: '600' },

  credRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  credLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  credMeta: { fontSize: 12, color: theme.colors.textSecondary },
});
