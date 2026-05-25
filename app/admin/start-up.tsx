// WyLD's own startup tracker. Lives under /admin/start-up and is strictly
// admin-only (RLS enforced on every backing table). Four tabs:
//
// - Overview: roll-ups (cash in, cash out, what we still owe whom,
//   open vs done milestones, contributor count).
// - Expenses: out-of-pocket spend logged by founder/contributor/vendor,
//   with reimbursement state, optional receipt URL, and category.
// - Contributors: founders / investors / advisors and what each put in
//   (cash + equity %). Equity total is shown so the cap table balance
//   is visible at a glance.
// - Milestones: open + done goals (LLC formed, first paying customer,
//   etc.) with target dates.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Modal,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { SubTabsPage } from '@/components/SubTabs';
import { Select } from '@/components/Select';
import { DateTimeField } from '@/components/DateTimeField';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

// YYYY-MM-DD <-> Date helpers. DB stores dates as ISO date strings;
// DateTimeField works with JS Dates. Conversion goes through midnight
// local so a date typed as "2026-05-25" round-trips cleanly.
function dateStrToDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Normalize 'YYYY-MM-DD' to local midnight (avoid UTC -1 day rendering).
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}
function dateToStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const moneyShort = (cents: number) =>
  Math.abs(cents) >= 100_000_00
    ? `$${(cents / 100_000_00).toFixed(1)}M`
    : Math.abs(cents) >= 1_000_00
    ? `$${(cents / 1_000_00).toFixed(1)}k`
    : money(cents);

const cleanNum = (s: string) => s.replace(/[^0-9.]/g, '');
const dollarsToCents = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const centsToStr = (c: number) => (c ? (c / 100).toFixed(2) : '');

const EXPENSE_CATEGORIES = [
  'Legal / formation',
  'Software / tools',
  'Hosting / infra',
  'Marketing',
  'Office / equipment',
  'Travel',
  'Professional services',
  'Other',
];

const STATUS_COLORS: Record<string, string> = {
  unreimbursed: '#B45309',
  reimbursed: '#15803D',
};
const STATUS_LABELS: Record<string, string> = {
  unreimbursed: 'Owed',
  reimbursed: 'Reimbursed',
};

export default function AdminStartUp() {
  return (
    <SubTabsPage
      title="Start-Up"
      blurb="WyLD's own books — what we've spent, who owns what, and what's left to ship."
      tabs={[
        { key: 'overview', label: 'Overview', body: <Overview /> },
        { key: 'expenses', label: 'Expenses', body: <Expenses /> },
        { key: 'contributors', label: 'Contributors', body: <Contributors /> },
        { key: 'milestones', label: 'Milestones', body: <Milestones /> },
      ]}
    />
  );
}

// ---- Overview ---------------------------------------------------------

function Overview() {
  const [stats, setStats] = useState<{
    totalContributed: number;
    paidBack: number;
    stillOwed: number;
    expenseCount: number;
    contributorCount: number;
    equityAllocated: number;
    milestonesOpen: number;
    milestonesDone: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [
      { data: expensesAll },
      { data: contributors },
      { data: milestonesOpen },
      { data: milestonesDone },
    ] = await Promise.all([
      supabase.from('startup_expenses').select('amount_cents, status, contributor_id'),
      supabase.from('startup_contributors').select('id, equity_percent'),
      supabase.from('startup_milestones').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('startup_milestones').select('id', { count: 'exact', head: true }).eq('status', 'done'),
    ]);
    const exp = ((expensesAll as any[]) ?? []);
    const totalContributed = exp.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
    const paidBack = exp.filter((e) => e.status === 'reimbursed').reduce((s, e) => s + (e.amount_cents ?? 0), 0);
    const stillOwed = totalContributed - paidBack;
    const con = ((contributors as any[]) ?? []);
    const equityAllocated = con.reduce((s, c) => s + Number(c.equity_percent ?? 0), 0);
    setStats({
      totalContributed,
      paidBack,
      stillOwed,
      expenseCount: exp.length,
      contributorCount: con.length,
      equityAllocated,
      milestonesOpen: (milestonesOpen as any)?.count ?? 0,
      milestonesDone: (milestonesDone as any)?.count ?? 0,
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Realtime — every input that feeds the rollups (expenses,
  // contributors, milestones) should refresh the overview live.
  useEffect(() => {
    const sub = supabase
      .channel('startup-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_expenses' },
        () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_contributors' },
        () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_milestones' },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  if (!stats) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  const equityFree = Math.max(0, 100 - stats.equityAllocated);

  return (
    <View style={styles.overviewWrap}>
      <View style={styles.statGrid}>
        <StatCard label="Total contributed" value={moneyShort(stats.totalContributed)} tone="good" />
        <StatCard label="Paid back to contributors" value={moneyShort(stats.paidBack)} tone="good" />
        <StatCard label="Still owed to contributors" value={moneyShort(stats.stillOwed)} tone={stats.stillOwed > 0 ? 'warn' : 'good'} />
        <StatCard label="Expenses logged" value={String(stats.expenseCount)} />
        <StatCard label="Contributors" value={String(stats.contributorCount)} />
        <StatCard
          label="Equity allocated"
          value={`${stats.equityAllocated.toFixed(2)}%`}
          tone={stats.equityAllocated > 100 ? 'bad' : stats.equityAllocated === 100 ? 'good' : 'neutral'}
          subtext={`${equityFree.toFixed(2)}% remaining`}
        />
        <StatCard
          label="Milestones"
          value={`${stats.milestonesDone} / ${stats.milestonesDone + stats.milestonesOpen}`}
          subtext={`${stats.milestonesOpen} open`}
        />
      </View>
    </View>
  );
}

function StatCard({
  label, value, tone = 'neutral', subtext,
}: {
  label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral'; subtext?: string;
}) {
  const accent =
    tone === 'good' ? '#15803D'
    : tone === 'bad' ? theme.colors.danger
    : tone === 'warn' ? '#B45309'
    : theme.colors.textSecondary;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {subtext ? <Text style={styles.statSub}>{subtext}</Text> : null}
      </View>
    </View>
  );
}

// ---- Expenses ---------------------------------------------------------

type Expense = {
  id: string;
  contributor_id: string | null;
  contributor: { id: string; name: string } | null;
  description: string;
  category: string | null;
  amount_cents: number;
  paid_at: string;
  status: 'unreimbursed' | 'reimbursed';
  reimbursed_at: string | null;
  notes: string | null;
  receipt_url: string | null;
};

function Expenses() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [form, setForm] = useState<Partial<Expense> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Contributor pool for the editor's "Paid by" dropdown. Loaded once
  // here (not inside the editor) so a freshly-opened "+ Log expense"
  // modal already has the options ready, and kept current via realtime
  // so a contributor added in another tab shows up without a reload.
  const [contributors, setContributors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const loadContributors = useCallback(async () => {
    const { data } = await supabase
      .from('startup_contributors')
      .select('id, name')
      .order('name');
    setContributors(((data as any[]) ?? []).map((c) => ({ id: c.id, name: c.name })));
  }, []);
  useEffect(() => { loadContributors(); }, [loadContributors]);

  useEffect(() => {
    const sub = supabase
      .channel('startup-contribs-for-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_contributors' },
        () => loadContributors())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadContributors]);

  const loadPage = useCallback(async (from: number, to: number) => {
    let q = supabase
      .from('startup_expenses')
      .select('id, contributor_id, description, category, amount_cents, paid_at, status, reimbursed_at, notes, receipt_url, contributor:startup_contributors(id, name)');
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`description.ilike.${p},category.ilike.${p}`);
    }
    const { data } = await q.order('paid_at', { ascending: false }).range(from, to);
    return ((data as any[]) ?? []) as Expense[];
  }, [statusFilter, debouncedSearch]);

  const { items: expenses, loading, hasMore, loadMore, reload } = useInfiniteList<Expense>({
    pageSize: 50,
    load: loadPage,
    deps: [statusFilter, debouncedSearch],
  });

  // Realtime — any expense insert/update/delete (from another tab,
  // another admin, or our own RPC writes) refreshes the list.
  useEffect(() => {
    const sub = supabase
      .channel('startup-expenses-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_expenses' },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [reload]);

  return (
    <View style={styles.tabRoot}>
      <View style={styles.barRow}>
        <View style={styles.chipRow}>
          {(['all', 'unreimbursed', 'reimbursed'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipOn]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextOn]}>
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => setForm({ status: 'unreimbursed', paid_at: new Date().toISOString().slice(0, 10) })}
        >
          <Text style={styles.primaryBtnText}>+ Log expense</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search description, category, or payer…"
        placeholderTextColor={theme.colors.textSecondary}
        style={styles.search}
      />

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {expenses === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No expenses logged.</Text>
          <Text style={styles.emptyBody}>
            {debouncedSearch || statusFilter !== 'all'
              ? 'Try clearing filters.'
              : 'Click "+ Log expense" to record what someone has paid for out of pocket.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((e) => (
            <Pressable
              key={e.id}
              style={styles.row}
              onPress={() => setForm(e)}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName} numberOfLines={1}>{e.description}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {e.contributor?.name || 'No contributor'}
                  {e.category ? `  ·  ${e.category}` : ''}
                  {`  ·  ${new Date(e.paid_at + 'T00:00:00').toLocaleDateString()}`}
                </Text>
                {e.notes ? <Text style={styles.rowNote} numberOfLines={1}>📝 {e.notes}</Text> : null}
              </View>
              <Text style={styles.rowAmount}>{money(e.amount_cents)}</Text>
              <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[e.status] }]}>
                <Text style={styles.statusPillText}>{STATUS_LABELS[e.status]}</Text>
              </View>
            </Pressable>
          ))}
          <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </View>
      )}

      <ExpenseEditor
        form={form}
        contributors={contributors}
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); reload(); }}
        setErr={setErr}
      />
    </View>
  );
}

function ExpenseEditor({
  form, contributors, onClose, onSaved, setErr,
}: {
  form: Partial<Expense> | null;
  contributors: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  setErr: (s: string | null) => void;
}) {
  const [draft, setDraft] = useState<Partial<Expense>>({});
  const [saving, setSaving] = useState(false);
  const [amountStr, setAmountStr] = useState('');

  // Re-initialize the draft whenever the modal is opened (or the row
  // it's editing changes). Keying off `form` itself — not `form?.id`
  // — so a fresh-create payload (form = {}, id = undefined) still
  // triggers re-init when the modal toggles from closed to open.
  useEffect(() => {
    if (!form) return;
    setDraft({
      ...form,
      paid_at: form.paid_at ?? dateToStr(new Date())!,
      status: form.status ?? 'unreimbursed',
    });
    setAmountStr(form.amount_cents != null ? centsToStr(form.amount_cents) : '');
  }, [form]);

  if (!form) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    const payload: any = {
      contributor_id: draft.contributor_id ?? null,
      description: (draft.description ?? '').trim(),
      category: draft.category ?? null,
      amount_cents: dollarsToCents(amountStr),
      paid_at: draft.paid_at,
      status: draft.status ?? 'unreimbursed',
      reimbursed_at: draft.status === 'reimbursed' ? (draft.reimbursed_at ?? dateToStr(new Date())) : null,
      notes: draft.notes?.trim() || null,
      receipt_url: draft.receipt_url?.trim() || null,
    };
    if (!payload.description) { setErr('Description is required.'); setSaving(false); return; }
    if (!payload.amount_cents) { setErr('Amount must be greater than zero.'); setSaving(false); return; }
    if (!payload.contributor_id) { setErr('Pick a contributor — add them on the Contributors tab first if they\'re not in the list.'); setSaving(false); return; }

    const { error } = form!.id
      ? await supabase.from('startup_expenses').update(payload).eq('id', form!.id)
      : await supabase.from('startup_expenses').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  async function remove() {
    if (!form?.id) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this expense?')) return;
    await supabase.from('startup_expenses').delete().eq('id', form.id);
    onSaved();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{form.id ? 'Edit expense' : 'Log expense'}</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>
          <ScrollView>
            <Field label="Description (what was it for?)">
              <TextInput
                value={draft.description ?? ''}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                placeholder="e.g. LLC filing fee"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>

            <View style={modalStyles.row}>
              <Field label="Amount (USD)" style={{ flex: 1 }}>
                <TextInput
                  value={amountStr}
                  onChangeText={(v) => setAmountStr(cleanNum(v))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
              <Field label="Date" style={{ flex: 1 }}>
                <DateTimeField
                  mode="date"
                  value={dateStrToDate(draft.paid_at ?? null)}
                  onChange={(d) => setDraft({ ...draft, paid_at: dateToStr(d) ?? undefined })}
                />
              </Field>
            </View>

            <Field label="Paid by (contributor)">
              <Select
                ariaLabel="Paid by"
                value={draft.contributor_id ?? ''}
                onChange={(v) => setDraft({ ...draft, contributor_id: v || null })}
                options={[
                  { value: '', label: '— pick a contributor —' },
                  ...contributors.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              {contributors.length === 0 ? (
                <Text style={modalStyles.hint}>
                  No contributors yet. Add one on the Contributors tab first.
                </Text>
              ) : null}
            </Field>

            <Field label="Category">
              <Select
                ariaLabel="Category"
                value={draft.category ?? ''}
                onChange={(v) => setDraft({ ...draft, category: v || null })}
                options={[{ value: '', label: '(none)' }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
              />
            </Field>

            <Field label="Status">
              <Select
                ariaLabel="Status"
                value={draft.status ?? 'unreimbursed'}
                onChange={(v) => setDraft({ ...draft, status: v as any })}
                options={[
                  { value: 'unreimbursed', label: 'Owed (still need to pay this contributor back)' },
                  { value: 'reimbursed', label: 'Reimbursed (we paid them back)' },
                ]}
              />
            </Field>

            {draft.status === 'reimbursed' ? (
              <Field label="Reimbursed on">
                <DateTimeField
                  mode="date"
                  value={dateStrToDate(draft.reimbursed_at ?? null)}
                  onChange={(d) => setDraft({ ...draft, reimbursed_at: dateToStr(d) ?? undefined })}
                />
              </Field>
            ) : null}

            <Field label="Receipt URL (optional)">
              <TextInput
                value={draft.receipt_url ?? ''}
                onChangeText={(v) => setDraft({ ...draft, receipt_url: v })}
                placeholder="https://…"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Notes">
              <TextInput
                value={draft.notes ?? ''}
                onChangeText={(v) => setDraft({ ...draft, notes: v })}
                placeholder="Anything to remember about this expense."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                style={[modalStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
            </Field>

            <View style={modalStyles.actionRow}>
              <Pressable
                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={save}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : (form.id ? 'Save changes' : 'Log expense')}</Text>
              </Pressable>
              {form.id ? (
                <Pressable style={modalStyles.deleteBtn} onPress={remove}>
                  <Text style={modalStyles.deleteBtnText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Contributors -----------------------------------------------------

type Contributor = {
  id: string;
  user_id: string | null;
  name: string;
  role: string | null;
  cash_contributed_cents: number;
  equity_percent: number | null;
  notes: string | null;
  joined_at: string | null;
};

// Derived totals per contributor — never typed in, always rolled up
// from logged expenses. `contributed` is everything they've paid out
// of pocket; `paidBack` is the subset already reimbursed; `stillOwed`
// is the difference.
type Totals = { contributed: number; paidBack: number; stillOwed: number };

function Contributors() {
  const [rows, setRows] = useState<Contributor[] | null>(null);
  const [totals, setTotals] = useState<Map<string, Totals>>(new Map());
  const [form, setForm] = useState<Partial<Contributor> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: contribs }, { data: exps }] = await Promise.all([
      supabase
        .from('startup_contributors')
        .select('*')
        .order('display_order')
        .order('created_at'),
      supabase
        .from('startup_expenses')
        .select('contributor_id, amount_cents, status'),
    ]);
    setRows((contribs as Contributor[]) ?? []);
    const map = new Map<string, Totals>();
    ((exps as any[]) ?? []).forEach((e) => {
      if (!e.contributor_id) return;
      const t = map.get(e.contributor_id) ?? { contributed: 0, paidBack: 0, stillOwed: 0 };
      t.contributed += e.amount_cents;
      if (e.status === 'reimbursed') t.paidBack += e.amount_cents;
      t.stillOwed = t.contributed - t.paidBack;
      map.set(e.contributor_id, t);
    });
    setTotals(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Realtime — contributors AND expenses both feed this view's totals,
  // so subscribe to both.
  useEffect(() => {
    const sub = supabase
      .channel('startup-contributors-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_contributors' },
        () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_expenses' },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const totalEquity = (rows ?? []).reduce((s, r) => s + Number(r.equity_percent ?? 0), 0);
  const totalCash = Array.from(totals.values()).reduce((s, t) => s + t.contributed, 0);
  const totalPaidBack = Array.from(totals.values()).reduce((s, t) => s + t.paidBack, 0);

  return (
    <View style={styles.tabRoot}>
      <View style={styles.barRow}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>Total contributed: <Text style={styles.summaryStrong}>{money(totalCash)}</Text></Text>
          <Text style={styles.summaryItem}>Paid back: <Text style={styles.summaryStrong}>{money(totalPaidBack)}</Text></Text>
          <Text style={styles.summaryItem}>Equity allocated: <Text style={[styles.summaryStrong, totalEquity > 100 && { color: theme.colors.danger }]}>{totalEquity.toFixed(2)}%</Text></Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => setForm({})}>
          <Text style={styles.primaryBtnText}>+ Add contributor</Text>
        </Pressable>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {rows === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No contributors yet.</Text>
          <Text style={styles.emptyBody}>Add founders, investors, advisors, or anyone else who's put cash or equity into WyLD. Their contribution amount comes from the expenses you log against them.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((c) => {
            const t = totals.get(c.id) ?? { contributed: 0, paidBack: 0, stillOwed: 0 };
            return (
              <Pressable key={c.id} style={styles.row} onPress={() => setForm(c)}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowMeta}>
                    {c.role || 'Contributor'}
                    {c.joined_at ? `  ·  joined ${new Date(c.joined_at + 'T00:00:00').toLocaleDateString()}` : ''}
                  </Text>
                  {c.notes ? <Text style={styles.rowNote} numberOfLines={1}>📝 {c.notes}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={styles.rowAmount}>{money(t.contributed)}</Text>
                  <Text style={styles.contributorSub}>
                    Paid back: <Text style={styles.summaryStrong}>{money(t.paidBack)}</Text>
                  </Text>
                  {t.stillOwed > 0 ? (
                    <Text style={[styles.contributorSub, { color: '#B45309' }]}>
                      Owed: <Text style={{ fontWeight: '800' }}>{money(t.stillOwed)}</Text>
                    </Text>
                  ) : null}
                  {c.equity_percent != null ? (
                    <Text style={styles.equityPill}>{Number(c.equity_percent).toFixed(2)}% equity</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <ContributorEditor
        form={form}
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); load(); }}
        setErr={setErr}
      />
    </View>
  );
}

function ContributorEditor({
  form, onClose, onSaved, setErr,
}: {
  form: Partial<Contributor> | null;
  onClose: () => void;
  onSaved: () => void;
  setErr: (s: string | null) => void;
}) {
  const [draft, setDraft] = useState<Partial<Contributor>>({});
  const [equityStr, setEquityStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form) return;
    setDraft(form);
    setEquityStr(form.equity_percent != null ? String(form.equity_percent) : '');
  }, [form]);

  if (!form) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    const payload: any = {
      user_id: draft.user_id ?? null,
      name: (draft.name ?? '').trim(),
      role: draft.role?.trim() || null,
      equity_percent: equityStr.trim() ? Number(equityStr) : null,
      notes: draft.notes?.trim() || null,
      joined_at: draft.joined_at || null,
    };
    if (!payload.name) { setErr('Name is required.'); setSaving(false); return; }
    const { error } = form!.id
      ? await supabase.from('startup_contributors').update(payload).eq('id', form!.id)
      : await supabase.from('startup_contributors').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  async function remove() {
    if (!form?.id) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this contributor?')) return;
    await supabase.from('startup_contributors').delete().eq('id', form.id);
    onSaved();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{form.id ? 'Edit contributor' : 'Add contributor'}</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>
          <ScrollView>
            <Field label="Name">
              <TextInput
                value={draft.name ?? ''}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
                placeholder="e.g. Jane Founder"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Role">
              <TextInput
                value={draft.role ?? ''}
                onChangeText={(v) => setDraft({ ...draft, role: v })}
                placeholder="Founder, Investor, Advisor…"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Equity (%)">
              <TextInput
                value={equityStr}
                onChangeText={(v) => setEquityStr(cleanNum(v))}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
              <Text style={modalStyles.hint}>
                Cash contributed is calculated automatically from the expenses
                you log against this contributor.
              </Text>
            </Field>
            <Field label="Joined (date)">
              <DateTimeField
                mode="date"
                value={dateStrToDate(draft.joined_at ?? null)}
                onChange={(d) => setDraft({ ...draft, joined_at: dateToStr(d) ?? undefined })}
              />
            </Field>
            <Field label="Notes">
              <TextInput
                value={draft.notes ?? ''}
                onChangeText={(v) => setDraft({ ...draft, notes: v })}
                placeholder="Vesting terms, SAFE details, etc."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                style={[modalStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
            </Field>
            <View style={modalStyles.actionRow}>
              <Pressable
                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={save}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : (form.id ? 'Save changes' : 'Add contributor')}</Text>
              </Pressable>
              {form.id ? (
                <Pressable style={modalStyles.deleteBtn} onPress={remove}>
                  <Text style={modalStyles.deleteBtnText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Milestones -------------------------------------------------------

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'open' | 'done' | 'archived';
  completed_at: string | null;
};

function Milestones() {
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [form, setForm] = useState<Partial<Milestone> | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from('startup_milestones').select('*');
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q.order('display_order').order('target_date', { nullsFirst: false });
    setRows((data as Milestone[]) ?? []);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel('startup-milestones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_milestones' },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  async function toggle(m: Milestone) {
    const nextStatus = m.status === 'done' ? 'open' : 'done';
    await supabase
      .from('startup_milestones')
      .update({ status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', m.id);
    load();
  }

  return (
    <View style={styles.tabRoot}>
      <View style={styles.barRow}>
        <View style={styles.chipRow}>
          {(['open', 'done', 'all'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, filter === s && styles.chipOn]}
              onPress={() => setFilter(s)}
            >
              <Text style={[styles.chipText, filter === s && styles.chipTextOn]}>
                {s === 'open' ? 'Open' : s === 'done' ? 'Done' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => setForm({ status: 'open' })}>
          <Text style={styles.primaryBtnText}>+ Add milestone</Text>
        </Pressable>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {rows === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet.</Text>
          <Text style={styles.emptyBody}>Add milestones like "LLC formed", "First paying gym", "$1k MRR" so you can track progress.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((m) => (
            <View key={m.id} style={styles.row}>
              <Pressable
                style={[styles.checkBox, m.status === 'done' && styles.checkBoxOn]}
                onPress={() => toggle(m)}
              >
                {m.status === 'done' ? <Text style={styles.checkMark}>✓</Text> : null}
              </Pressable>
              <Pressable style={{ flex: 1, gap: 2 }} onPress={() => setForm(m)}>
                <Text style={[styles.rowName, m.status === 'done' && styles.strike]}>{m.title}</Text>
                {m.description ? <Text style={styles.rowMeta}>{m.description}</Text> : null}
                {m.target_date ? (
                  <Text style={styles.rowMeta}>Target {new Date(m.target_date + 'T00:00:00').toLocaleDateString()}</Text>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <MilestoneEditor
        form={form}
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); load(); }}
        setErr={setErr}
      />
    </View>
  );
}

function MilestoneEditor({
  form, onClose, onSaved, setErr,
}: {
  form: Partial<Milestone> | null;
  onClose: () => void;
  onSaved: () => void;
  setErr: (s: string | null) => void;
}) {
  const [draft, setDraft] = useState<Partial<Milestone>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (form) setDraft(form); }, [form]);
  if (!form) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    const payload: any = {
      title: (draft.title ?? '').trim(),
      description: draft.description?.trim() || null,
      target_date: draft.target_date || null,
      status: draft.status ?? 'open',
    };
    if (!payload.title) { setErr('Title is required.'); setSaving(false); return; }
    const { error } = form!.id
      ? await supabase.from('startup_milestones').update(payload).eq('id', form!.id)
      : await supabase.from('startup_milestones').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  async function remove() {
    if (!form?.id) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this milestone?')) return;
    await supabase.from('startup_milestones').delete().eq('id', form.id);
    onSaved();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{form.id ? 'Edit milestone' : 'Add milestone'}</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>
          <ScrollView>
            <Field label="Title">
              <TextInput
                value={draft.title ?? ''}
                onChangeText={(v) => setDraft({ ...draft, title: v })}
                placeholder="e.g. First paying gym"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Description">
              <TextInput
                value={draft.description ?? ''}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                placeholder="What does 'done' look like?"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                style={[modalStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
            </Field>
            <Field label="Target date (optional)">
              <DateTimeField
                mode="date"
                value={dateStrToDate(draft.target_date ?? null)}
                onChange={(d) => setDraft({ ...draft, target_date: dateToStr(d) ?? undefined })}
              />
            </Field>
            <View style={modalStyles.actionRow}>
              <Pressable
                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={save}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : (form.id ? 'Save changes' : 'Add milestone')}</Text>
              </Pressable>
              {form.id ? (
                <Pressable style={modalStyles.deleteBtn} onPress={remove}>
                  <Text style={modalStyles.deleteBtnText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Small shared helpers --------------------------------------------

function Field({
  label, children, style,
}: {
  label: string; children: React.ReactNode; style?: any;
}) {
  return (
    <View style={[modalStyles.field, style]}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ---- Styles ----------------------------------------------------------

const styles = StyleSheet.create({
  tabRoot: { gap: 14 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  chipTextOn: { color: '#fff' },

  primaryBtn: {
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  summaryRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', flex: 1 },
  summaryItem: { fontSize: 13, color: theme.colors.textSecondary },
  summaryStrong: { color: theme.colors.charcoal, fontWeight: '800' },

  search: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
    backgroundColor: '#fff', color: theme.colors.charcoal,
  },

  empty: {
    padding: theme.spacing.xl, gap: 4, alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },

  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  rowName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  rowMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  rowNote: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { color: '#fff', fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },

  equityPill: {
    fontSize: 11, fontWeight: '800',
    color: theme.colors.wyldPurple, backgroundColor: '#f3effe',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  contributorSub: { fontSize: 11, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] as any },

  checkBox: {
    width: 26, height: 26, borderRadius: 6,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: '#15803D', borderColor: '#15803D' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  strike: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },

  err: { color: theme.colors.danger, fontSize: 13 },

  overviewWrap: { gap: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    minWidth: 220, flexGrow: 1, flexBasis: 220,
  },
  statAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  statLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.colors.charcoal },
  statSub: { fontSize: 12, color: theme.colors.textSecondary },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: {
    backgroundColor: '#fff', borderRadius: 16, padding: 22,
    width: '100%', maxWidth: 560, maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal, flex: 1 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 4, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
    color: theme.colors.charcoal, backgroundColor: '#fff',
  },
  hint: { fontSize: 11, color: theme.colors.textSecondary, lineHeight: 16, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: {
    flex: 1, backgroundColor: theme.colors.wyldPurple,
    paddingVertical: 11, borderRadius: 8, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  deleteBtn: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  deleteBtnText: { color: theme.colors.danger, fontWeight: '800', fontSize: 14 },
});
