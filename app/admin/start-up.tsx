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
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

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
  company_paid: theme.colors.wyldPurple,
};
const STATUS_LABELS: Record<string, string> = {
  unreimbursed: 'Owed',
  reimbursed: 'Reimbursed',
  company_paid: 'Company paid',
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
    cashIn: number;
    cashOut: number;
    unreimbursed: number;
    expenseCount: number;
    contributorCount: number;
    equityAllocated: number;
    milestonesOpen: number;
    milestonesDone: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [
        { data: expensesAll },
        { data: contributors },
        { data: milestonesOpen },
        { data: milestonesDone },
      ] = await Promise.all([
        supabase.from('startup_expenses').select('amount_cents, status'),
        supabase.from('startup_contributors').select('cash_contributed_cents, equity_percent'),
        supabase.from('startup_milestones').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('startup_milestones').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      ]);
      const exp = ((expensesAll as any[]) ?? []);
      const cashOut = exp.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
      const unreimbursed = exp
        .filter((e) => e.status === 'unreimbursed')
        .reduce((s, e) => s + (e.amount_cents ?? 0), 0);
      const con = ((contributors as any[]) ?? []);
      const cashIn = con.reduce((s, c) => s + (c.cash_contributed_cents ?? 0), 0);
      const equityAllocated = con.reduce((s, c) => s + Number(c.equity_percent ?? 0), 0);
      setStats({
        cashIn,
        cashOut,
        unreimbursed,
        expenseCount: exp.length,
        contributorCount: con.length,
        equityAllocated,
        milestonesOpen: (milestonesOpen as any)?.count ?? 0,
        milestonesDone: (milestonesDone as any)?.count ?? 0,
      });
    })();
  }, []);

  if (!stats) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  const cashRemaining = stats.cashIn - stats.cashOut;
  const equityFree = Math.max(0, 100 - stats.equityAllocated);

  return (
    <View style={styles.overviewWrap}>
      <View style={styles.statGrid}>
        <StatCard label="Cash in (contributors)" value={moneyShort(stats.cashIn)} tone="good" />
        <StatCard label="Cash out (expenses)" value={moneyShort(stats.cashOut)} tone="warn" />
        <StatCard label="Net cash" value={moneyShort(cashRemaining)} tone={cashRemaining >= 0 ? 'good' : 'bad'} />
        <StatCard label="Still owed to contributors" value={moneyShort(stats.unreimbursed)} tone={stats.unreimbursed > 0 ? 'warn' : 'good'} />
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
  paid_by_user_id: string | null;
  paid_by_label: string | null;
  paid_by: { full_name: string | null; email: string } | null;
  description: string;
  category: string | null;
  amount_cents: number;
  paid_at: string;
  status: 'unreimbursed' | 'reimbursed' | 'company_paid';
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

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const loadPage = useCallback(async (from: number, to: number) => {
    let q = supabase
      .from('startup_expenses')
      .select('*, paid_by:profiles!startup_expenses_paid_by_user_id_fkey(full_name, email)');
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`description.ilike.${p},category.ilike.${p},paid_by_label.ilike.${p}`);
    }
    const { data } = await q.order('paid_at', { ascending: false }).range(from, to);
    return ((data as Expense[]) ?? []);
  }, [statusFilter, debouncedSearch]);

  const { items: expenses, loading, hasMore, loadMore, reload } = useInfiniteList<Expense>({
    pageSize: 50,
    load: loadPage,
    deps: [statusFilter, debouncedSearch],
  });

  return (
    <View style={styles.tabRoot}>
      <View style={styles.barRow}>
        <View style={styles.chipRow}>
          {(['all', 'unreimbursed', 'reimbursed', 'company_paid'] as const).map((s) => (
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
                  {e.paid_by?.full_name || e.paid_by?.email || e.paid_by_label || 'Unknown payer'}
                  {e.category ? `  ·  ${e.category}` : ''}
                  {`  ·  ${new Date(e.paid_at).toLocaleDateString()}`}
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
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); reload(); }}
        setErr={setErr}
      />
    </View>
  );
}

function ExpenseEditor({
  form, onClose, onSaved, setErr,
}: {
  form: Partial<Expense> | null;
  onClose: () => void;
  onSaved: () => void;
  setErr: (s: string | null) => void;
}) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<Partial<Expense>>({});
  const [saving, setSaving] = useState(false);
  const [amountStr, setAmountStr] = useState('');

  useEffect(() => {
    if (!form) return;
    setDraft({
      ...form,
      paid_at: form.paid_at ?? new Date().toISOString().slice(0, 10),
      status: form.status ?? 'unreimbursed',
    });
    setAmountStr(form.amount_cents != null ? centsToStr(form.amount_cents) : '');
  }, [form?.id]);

  // Pull the admin pool so the payer dropdown can target a real user.
  useEffect(() => {
    if (!form) return;
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['admin', 'gym_employee'])
      .order('full_name')
      .limit(500)
      .then(({ data }) => {
        setUsers(((data as any[]) ?? []).map((u) => ({
          id: u.id, name: u.full_name || u.email,
        })));
      });
  }, [form?.id]);

  if (!form) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    const payload: any = {
      paid_by_user_id: draft.paid_by_user_id ?? null,
      paid_by_label: draft.paid_by_label?.trim() || null,
      description: (draft.description ?? '').trim(),
      category: draft.category ?? null,
      amount_cents: dollarsToCents(amountStr),
      paid_at: draft.paid_at,
      status: draft.status ?? 'unreimbursed',
      reimbursed_at: draft.status === 'reimbursed' ? (draft.reimbursed_at ?? new Date().toISOString().slice(0, 10)) : null,
      notes: draft.notes?.trim() || null,
      receipt_url: draft.receipt_url?.trim() || null,
    };
    if (!payload.description) { setErr('Description is required.'); setSaving(false); return; }
    if (!payload.amount_cents) { setErr('Amount must be greater than zero.'); setSaving(false); return; }

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
                <TextInput
                  value={draft.paid_at ?? ''}
                  onChangeText={(v) => setDraft({ ...draft, paid_at: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
            </View>

            <Field label="Paid by — pick a user">
              <Select
                ariaLabel="Paid by"
                value={draft.paid_by_user_id ?? ''}
                onChange={(v) => setDraft({ ...draft, paid_by_user_id: v || null })}
                options={[{ value: '', label: '(none — use free text below)' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
              />
            </Field>
            <Field label="…or free-text payer (vendor name, etc.)">
              <TextInput
                value={draft.paid_by_label ?? ''}
                onChangeText={(v) => setDraft({ ...draft, paid_by_label: v })}
                placeholder="e.g. Stripe invoice, John (cofounder cash)"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
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
                  { value: 'unreimbursed', label: 'Owed (still need to pay this person back)' },
                  { value: 'reimbursed', label: 'Reimbursed (we paid them back)' },
                  { value: 'company_paid', label: 'Company paid directly (no reimbursement needed)' },
                ]}
              />
            </Field>

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

function Contributors() {
  const [rows, setRows] = useState<Contributor[] | null>(null);
  const [form, setForm] = useState<Partial<Contributor> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('startup_contributors')
      .select('*')
      .order('display_order')
      .order('created_at');
    setRows((data as Contributor[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalEquity = (rows ?? []).reduce((s, r) => s + Number(r.equity_percent ?? 0), 0);
  const totalCash = (rows ?? []).reduce((s, r) => s + (r.cash_contributed_cents ?? 0), 0);

  return (
    <View style={styles.tabRoot}>
      <View style={styles.barRow}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>Total cash: <Text style={styles.summaryStrong}>{money(totalCash)}</Text></Text>
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
          <Text style={styles.emptyBody}>Add founders, investors, advisors, or anyone else who's put cash or equity into WyLD.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((c) => (
            <Pressable key={c.id} style={styles.row} onPress={() => setForm(c)}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowMeta}>
                  {c.role || 'Contributor'}
                  {c.joined_at ? `  ·  joined ${new Date(c.joined_at).toLocaleDateString()}` : ''}
                </Text>
                {c.notes ? <Text style={styles.rowNote} numberOfLines={1}>📝 {c.notes}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={styles.rowAmount}>{money(c.cash_contributed_cents)}</Text>
                {c.equity_percent != null ? (
                  <Text style={styles.equityPill}>{Number(c.equity_percent).toFixed(2)}% equity</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
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
  const [cashStr, setCashStr] = useState('');
  const [equityStr, setEquityStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form) return;
    setDraft(form);
    setCashStr(form.cash_contributed_cents ? centsToStr(form.cash_contributed_cents) : '');
    setEquityStr(form.equity_percent != null ? String(form.equity_percent) : '');
  }, [form?.id]);

  if (!form) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    const payload: any = {
      user_id: draft.user_id ?? null,
      name: (draft.name ?? '').trim(),
      role: draft.role?.trim() || null,
      cash_contributed_cents: dollarsToCents(cashStr),
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
            <View style={modalStyles.row}>
              <Field label="Cash contributed (USD)" style={{ flex: 1 }}>
                <TextInput
                  value={cashStr}
                  onChangeText={(v) => setCashStr(cleanNum(v))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
              <Field label="Equity (%)" style={{ flex: 1 }}>
                <TextInput
                  value={equityStr}
                  onChangeText={(v) => setEquityStr(cleanNum(v))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
            </View>
            <Field label="Joined (date)">
              <TextInput
                value={draft.joined_at ?? ''}
                onChangeText={(v) => setDraft({ ...draft, joined_at: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
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
                  <Text style={styles.rowMeta}>Target {new Date(m.target_date).toLocaleDateString()}</Text>
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

  useEffect(() => { if (form) setDraft(form); }, [form?.id]);
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
              <TextInput
                value={draft.target_date ?? ''}
                onChangeText={(v) => setDraft({ ...draft, target_date: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
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
