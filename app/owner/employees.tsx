import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import { DateTimeField } from '@/components/DateTimeField';
import { SubTabsPage } from '@/components/SubTabs';

const WORK_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'intern', label: 'Intern' },
];

type Permissions = {
  perm_billing: boolean;
  perm_website: boolean;
  perm_messages: boolean;
  perm_calendar: boolean;
  perm_bookings: boolean;
  perm_members: boolean;
  perm_employees: boolean;
  perm_applications: boolean;
  perm_store: boolean;
  perm_marketing: boolean;
  perm_analytics: boolean;
  perm_revenue_expenses: boolean;
  perm_door: boolean;
  perm_offerings: boolean;
  perm_settings: boolean;
};

const PERMISSION_LABELS: { key: keyof Permissions; label: string }[] = [
  { key: 'perm_billing', label: 'Billing' },
  { key: 'perm_website', label: 'Website' },
  { key: 'perm_messages', label: 'Messages' },
  { key: 'perm_calendar', label: 'Calendar' },
  { key: 'perm_bookings', label: 'Bookings' },
  { key: 'perm_members', label: 'Members' },
  { key: 'perm_employees', label: 'Employees' },
  { key: 'perm_applications', label: 'Applications' },
  { key: 'perm_store', label: 'Store' },
  { key: 'perm_marketing', label: 'Marketing' },
  { key: 'perm_analytics', label: 'Analytics & Reporting' },
  { key: 'perm_revenue_expenses', label: 'Revenue & Expenses' },
  { key: 'perm_door', label: 'Door Management' },
  { key: 'perm_offerings', label: 'Offerings' },
  { key: 'perm_settings', label: 'Settings' },
];

const EMPTY_PERMS: Permissions = {
  perm_billing: false,
  perm_website: false,
  perm_messages: false,
  perm_calendar: false,
  perm_bookings: false,
  perm_members: false,
  perm_employees: false,
  perm_applications: false,
  perm_store: false,
  perm_marketing: false,
  perm_analytics: false,
  perm_revenue_expenses: false,
  perm_door: false,
  perm_offerings: false,
  perm_settings: false,
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
} & Permissions;

type Credential = {
  id?: string;
  label: string;
  number: string;
  expires_at: string | null;
};
type EmergencyContact = {
  id?: string;
  name: string;
  relation: string;
  phone: string;
  email: string;
};

type Form = {
  id?: string;
  email: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  avatar_url: string | null;
  position: string;
  is_management: boolean;
  hire_date: Date | null;
  terminate_date: Date | null;
  work_type: string;
  direct_supervisor_id: string | null;
  location_ids: string[];
  perms: Permissions;
  credentials: Credential[];
  emergency_contacts: EmergencyContact[];
};

function emptyForm(): Form {
  return {
    email: '',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    avatar_url: null,
    position: '',
    is_management: false,
    hire_date: null,
    terminate_date: null,
    work_type: '',
    direct_supervisor_id: null,
    location_ids: [],
    perms: { ...EMPTY_PERMS },
    credentials: [],
    emergency_contacts: [],
  };
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function OwnerEmployees() {
  return (
    <SubTabsPage
      title="Employees"
      blurb="Roles, schedules, payroll, and HR for your team — all in one place."
      tabs={[
        { key: 'roster', label: 'Roster', body: <Roster /> },
        { key: 'roles', label: 'Roles', body: <RolesEditor /> },
        {
          key: 'time-cards',
          label: 'Time Cards',
          body: 'Clock-ins and clock-outs, total hours per pay period, and exports for payroll.',
        },
        {
          key: 'scheduling',
          label: 'Scheduling',
          body: 'Build shifts, publish a schedule, and let your team request changes.',
        },
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

export function Roster({ gymId: gymIdProp }: { gymId?: string | null } = {}) {
  const { profile } = useAuth();
  const gymId = gymIdProp ?? profile?.gym_id ?? null;

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [locations, setLocations] = useState<{ id: string; label: string | null }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [memberPicker, setMemberPicker] = useState(false);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: e }, { data: locs }, { data: rs }] = await Promise.all([
      supabase
        .from('gym_employees')
        .select('*')
        .eq('gym_id', gymId)
        .order('display_order')
        .order('full_name'),
      supabase
        .from('gym_locations')
        .select('id, label')
        .eq('gym_id', gymId)
        .order('display_order'),
      supabase
        .from('gym_roles')
        .select('id, name')
        .eq('gym_id', gymId)
        .order('display_order'),
    ]);
    setEmployees((e as Employee[]) ?? []);
    setLocations((locs as any) ?? []);
    setRoles((rs as any) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setErr(null);
    setForm(emptyForm());
  }

  async function openEdit(e: Employee) {
    setErr(null);
    const [{ data: creds }, { data: ecs }, { data: locLinks }] = await Promise.all([
      supabase
        .from('gym_employee_credentials')
        .select('*')
        .eq('employee_id', e.id)
        .order('display_order'),
      supabase
        .from('gym_employee_emergency_contacts')
        .select('*')
        .eq('employee_id', e.id)
        .order('display_order'),
      supabase.from('gym_employee_locations').select('location_id').eq('employee_id', e.id),
    ]);
    setForm({
      id: e.id,
      email: e.email,
      full_name: e.full_name,
      phone: e.phone ?? '',
      address_line1: e.address_line1 ?? '',
      address_line2: e.address_line2 ?? '',
      city: e.city ?? '',
      state: e.state ?? '',
      zip: e.zip ?? '',
      avatar_url: e.avatar_url,
      position: e.position ?? '',
      is_management: e.is_management,
      hire_date: parseIsoDate(e.hire_date),
      terminate_date: parseIsoDate(e.terminate_date),
      work_type: e.work_type ?? '',
      direct_supervisor_id: e.direct_supervisor_id,
      location_ids: ((locLinks as any) ?? []).map((l: any) => l.location_id),
      perms: {
        perm_billing: e.perm_billing,
        perm_website: e.perm_website,
        perm_messages: e.perm_messages,
        perm_calendar: e.perm_calendar,
        perm_bookings: e.perm_bookings,
        perm_members: e.perm_members,
        perm_employees: e.perm_employees,
        perm_applications: e.perm_applications,
        perm_store: e.perm_store,
        perm_marketing: e.perm_marketing,
        perm_analytics: e.perm_analytics,
        perm_revenue_expenses: e.perm_revenue_expenses,
        perm_door: e.perm_door,
        perm_offerings: e.perm_offerings,
        perm_settings: e.perm_settings,
      },
      credentials: ((creds as any) ?? []).map((c: any) => ({
        id: c.id,
        label: c.label ?? '',
        number: c.number ?? '',
        expires_at: c.expires_at,
      })),
      emergency_contacts: ((ecs as any) ?? []).map((c: any) => ({
        id: c.id,
        name: c.name ?? '',
        relation: c.relation ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
      })),
    });
  }

  async function save() {
    if (!form || !gymId) return;
    setErr(null);
    if (!form.full_name.trim() || !form.email.trim()) {
      setErr('Name and email are required.');
      return;
    }
    setSaving(true);
    const payload: any = {
      gym_id: gymId,
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      position: form.position.trim() || null,
      is_management: form.is_management,
      hire_date: toIsoDate(form.hire_date),
      terminate_date: toIsoDate(form.terminate_date),
      work_type: form.work_type || null,
      direct_supervisor_id: form.direct_supervisor_id,
      ...form.perms,
    };
    let id = form.id;
    if (id) {
      const { error } = await supabase.from('gym_employees').update(payload).eq('id', id);
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('gym_employees')
        .insert({ ...payload, display_order: employees?.length ?? 0 })
        .select('id')
        .single();
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
      id = (data as any).id as string;
    }

    // Sync sub-tables: delete + reinsert.
    await Promise.all([
      supabase.from('gym_employee_credentials').delete().eq('employee_id', id),
      supabase.from('gym_employee_emergency_contacts').delete().eq('employee_id', id),
      supabase.from('gym_employee_locations').delete().eq('employee_id', id),
    ]);
    const creds = form.credentials.filter(
      (c) => c.label.trim() || c.number.trim() || c.expires_at
    );
    if (creds.length > 0) {
      await supabase.from('gym_employee_credentials').insert(
        creds.map((c, i) => ({
          employee_id: id,
          label: c.label.trim() || 'Credential',
          number: c.number.trim() || null,
          expires_at: c.expires_at,
          display_order: i,
        }))
      );
    }
    const ecs = form.emergency_contacts.filter((c) => c.name.trim() || c.phone.trim());
    if (ecs.length > 0) {
      await supabase.from('gym_employee_emergency_contacts').insert(
        ecs.map((c, i) => ({
          employee_id: id,
          name: c.name.trim() || 'Contact',
          relation: c.relation.trim() || null,
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
          display_order: i,
        }))
      );
    }
    if (form.location_ids.length > 0) {
      await supabase
        .from('gym_employee_locations')
        .insert(form.location_ids.map((lid) => ({ employee_id: id, location_id: lid })));
    }

    setSaving(false);
    setForm(null);
    load();
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this employee?')) return;
    const { error } = await supabase.from('gym_employees').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setForm(null);
    load();
  }

  const supervisorOptions = useMemo(
    () => [
      { value: '', label: '(none)' },
      ...((employees ?? [])
        .filter((e) => e.id !== form?.id)
        .map((e) => ({ value: e.id, label: e.full_name }))),
    ],
    [employees, form?.id]
  );

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }
  if (employees === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <View style={styles.root}>
      <Text style={styles.sub}>
        Add and manage your team. Once an employee signs up with the email you enter
        here, their account links to this record automatically.
      </Text>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {memberPicker ? (
        <MemberPicker
          gymId={gymId}
          onCancel={() => setMemberPicker(false)}
          onPick={(m) => {
            setMemberPicker(false);
            const f = emptyForm();
            f.email = m.email;
            f.full_name = m.full_name ?? '';
            setForm(f);
          }}
        />
      ) : !form ? (
        <View style={styles.subRow}>
          <Pressable style={styles.btn} onPress={openNew}>
            <Text style={styles.btnText}>+ Add employee</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={() => setMemberPicker(true)}
          >
            <Text style={[styles.btnText, { color: theme.colors.charcoal }]}>
              Search members…
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{form.id ? 'Edit' : 'New'} employee</Text>

          <Section title="Basics">
            <View style={styles.row}>
              <Field
                label="Full name"
                value={form.full_name}
                onChange={(v) => setForm({ ...form, full_name: v })}
              />
              <Field
                label="Email (used to link their account)"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="jane@example.com"
              />
            </View>
            <View style={styles.row}>
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <View style={styles.field}>
                <Text style={styles.label}>Position / role</Text>
                {roles.length === 0 ? (
                  <>
                    <TextInput
                      value={form.position}
                      onChangeText={(v) => setForm({ ...form, position: v })}
                      placeholder="Front desk, Trainer, Manager…"
                      placeholderTextColor="#94a3b8"
                      style={styles.input}
                    />
                    <Text style={styles.dim}>
                      Tip: add roles in the Roles subtab to pick from a dropdown here.
                    </Text>
                  </>
                ) : (
                  <Select
                    ariaLabel="Position"
                    value={form.position}
                    onChange={(v) => setForm({ ...form, position: v })}
                    placeholder="Pick a role…"
                    options={[
                      { value: '', label: '(none)' },
                      ...roles.map((r) => ({ value: r.name, label: r.name })),
                    ]}
                  />
                )}
              </View>
            </View>
          </Section>

          <Section title="Address">
            <Field
              label="Street address"
              value={form.address_line1}
              onChange={(v) => setForm({ ...form, address_line1: v })}
            />
            <Field
              label="Suite / unit"
              value={form.address_line2}
              onChange={(v) => setForm({ ...form, address_line2: v })}
            />
            <View style={styles.row}>
              <Field
                label="City"
                value={form.city}
                onChange={(v) => setForm({ ...form, city: v })}
              />
              <Field
                label="State"
                value={form.state}
                onChange={(v) => setForm({ ...form, state: v })}
              />
              <Field
                label="ZIP"
                value={form.zip}
                onChange={(v) => setForm({ ...form, zip: v })}
              />
            </View>
          </Section>

          <Section title="Job">
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Hire date</Text>
                <DateTimeField
                  mode="date"
                  value={form.hire_date}
                  onChange={(d) => setForm({ ...form, hire_date: d })}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Termination date (if any)</Text>
                <DateTimeField
                  mode="date"
                  value={form.terminate_date}
                  onChange={(d) => setForm({ ...form, terminate_date: d })}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Work type</Text>
                <Select
                  ariaLabel="Work type"
                  value={form.work_type}
                  onChange={(v) => setForm({ ...form, work_type: v })}
                  options={WORK_TYPES}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Direct supervisor</Text>
                <Select
                  ariaLabel="Direct supervisor"
                  value={form.direct_supervisor_id ?? ''}
                  onChange={(v) => setForm({ ...form, direct_supervisor_id: v || null })}
                  options={supervisorOptions}
                />
              </View>
            </View>

            <Text style={styles.label}>Locations they work</Text>
            {locations.length === 0 ? (
              <Text style={styles.dim}>No locations yet — add them in the Website tab.</Text>
            ) : (
              <View style={styles.chips}>
                {locations.map((l) => {
                  const on = form.location_ids.includes(l.id);
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() =>
                        setForm({
                          ...form,
                          location_ids: on
                            ? form.location_ids.filter((x) => x !== l.id)
                            : [...form.location_ids, l.id],
                        })
                      }
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {on ? '✓ ' : ''}
                        {l.label || 'Location'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.toggleRow}>
              <Switch
                value={form.is_management}
                onValueChange={(v) => setForm({ ...form, is_management: v })}
              />
              <Text style={styles.label}>This is a management position</Text>
            </View>

            {form.is_management ? (
              <View style={styles.permsBox}>
                <Text style={styles.subTitle}>Owner-side access</Text>
                <Text style={styles.dim}>
                  Pick which owner tabs they can see and manage.
                </Text>
                <View style={styles.permsGrid}>
                  {PERMISSION_LABELS.map((p) => (
                    <View key={p.key} style={styles.permRow}>
                      <Switch
                        value={form.perms[p.key]}
                        onValueChange={(v) =>
                          setForm({ ...form, perms: { ...form.perms, [p.key]: v } })
                        }
                      />
                      <Text style={styles.permLabel}>{p.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Section>

          <Section title="Credentials &amp; licenses">
            <Text style={styles.dim}>
              Anything with an expiration — driver&apos;s license, certifications, specialty licenses, etc.
            </Text>
            {form.credentials.map((c, i) => (
              <View key={i} style={styles.subRow}>
                <TextInput
                  value={c.label}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      credentials: form.credentials.map((x, j) =>
                        j === i ? { ...x, label: v } : x
                      ),
                    })
                  }
                  placeholder="Driver's license"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 2, minWidth: 140 }]}
                />
                <TextInput
                  value={c.number}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      credentials: form.credentials.map((x, j) =>
                        j === i ? { ...x, number: v } : x
                      ),
                    })
                  }
                  placeholder="Number (optional)"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 2, minWidth: 130 }]}
                />
                <View style={{ flex: 1.5, minWidth: 140 }}>
                  <DateTimeField
                    mode="date"
                    placeholder="Expiration"
                    value={parseIsoDate(c.expires_at)}
                    onChange={(d) =>
                      setForm({
                        ...form,
                        credentials: form.credentials.map((x, j) =>
                          j === i ? { ...x, expires_at: toIsoDate(d) } : x
                        ),
                      })
                    }
                  />
                </View>
                <Pressable
                  onPress={() =>
                    setForm({
                      ...form,
                      credentials: form.credentials.filter((_, j) => j !== i),
                    })
                  }
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconBtnText}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.btnSmall}
              onPress={() =>
                setForm({
                  ...form,
                  credentials: [
                    ...form.credentials,
                    { label: '', number: '', expires_at: null },
                  ],
                })
              }
            >
              <Text style={styles.btnSmallText}>+ Add credential</Text>
            </Pressable>
          </Section>

          <Section title="Emergency contacts">
            {form.emergency_contacts.map((c, i) => (
              <View key={i} style={styles.subRow}>
                <TextInput
                  value={c.name}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      emergency_contacts: form.emergency_contacts.map((x, j) =>
                        j === i ? { ...x, name: v } : x
                      ),
                    })
                  }
                  placeholder="Name"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 2, minWidth: 130 }]}
                />
                <TextInput
                  value={c.relation}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      emergency_contacts: form.emergency_contacts.map((x, j) =>
                        j === i ? { ...x, relation: v } : x
                      ),
                    })
                  }
                  placeholder="Relation"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 1.2, minWidth: 100 }]}
                />
                <TextInput
                  value={c.phone}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      emergency_contacts: form.emergency_contacts.map((x, j) =>
                        j === i ? { ...x, phone: v } : x
                      ),
                    })
                  }
                  placeholder="Phone"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 1.5, minWidth: 120 }]}
                />
                <TextInput
                  value={c.email}
                  onChangeText={(v) =>
                    setForm({
                      ...form,
                      emergency_contacts: form.emergency_contacts.map((x, j) =>
                        j === i ? { ...x, email: v } : x
                      ),
                    })
                  }
                  placeholder="Email"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { flex: 2, minWidth: 150 }]}
                />
                <Pressable
                  onPress={() =>
                    setForm({
                      ...form,
                      emergency_contacts: form.emergency_contacts.filter((_, j) => j !== i),
                    })
                  }
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconBtnText}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.btnSmall}
              onPress={() =>
                setForm({
                  ...form,
                  emergency_contacts: [
                    ...form.emergency_contacts,
                    { name: '', relation: '', phone: '', email: '' },
                  ],
                })
              }
            >
              <Text style={styles.btnSmallText}>+ Add emergency contact</Text>
            </Pressable>
          </Section>

          <View style={styles.formButtons}>
            <Pressable style={styles.btn} onPress={save} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save employee'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setForm(null)}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            {form.id ? (
              <Pressable style={styles.btnDanger} onPress={() => remove(form.id!)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {!form ? (
        employees.length === 0 ? (
          <Text style={styles.dim}>No employees yet. Add your first one above.</Text>
        ) : (
          <View style={styles.list}>
            {employees.map((e) => (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  {e.avatar_url ? (
                    <Image source={{ uri: e.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitials}>
                        {(e.full_name || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{e.full_name}</Text>
                    <Text style={styles.cardMeta}>
                      {e.position || '—'}
                      {e.is_management ? '  ·  Management' : ''}
                      {e.terminate_date ? '  ·  Terminated' : ''}
                    </Text>
                    <Text style={styles.cardEmail}>{e.email}</Text>
                  </View>
                </View>
                <Pressable style={styles.editBtn} onPress={() => openEdit(e)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

// Manage the gym's role/title list. Picked from in the Roster's Position
// dropdown. Owner / admin only (via RLS).
export function RolesEditor({ gymId: gymIdProp }: { gymId?: string | null } = {}) {
  const { profile } = useAuth();
  const gymId = gymIdProp ?? profile?.gym_id ?? null;
  const [roles, setRoles] = useState<{ id: string; name: string; display_order: number }[] | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const { data } = await supabase
      .from('gym_roles')
      .select('id, name, display_order')
      .eq('gym_id', gymId)
      .order('display_order')
      .order('name');
    setRoles((data as any) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!gymId) return;
    const name = draft.trim();
    if (!name) return;
    setErr(null);
    const { error } = await supabase
      .from('gym_roles')
      .insert({ gym_id: gymId, name, display_order: roles?.length ?? 0 });
    if (error) {
      setErr(error.message);
      return;
    }
    setDraft('');
    load();
  }

  async function rename(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from('gym_roles').update({ name: name.trim() }).eq('id', id);
    load();
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this role?')) return;
    const { error } = await supabase.from('gym_roles').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }
  if (roles === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <View style={styles.root}>
      <Text style={styles.sub}>
        Add the roles your team can hold — Front desk, Trainer, Manager, etc. These
        show up as a dropdown on the Roster.
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.subRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="New role"
          placeholderTextColor="#94a3b8"
          onSubmitEditing={add}
          style={[styles.input, { flex: 1, minWidth: 180 }]}
        />
        <Pressable style={styles.btn} onPress={add}>
          <Text style={styles.btnText}>+ Add role</Text>
        </Pressable>
      </View>

      {roles.length === 0 ? (
        <Text style={styles.dim}>No roles yet — add one above.</Text>
      ) : (
        <View style={styles.list}>
          {roles.map((r) => (
            <View key={r.id} style={styles.subRow}>
              <TextInput
                defaultValue={r.name}
                onEndEditing={(e) => {
                  const v = e.nativeEvent.text;
                  if (v && v !== r.name) rename(r.id, v);
                }}
                style={[styles.input, { flex: 1, minWidth: 180 }]}
              />
              <Pressable onPress={() => remove(r.id)} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Search the gym's own members (anyone with a gym_memberships row at this
// gym) and pick one to pre-fill the new-employee form.
function MemberPicker({
  gymId,
  onCancel,
  onPick,
}: {
  gymId: string | null;
  onCancel: () => void;
  onPick: (m: { user_id: string; email: string; full_name: string | null }) => void;
}) {
  const [rows, setRows] = useState<
    { user_id: string; email: string; full_name: string | null }[] | null
  >(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      // gym_memberships -> profile lookup. Two queries to stay TS-clean.
      const { data: mems } = await supabase
        .from('gym_memberships')
        .select('member_id')
        .eq('gym_id', gymId);
      const ids = ((mems as any[]) ?? []).map((m) => m.member_id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ids);
      setRows(
        ((profs as any[]) ?? []).map((p) => ({
          user_id: p.id,
          email: p.email,
          full_name: p.full_name,
        }))
      );
    })();
  }, [gymId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.full_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <View style={styles.formCard}>
      <View style={styles.subRow}>
        <Text style={styles.formTitle}>Pick a member to hire</Text>
        <Pressable onPress={onCancel} style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>
      </View>
      <Text style={styles.dim}>
        Only your gym&apos;s current members appear here. Anyone you want to hire who
        isn&apos;t a member yet should sign up and join the gym first, then come back.
      </Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email…"
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
      {rows === null ? (
        <ActivityIndicator color={theme.colors.charcoal} />
      ) : filtered.length === 0 ? (
        <Text style={styles.dim}>
          {rows.length === 0
            ? 'No members yet at this gym.'
            : 'No members match that search.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((r) => (
            <Pressable
              key={r.user_id}
              onPress={() => onPick(r)}
              style={styles.pickerRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerName}>{r.full_name || '—'}</Text>
                <Text style={styles.pickerEmail}>{r.email}</Text>
              </View>
              <Text style={[styles.btnText, { color: theme.colors.wyldPurple }]}>
                Pick →
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },

  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
  btnDanger: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  btnDangerText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  btnSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSmallText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },

  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 14,
  },
  formTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },

  section: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  subTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.charcoal },

  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 180, gap: 4 },
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

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#f3effe', borderColor: theme.colors.wyldPurple },
  chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.wyldPurple },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  permsBox: {
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  permsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 200 },
  permLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.charcoal },

  subRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: theme.colors.charcoal, fontWeight: '700' },

  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  cardMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardEmail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  pickerName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  pickerEmail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
});
