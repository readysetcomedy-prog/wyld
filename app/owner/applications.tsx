import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Select } from '@/components/Select';
import { SubTabsPage } from '@/components/SubTabs';

type PostingStatus = 'open' | 'closed' | 'draft';
type AppStatus = 'new' | 'reviewing' | 'hired' | 'rejected' | 'withdrawn';

type Role = { id: string; name: string };
type Location = { id: string; label: string | null };

type Posting = {
  id: string;
  gym_id: string;
  title: string;
  role_id: string | null;
  location_id: string | null;
  description: string | null;
  employment_type: string | null;
  compensation: string | null;
  status: PostingStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type PostingForm = {
  id?: string;
  title: string;
  role_id: string;
  location_id: string;
  employment_type: string;
  compensation: string;
  description: string;
  status: PostingStatus;
};

type Application = {
  id: string;
  posting_id: string;
  gym_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  cover_note: string | null;
  status: AppStatus;
  applied_at: string;
  updated_at: string;
};

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: '', label: '(not set)' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Temporary', label: 'Temporary' },
  { value: 'Internship', label: 'Internship' },
];

const POSTING_STATUS_OPTIONS: { value: PostingStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];

function emptyPostingForm(): PostingForm {
  return {
    title: '',
    role_id: '',
    location_id: '',
    employment_type: '',
    compensation: '',
    description: '',
    status: 'open',
  };
}

function statusRank(s: PostingStatus): number {
  if (s === 'open') return 0;
  if (s === 'draft') return 1;
  return 2;
}

function appStatusRank(s: AppStatus): number {
  if (s === 'new') return 0;
  if (s === 'reviewing') return 1;
  if (s === 'hired') return 2;
  if (s === 'rejected') return 3;
  return 4;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function OwnerApplicationsPage() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!gymId) {
      setEnabled(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('gym_modules')
        .select('applications_enabled')
        .eq('gym_id', gymId)
        .maybeSingle();
      setEnabled(!!(data as any)?.applications_enabled);
    })();
  }, [gymId]);

  if (!gymId) {
    return (
      <SubTabsPage
        title="Applications"
        blurb="Post job openings and review applications from your public site."
        tabs={[
          {
            key: 'postings',
            label: 'Postings',
            body: (
              <View style={styles.empty}>
                <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
              </View>
            ),
          },
          {
            key: 'applications',
            label: 'Applications',
            body: (
              <View style={styles.empty}>
                <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
              </View>
            ),
          },
        ]}
      />
    );
  }

  if (enabled === null) {
    return (
      <View style={{ padding: theme.spacing.lg }}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }

  if (!enabled) {
    return (
      <SubTabsPage
        title="Applications"
        blurb="Post job openings and review applications from your public site."
        tabs={[
          {
            key: 'postings',
            label: 'Postings',
            body: <DisabledPlaceholder />,
          },
          {
            key: 'applications',
            label: 'Applications',
            body: <DisabledPlaceholder />,
          },
        ]}
      />
    );
  }

  return (
    <SubTabsPage
      title="Applications"
      blurb="Post job openings to your public site's Careers page and review the applications that come in."
      tabs={[
        { key: 'postings', label: 'Postings', body: <Postings gymId={gymId} /> },
        {
          key: 'applications',
          label: 'Applications',
          body: <Applications gymId={gymId} />,
        },
      ]}
    />
  );
}

function DisabledPlaceholder() {
  return (
    <View style={styles.empty}>
      <Text style={styles.subTitle}>Applications isn&apos;t enabled for your gym yet.</Text>
      <Text style={styles.dim}>
        Ask your WyLD admin to enable the Applications module so you can post jobs
        and accept candidates from your public site.
      </Text>
    </View>
  );
}

function Postings({ gymId }: { gymId: string }) {
  const [postings, setPostings] = useState<Posting[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState<PostingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: ps } = await supabase
      .from('gym_job_postings')
      .select('*')
      .eq('gym_id', gymId);
    const { data: rs } = await supabase
      .from('gym_roles')
      .select('id, name')
      .eq('gym_id', gymId)
      .order('display_order');
    const { data: locs } = await supabase
      .from('gym_locations')
      .select('id, label')
      .eq('gym_id', gymId)
      .order('display_order');
    const { data: apps } = await supabase
      .from('gym_job_applications')
      .select('posting_id')
      .eq('gym_id', gymId);

    const sorted = ((ps as Posting[]) ?? []).slice().sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;
      const d = a.display_order - b.display_order;
      if (d !== 0) return d;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    const cs: Record<string, number> = {};
    ((apps as { posting_id: string }[]) ?? []).forEach((a) => {
      cs[a.posting_id] = (cs[a.posting_id] ?? 0) + 1;
    });
    setPostings(sorted);
    setRoles((rs as Role[]) ?? []);
    setLocations((locs as Location[]) ?? []);
    setCounts(cs);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setErr(null);
    setForm(emptyPostingForm());
  }

  function openEdit(p: Posting) {
    setErr(null);
    setForm({
      id: p.id,
      title: p.title,
      role_id: p.role_id ?? '',
      location_id: p.location_id ?? '',
      employment_type: p.employment_type ?? '',
      compensation: p.compensation ?? '',
      description: p.description ?? '',
      status: p.status,
    });
  }

  async function save() {
    if (!form) return;
    setErr(null);
    if (!form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    setSaving(true);
    const payload = {
      gym_id: gymId,
      title: form.title.trim(),
      role_id: form.role_id || null,
      location_id: form.location_id || null,
      employment_type: form.employment_type || null,
      compensation: form.compensation.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
    };
    if (form.id) {
      const { error } = await supabase
        .from('gym_job_postings')
        .update(payload)
        .eq('id', form.id);
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('gym_job_postings')
        .insert({ ...payload, display_order: postings?.length ?? 0 });
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setForm(null);
    load();
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this posting? Applications attached to it will also be deleted.')) return;
    const { error } = await supabase.from('gym_job_postings').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setForm(null);
    load();
  }

  const roleOptions = useMemo(
    () => [{ value: '', label: '(none)' }, ...roles.map((r) => ({ value: r.id, label: r.name }))],
    [roles]
  );
  const locationOptions = useMemo(
    () => [
      { value: '', label: '(any location)' },
      ...locations.map((l) => ({ value: l.id, label: l.label || 'Untitled location' })),
    ],
    [locations]
  );

  if (postings === null) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  return (
    <View style={styles.root}>
      <Text style={styles.sub}>
        Job ads listed here show up on your public Careers page when set to Open. Draft
        postings stay private; closed postings stop accepting applications.
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {!form ? (
        <Pressable style={styles.btn} onPress={openNew}>
          <Text style={styles.btnText}>+ New posting</Text>
        </Pressable>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{form.id ? 'Edit posting' : 'New posting'}</Text>

          <Section title="Details">
            <Field
              label="Title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="Front desk associate"
            />
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Role</Text>
                <Select
                  ariaLabel="Role"
                  value={form.role_id}
                  onChange={(v) => setForm({ ...form, role_id: v })}
                  options={roleOptions}
                />
                {roles.length === 0 ? (
                  <Text style={styles.dim}>
                    Tip: add roles in Employees → Roles to pick from a dropdown here.
                  </Text>
                ) : null}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Location</Text>
                <Select
                  ariaLabel="Location"
                  value={form.location_id}
                  onChange={(v) => setForm({ ...form, location_id: v })}
                  options={locationOptions}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Employment type</Text>
                <Select
                  ariaLabel="Employment type"
                  value={form.employment_type}
                  onChange={(v) => setForm({ ...form, employment_type: v })}
                  options={EMPLOYMENT_TYPES}
                />
              </View>
              <Field
                label="Compensation"
                value={form.compensation}
                onChange={(v) => setForm({ ...form, compensation: v })}
                placeholder="$18/hr or DOE"
              />
            </View>
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={6}
              placeholder="What the role is about, what you're looking for, what to expect."
            />
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <Select
                ariaLabel="Status"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as PostingStatus })}
                options={POSTING_STATUS_OPTIONS}
              />
            </View>
          </Section>

          <View style={styles.formButtons}>
            <Pressable style={styles.btn} onPress={save} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save posting'}</Text>
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
        postings.length === 0 ? (
          <Text style={styles.dim}>No postings yet. Click &quot;New posting&quot; to create one.</Text>
        ) : (
          <View style={styles.list}>
            {postings.map((p) => {
              const role = roles.find((r) => r.id === p.role_id);
              const loc = locations.find((l) => l.id === p.location_id);
              const count = counts[p.id] ?? 0;
              return (
                <View key={p.id} style={styles.card}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{p.title}</Text>
                      <StatusBadge status={p.status} />
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {count} {count === 1 ? 'applicant' : 'applicants'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      {[
                        role?.name,
                        loc?.label,
                        p.employment_type,
                        p.compensation,
                      ]
                        .filter(Boolean)
                        .join('  ·  ') || '—'}
                    </Text>
                    {p.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {p.description}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable style={styles.editBtn} onPress={() => openEdit(p)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )
      ) : null}
    </View>
  );
}

function Applications({ gymId }: { gymId: string }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [postingsById, setPostingsById] = useState<Record<string, Posting>>({});
  const [rolesById, setRolesById] = useState<Record<string, Role>>({});
  const [filter, setFilter] = useState<'all' | AppStatus>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from('gym_job_applications')
      .select('*')
      .eq('gym_id', gymId);
    const { data: ps } = await supabase
      .from('gym_job_postings')
      .select('*')
      .eq('gym_id', gymId);
    const { data: rs } = await supabase
      .from('gym_roles')
      .select('id, name')
      .eq('gym_id', gymId);

    const list = ((a as Application[]) ?? []).slice().sort((x, y) => {
      const r = appStatusRank(x.status) - appStatusRank(y.status);
      if (r !== 0) return r;
      return (y.applied_at || '').localeCompare(x.applied_at || '');
    });
    const pmap: Record<string, Posting> = {};
    ((ps as Posting[]) ?? []).forEach((p) => {
      pmap[p.id] = p;
    });
    const rmap: Record<string, Role> = {};
    ((rs as Role[]) ?? []).forEach((r) => {
      rmap[r.id] = r;
    });
    setApps(list);
    setPostingsById(pmap);
    setRolesById(rmap);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  function flashNote(msg: string) {
    setNote(msg);
    setTimeout(() => setNote((cur) => (cur === msg ? '' : cur)), 2500);
  }

  async function updateStatus(app: Application, status: AppStatus) {
    setErr(null);
    setBusy((b) => ({ ...b, [app.id]: true }));
    const { error } = await supabase
      .from('gym_job_applications')
      .update({ status })
      .eq('id', app.id);
    setBusy((b) => ({ ...b, [app.id]: false }));
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  async function hire(app: Application) {
    if (!app.user_id) return;
    setErr(null);
    setBusy((b) => ({ ...b, [app.id]: true }));
    const posting = postingsById[app.posting_id];
    const role = posting?.role_id ? rolesById[posting.role_id] : null;
    const position = role?.name || posting?.title || null;

    const insertRes = await supabase.from('gym_employees').insert({
      gym_id: gymId,
      user_id: app.user_id,
      email: app.email,
      full_name: app.full_name,
      position,
      hire_date: todayIso(),
    });
    if (insertRes.error) {
      setErr(insertRes.error.message);
      setBusy((b) => ({ ...b, [app.id]: false }));
      return;
    }

    const { data: existingMembership } = await supabase
      .from('gym_memberships')
      .select('member_id')
      .eq('gym_id', gymId)
      .eq('member_id', app.user_id)
      .maybeSingle();
    if (!existingMembership) {
      const memRes = await supabase
        .from('gym_memberships')
        .insert({ member_id: app.user_id, gym_id: gymId, status: 'active' });
      if (memRes.error) {
        // Non-fatal — still mark hired and tell the user.
        setErr(`Hired, but membership couldn't be created: ${memRes.error.message}`);
      }
    }

    const updRes = await supabase
      .from('gym_job_applications')
      .update({ status: 'hired' })
      .eq('id', app.id);
    setBusy((b) => ({ ...b, [app.id]: false }));
    if (updRes.error) {
      setErr(updRes.error.message);
      return;
    }
    flashNote('Hired — added to roster.');
    load();
  }

  const filtered = useMemo(() => {
    if (!apps) return null;
    if (filter === 'all') return apps;
    return apps.filter((a) => a.status === filter);
  }, [apps, filter]);

  if (apps === null) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  const counts: Record<'all' | AppStatus, number> = {
    all: apps.length,
    new: apps.filter((a) => a.status === 'new').length,
    reviewing: apps.filter((a) => a.status === 'reviewing').length,
    hired: apps.filter((a) => a.status === 'hired').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
    withdrawn: apps.filter((a) => a.status === 'withdrawn').length,
  };

  const chips: { key: 'all' | AppStatus; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'new', label: `New (${counts.new})` },
    { key: 'reviewing', label: `Reviewing (${counts.reviewing})` },
    { key: 'hired', label: `Hired (${counts.hired})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
  ];

  return (
    <View style={styles.root}>
      <Text style={styles.sub}>
        Review applicants and move them through your hiring pipeline. Hiring an
        applicant with a WyLD account adds them to your roster automatically.
      </Text>
      {note ? <Text style={styles.saved}>{note}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.chips}>
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filtered && filtered.length === 0 ? (
        <Text style={styles.dim}>
          {apps.length === 0
            ? 'No applications yet. Once your postings are Open, applicants will show up here.'
            : 'No applications match this filter.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {(filtered ?? []).map((app) => {
            const posting = postingsById[app.posting_id];
            const role = posting?.role_id ? rolesById[posting.role_id] : null;
            const isExpanded = !!expanded[app.id];
            const isBusy = !!busy[app.id];
            const canHire = app.status !== 'hired' && !!app.user_id;
            return (
              <View key={app.id} style={styles.appCard}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName}>{app.full_name}</Text>
                  <AppStatusBadge status={app.status} />
                  {app.user_id ? (
                    <View style={styles.accountBadge}>
                      <Text style={styles.accountBadgeText}>Has WyLD account</Text>
                    </View>
                  ) : (
                    <View style={styles.coldBadge}>
                      <Text style={styles.coldBadgeText}>Cold apply — no account yet</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardMeta}>
                  {[app.email, app.phone].filter(Boolean).join('  ·  ')}
                </Text>
                <Text style={styles.cardMeta}>
                  Applied for{' '}
                  <Text style={styles.bold}>{posting?.title ?? '(deleted posting)'}</Text>
                  {role ? `  ·  ${role.name}` : ''}
                  {'  ·  '}
                  {formatDate(app.applied_at)}
                </Text>

                {app.cover_note ? (
                  <View style={styles.coverWrap}>
                    <Pressable onPress={() => setExpanded((e) => ({ ...e, [app.id]: !isExpanded }))}>
                      <Text style={styles.coverToggle}>
                        {isExpanded ? 'Hide cover note' : 'Show cover note'}
                      </Text>
                    </Pressable>
                    {isExpanded ? (
                      <Text style={styles.coverText}>{app.cover_note}</Text>
                    ) : null}
                  </View>
                ) : null}

                {!app.user_id ? (
                  <View style={styles.hintCard}>
                    <Text style={styles.hintText}>
                      Tell this applicant to create a WyLD account with email{' '}
                      <Text style={styles.bold}>{app.email}</Text>. Once they sign up,
                      you&apos;ll be able to hire them here.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  {app.status !== 'reviewing' && app.status !== 'hired' ? (
                    <Pressable
                      style={styles.btnSecondary}
                      onPress={() => updateStatus(app, 'reviewing')}
                      disabled={isBusy}
                    >
                      <Text style={styles.btnSecondaryText}>Mark reviewing</Text>
                    </Pressable>
                  ) : null}
                  {app.status !== 'rejected' && app.status !== 'hired' ? (
                    <Pressable
                      style={styles.btnSecondary}
                      onPress={() => updateStatus(app, 'rejected')}
                      disabled={isBusy}
                    >
                      <Text style={styles.btnSecondaryText}>Mark rejected</Text>
                    </Pressable>
                  ) : null}
                  {canHire ? (
                    <Pressable
                      style={[styles.btn, isBusy && { opacity: 0.6 }]}
                      onPress={() => hire(app)}
                      disabled={isBusy}
                    >
                      <Text style={styles.btnText}>{isBusy ? 'Hiring…' : 'Hire'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: PostingStatus }) {
  const styleMap: Record<PostingStatus, { bg: string; fg: string; label: string }> = {
    open: { bg: '#dcfce7', fg: '#15803d', label: 'Open' },
    draft: { bg: '#f1f5f9', fg: '#475569', label: 'Draft' },
    closed: { bg: '#fee2e2', fg: '#b91c1c', label: 'Closed' },
  };
  const s = styleMap[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusBadgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function AppStatusBadge({ status }: { status: AppStatus }) {
  const styleMap: Record<AppStatus, { bg: string; fg: string; label: string }> = {
    new: { bg: '#ede9fe', fg: '#5b21b6', label: 'New' },
    reviewing: { bg: '#fef3c7', fg: '#92400e', label: 'Reviewing' },
    hired: { bg: '#dcfce7', fg: '#15803d', label: 'Hired' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c', label: 'Rejected' },
    withdrawn: { bg: '#f1f5f9', fg: '#475569', label: 'Withdrawn' },
  };
  const s = styleMap[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusBadgeText, { color: s.fg }]}>{s.label}</Text>
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
  multiline,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        numberOfLines={multiline ? rows : 1}
        style={[styles.input, multiline && { minHeight: rows * 22, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },
  saved: { color: theme.colors.tealDark, fontSize: 13, fontWeight: '700' },
  bold: { fontWeight: '700', color: theme.colors.charcoal },
  subTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },

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
  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  btnSecondaryText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },

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

  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  cardMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },

  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

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

  appCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 6,
  },
  accountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
  },
  accountBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  coldBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  coldBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  coverWrap: { marginTop: 6, gap: 4 },
  coverToggle: { fontSize: 12, fontWeight: '700', color: theme.colors.wyldPurple },
  coverText: {
    fontSize: 13,
    color: theme.colors.charcoal,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hintCard: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  hintText: { fontSize: 13, color: '#78350f' },

  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
});
