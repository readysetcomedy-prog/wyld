import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import { CostBreakdownView } from '@/components/CostBreakdown';
import {
  FEATURES,
  Inclusion,
  IncludedWith,
  ItemPricing,
  PricingModel,
  Tier,
  TierMode,
  computeCost,
  fetchPricingModel,
} from '@/lib/pricingModel';

// Editable (string-backed) mirror of the persisted model.
type ItemForm = {
  price: string;
  inclusion: Inclusion;
  included_with: IncludedWith;
  discounts: { when: string; percent: string }[];
};
type TierForm = { from_count: string; to_count: string; price: string };
type Form = {
  items: Record<string, ItemForm>;
  location_tiers: TierForm[];
  location_tier_mode: TierMode;
  member_tiers: TierForm[];
  member_tier_mode: TierMode;
  employee_tiers: TierForm[];
  employee_tier_mode: TierMode;
};

const INCLUSIONS: { value: Inclusion; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'included', label: 'Included' },
  { value: 'included_with', label: 'Included with…' },
];

const centsToStr = (c: number) => (c ? (c / 100).toFixed(2) : '');
const dollarsToCents = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const cleanNum = (s: string) => s.replace(/[^0-9.]/g, '');
const cleanInt = (s: string) => s.replace(/[^0-9]/g, '');

function emptyItemForm(): ItemForm {
  return {
    price: '',
    inclusion: 'included',
    included_with: { mode: 'any', keys: [] },
    discounts: [],
  };
}

// Tolerate older saved shapes (a bare string, or a missing rule).
function normIncludedWith(raw: any): IncludedWith {
  if (!raw) return { mode: 'any', keys: [] };
  if (typeof raw === 'string') return { mode: 'any', keys: [raw] };
  return {
    mode: raw.mode === 'all' ? 'all' : 'any',
    keys: Array.isArray(raw.keys) ? raw.keys : [],
  };
}

function formFromModel(m: PricingModel): Form {
  const items: Record<string, ItemForm> = {};
  for (const f of FEATURES) {
    const it = m.items[f.key];
    items[f.key] = it
      ? {
          price: centsToStr(it.price_cents ?? 0),
          inclusion: it.inclusion ?? 'included',
          included_with: normIncludedWith(it.included_with),
          discounts: (it.discounts ?? []).map((d) => ({
            when: d.when,
            percent: String(d.percent),
          })),
        }
      : emptyItemForm();
  }
  const tierForm = (t: Tier): TierForm => ({
    from_count: String(t.from_count),
    to_count: t.to_count != null ? String(t.to_count) : '',
    price: centsToStr(t.price_cents ?? 0),
  });
  return {
    items,
    location_tiers: m.location_tiers.map(tierForm),
    location_tier_mode: m.location_tier_mode,
    member_tiers: m.member_tiers.map(tierForm),
    member_tier_mode: m.member_tier_mode,
    employee_tiers: m.employee_tiers.map(tierForm),
    employee_tier_mode: m.employee_tier_mode,
  };
}

function modelFromForm(form: Form): PricingModel {
  const items: Record<string, ItemPricing> = {};
  for (const f of FEATURES) {
    const it = form.items[f.key] ?? emptyItemForm();
    items[f.key] = {
      price_cents: dollarsToCents(it.price),
      inclusion: it.inclusion,
      included_with:
        it.inclusion === 'included_with'
          ? { mode: it.included_with.mode, keys: it.included_with.keys.filter(Boolean) }
          : null,
      discounts: it.discounts
        .filter((d) => d.when && Number(d.percent) > 0)
        .map((d) => ({ when: d.when, percent: Math.min(100, Number(d.percent)) })),
    };
  }
  const toTier = (t: TierForm): Tier => {
    const to = parseInt(t.to_count, 10);
    return {
      from_count: Math.max(1, parseInt(t.from_count || '1', 10) || 1),
      to_count: Number.isFinite(to) && to > 0 ? to : null,
      price_cents: dollarsToCents(t.price),
    };
  };
  return {
    items,
    location_tiers: form.location_tiers.map(toTier),
    location_tier_mode: form.location_tier_mode,
    member_tiers: form.member_tiers.map(toTier),
    member_tier_mode: form.member_tier_mode,
    employee_tiers: form.employee_tiers.map(toTier),
    employee_tier_mode: form.employee_tier_mode,
  };
}

export default function AdminPricing() {
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<'model' | 'calculator'>('model');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Calculator sandbox inputs.
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [calcLocations, setCalcLocations] = useState('1');
  const [calcMembers, setCalcMembers] = useState('0');
  const [calcEmployees, setCalcEmployees] = useState('0');

  useEffect(() => {
    (async () => {
      const m = await fetchPricingModel();
      setForm(formFromModel(m));
    })();
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    setErr(null);
    setSaved(false);
    const { error } = await supabase
      .from('pricing_model')
      .update({ model: modelFromForm(form) })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSaved(true);
  }

  const breakdown = useMemo(() => {
    if (!form) return null;
    const activeSet = new Set(
      FEATURES.filter((f) => f.flag !== null && active[f.key]).map((f) => f.key)
    );
    return computeCost(
      modelFromForm(form),
      activeSet,
      parseInt(calcLocations || '0', 10) || 0,
      parseInt(calcMembers || '0', 10) || 0,
      parseInt(calcEmployees || '0', 10) || 0
    );
  }, [form, active, calcLocations, calcMembers, calcEmployees]);

  if (!form) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  function setItem(key: string, patch: Partial<ItemForm>) {
    setForm((f) =>
      f ? { ...f, items: { ...f.items, [key]: { ...f.items[key], ...patch } } } : f
    );
    setSaved(false);
  }
  function setTiers(
    which: 'location_tiers' | 'member_tiers' | 'employee_tiers',
    tiers: TierForm[]
  ) {
    setForm((f) => (f ? { ...f, [which]: tiers } : f));
    setSaved(false);
  }
  function setMode(
    which: 'location_tier_mode' | 'member_tier_mode' | 'employee_tier_mode',
    m: TierMode
  ) {
    setForm((f) => (f ? { ...f, [which]: m } : f));
    setSaved(false);
  }

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Pricing Model</Text>
        <Text style={styles.sub}>
          Set what every feature costs, then use the calculator to test combinations.
          Each gym&apos;s monthly cost is computed from this model.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.viewToggle}>
        {(['model', 'calculator'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.viewBtn, view === v && styles.viewBtnActive]}
          >
            <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
              {v === 'model' ? 'Model' : 'Calculator'}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === 'model' ? (
        <>
          <View style={styles.saveBar}>
            <Pressable
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save model'}</Text>
            </Pressable>
            {saved ? <Text style={styles.savedText}>Saved.</Text> : null}
          </View>

          <Text style={styles.sectionHeading}>Feature pricing</Text>
          {FEATURES.map((f) => (
            <ItemCard
              key={f.key}
              featureKey={f.key}
              label={f.label}
              value={form.items[f.key]}
              onChange={(patch) => setItem(f.key, patch)}
            />
          ))}

          <Text style={styles.sectionHeading}>Location tiers</Text>
          <Text style={styles.sectionHint}>
            Set count ranges (from–to). &ldquo;Per location&rdquo; charges the range&apos;s
            price times the count; &ldquo;Flat per range&rdquo; charges it once for the
            whole range. Leave &ldquo;to&rdquo; blank for no upper limit. Only billed
            when Multiple locations is on.
          </Text>
          <TierEditor
            tiers={form.location_tiers}
            unit="location"
            mode={form.location_tier_mode}
            onChange={(t) => setTiers('location_tiers', t)}
            onModeChange={(m) => setMode('location_tier_mode', m)}
          />

          <Text style={styles.sectionHeading}>Member tiers</Text>
          <Text style={styles.sectionHint}>
            Set count ranges (from–to). &ldquo;Flat per range&rdquo; charges one price for
            the range the count lands in — e.g. 50–100 members = $12 flat. &ldquo;Per
            member&rdquo; charges the price times the count. Billed for every gym.
          </Text>
          <TierEditor
            tiers={form.member_tiers}
            unit="member"
            mode={form.member_tier_mode}
            onChange={(t) => setTiers('member_tiers', t)}
            onModeChange={(m) => setMode('member_tier_mode', m)}
          />

          <Text style={styles.sectionHeading}>Employee tiers</Text>
          <Text style={styles.sectionHint}>
            Set count ranges (from–to). &ldquo;Flat per range&rdquo; charges one price for
            the range the count lands in — e.g. 5–10 employees = $20 flat. &ldquo;Per
            employee&rdquo; charges the price times the count. Active (non-terminated)
            employees are counted.
          </Text>
          <TierEditor
            tiers={form.employee_tiers}
            unit="employee"
            mode={form.employee_tier_mode}
            onChange={(t) => setTiers('employee_tiers', t)}
            onModeChange={(m) => setMode('employee_tier_mode', m)}
          />
        </>
      ) : (
        <View style={styles.calcWrap}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What the gym has</Text>
            <Text style={styles.sectionHint}>
              Always-on items (Base platform, Website) are always counted. Toggle the
              rest and set counts.
            </Text>
            {FEATURES.filter((f) => f.flag !== null).map((f) => (
              <View key={f.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{f.label}</Text>
                <Switch
                  value={!!active[f.key]}
                  onValueChange={(v) => setActive((a) => ({ ...a, [f.key]: v }))}
                  trackColor={{ false: '#cbd5e1', true: theme.colors.wyldPurple }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            <View style={styles.countRow}>
              <Text style={styles.toggleLabel}>Locations</Text>
              <TextInput
                value={calcLocations}
                onChangeText={(v) => setCalcLocations(cleanInt(v))}
                keyboardType="number-pad"
                style={styles.numInput}
              />
            </View>
            <View style={styles.countRow}>
              <Text style={styles.toggleLabel}>Members</Text>
              <TextInput
                value={calcMembers}
                onChangeText={(v) => setCalcMembers(cleanInt(v))}
                keyboardType="number-pad"
                style={styles.numInput}
              />
            </View>
            <View style={styles.countRow}>
              <Text style={styles.toggleLabel}>Employees</Text>
              <TextInput
                value={calcEmployees}
                onChangeText={(v) => setCalcEmployees(cleanInt(v))}
                keyboardType="number-pad"
                style={styles.numInput}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Estimated monthly cost</Text>
            {breakdown ? <CostBreakdownView breakdown={breakdown} /> : null}
            <Text style={styles.sectionHint}>
              Reflects unsaved edits in the Model tab — save when the numbers look right.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ItemCard({
  featureKey,
  label,
  value,
  onChange,
}: {
  featureKey: string;
  label: string;
  value: ItemForm;
  onChange: (patch: Partial<ItemForm>) => void;
}) {
  // Other features can be referenced as conditions / "included with" targets.
  const otherOptions = FEATURES.filter((f) => f.key !== featureKey).map((f) => ({
    value: f.key,
    label: f.label,
  }));

  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemName}>{label}</Text>

      <View style={styles.pillRow}>
        {INCLUSIONS.map((inc) => (
          <Pressable
            key={inc.value}
            onPress={() => onChange({ inclusion: inc.value })}
            style={[styles.pill, value.inclusion === inc.value && styles.pillActive]}
          >
            <Text
              style={[
                styles.pillText,
                value.inclusion === inc.value && styles.pillTextActive,
              ]}
            >
              {inc.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {value.inclusion === 'included_with' ? (
        <View style={styles.discountBlock}>
          <Text style={styles.fieldLabel}>Free when the gym has</Text>
          <View style={styles.pillRow}>
            {(['any', 'all'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() =>
                  onChange({ included_with: { ...value.included_with, mode: m } })
                }
                style={[styles.pill, value.included_with.mode === m && styles.pillActive]}
              >
                <Text
                  style={[
                    styles.pillText,
                    value.included_with.mode === m && styles.pillTextActive,
                  ]}
                >
                  {m === 'any' ? 'Any of these' : 'All of these'}
                </Text>
              </Pressable>
            ))}
          </View>
          {value.included_with.keys.map((k, i) => (
            <View key={i} style={styles.discountRow}>
              <Select
                ariaLabel="Included with module"
                value={k}
                placeholder="Pick a module…"
                onChange={(v) =>
                  onChange({
                    included_with: {
                      ...value.included_with,
                      keys: value.included_with.keys.map((x, j) => (j === i ? v : x)),
                    },
                  })
                }
                options={otherOptions}
              />
              <Pressable
                onPress={() =>
                  onChange({
                    included_with: {
                      ...value.included_with,
                      keys: value.included_with.keys.filter((_, j) => j !== i),
                    },
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
              onChange({
                included_with: {
                  ...value.included_with,
                  keys: [...value.included_with.keys, ''],
                },
              })
            }
          >
            <Text style={styles.btnSmallText}>+ Add module</Text>
          </Pressable>
        </View>
      ) : null}

      {value.inclusion !== 'included' ? (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>
            Price (USD){value.inclusion === 'included_with' ? ', if not free' : ''}
          </Text>
          <TextInput
            value={value.price}
            onChangeText={(v) => onChange({ price: cleanNum(v) })}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            style={styles.priceInput}
          />
        </View>
      ) : null}

      {value.inclusion !== 'included' ? (
        <View style={styles.discountBlock}>
          <Text style={styles.fieldLabel}>Conditional discounts</Text>
          {value.discounts.map((d, i) => (
            <View key={i} style={styles.discountRow}>
              <Text style={styles.discountWord}>If has</Text>
              <Select
                ariaLabel="Discount condition"
                value={d.when}
                placeholder="module…"
                onChange={(v) =>
                  onChange({
                    discounts: value.discounts.map((x, j) =>
                      j === i ? { ...x, when: v } : x
                    ),
                  })
                }
                options={otherOptions}
              />
              <TextInput
                value={d.percent}
                onChangeText={(v) =>
                  onChange({
                    discounts: value.discounts.map((x, j) =>
                      j === i ? { ...x, percent: cleanInt(v) } : x
                    ),
                  })
                }
                placeholder="%"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                style={styles.pctInput}
              />
              <Text style={styles.discountWord}>% off</Text>
              <Pressable
                onPress={() =>
                  onChange({ discounts: value.discounts.filter((_, j) => j !== i) })
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
              onChange({ discounts: [...value.discounts, { when: '', percent: '' }] })
            }
          >
            <Text style={styles.btnSmallText}>+ Add discount</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TierEditor({
  tiers,
  unit,
  mode,
  onChange,
  onModeChange,
}: {
  tiers: TierForm[];
  unit: string;
  mode: TierMode;
  onChange: (tiers: TierForm[]) => void;
  onModeChange: (mode: TierMode) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.pillRow}>
        {(['per_unit', 'flat'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => onModeChange(m)}
            style={[styles.pill, mode === m && styles.pillActive]}
          >
            <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>
              {m === 'per_unit' ? `Per ${unit}` : 'Flat per range'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tiers.length === 0 ? (
        <Text style={styles.dim}>No tiers — this {unit} count is free.</Text>
      ) : (
        tiers.map((t, i) => (
          <View key={i} style={styles.tierRow}>
            <Text style={styles.discountWord}>From</Text>
            <TextInput
              value={t.from_count}
              onChangeText={(v) =>
                onChange(
                  tiers.map((x, j) =>
                    j === i ? { ...x, from_count: v.replace(/[^0-9]/g, '') } : x
                  )
                )
              }
              placeholder="1"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              style={styles.pctInput}
            />
            <Text style={styles.discountWord}>to</Text>
            <TextInput
              value={t.to_count}
              onChangeText={(v) =>
                onChange(
                  tiers.map((x, j) =>
                    j === i ? { ...x, to_count: v.replace(/[^0-9]/g, '') } : x
                  )
                )
              }
              placeholder="∞"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              style={styles.pctInput}
            />
            <Text style={styles.discountWord}>{unit}s — $</Text>
            <TextInput
              value={t.price}
              onChangeText={(v) =>
                onChange(
                  tiers.map((x, j) =>
                    j === i ? { ...x, price: v.replace(/[^0-9.]/g, '') } : x
                  )
                )
              }
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
            <Text style={styles.discountWord}>{mode === 'flat' ? 'flat' : 'each'}</Text>
            <Pressable
              onPress={() => onChange(tiers.filter((_, j) => j !== i))}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>×</Text>
            </Pressable>
          </View>
        ))
      )}
      <Pressable
        style={styles.btnSmall}
        onPress={() =>
          onChange([...tiers, { from_count: '', to_count: '', price: '' }])
        }
      >
        <Text style={styles.btnSmallText}>+ Add tier</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, maxWidth: 760 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },

  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  viewBtn: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#fff' },
  viewBtnActive: { backgroundColor: theme.colors.wyldPurple },
  viewBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  viewBtnTextActive: { color: '#fff' },

  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
    alignSelf: 'flex-start',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  savedText: { color: theme.colors.tealDark, fontWeight: '700', fontSize: 14 },

  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  sectionHint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },

  itemCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
  },
  itemName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },

  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  pillText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  pillTextActive: { color: '#fff' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  priceInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
    minWidth: 100,
  },
  pctInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
    width: 64,
    textAlign: 'center',
  },

  discountBlock: { gap: 8 },
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  discountWord: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: theme.colors.charcoal, fontWeight: '700' },
  btnSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSmallText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },

  calcWrap: { gap: 14 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    gap: 12,
  },
  numInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
    width: 90,
    textAlign: 'center',
  },
});
