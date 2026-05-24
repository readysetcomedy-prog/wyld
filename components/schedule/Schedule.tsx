// The Schedule view. One component, two modes:
//
//   manage  — owners / perm_schedule users edit shifts, swap, rotate,
//             review pickup requests, configure per-location coverage
//   view    — employees see the schedule (filtered by the location's
//             visible_until cutoff) and request pickups on open hours
//
// Locations are the lanes; gym_employees.position drives the role filter.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Modal, TextInput, useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { TimePicker } from './TimePicker';
import { ShiftEditModal } from './ShiftEditModal';
import { RotationModal } from './RotationModal';
import { ScheduleHistoryPanel } from './ScheduleHistoryPanel';
import { LocationSettingsModal } from './LocationSettingsModal';
import {
  Location, EmployeeOption, ScheduleShift, ShiftPickupRequest, ShiftAbsence,
  ViewMode, DELETE_REASONS, DeleteReason,
} from './types';
import {
  formatTimeDisplay, calcShiftHours, detectNextDay, hasConflict,
  getMonthDays, toDateStr, formatDateLabel, formatMonthLabel, calcCoverage,
} from './utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_PCT = `${(100 / 7).toFixed(4)}%` as unknown as number;

type Props = {
  gymId: string;
  gymName: string;
  mode: 'manage' | 'view';
  myEmployeeId: string | null; // current user's gym_employees.id (null in view mode if not employed here)
};

export function Schedule({ gymId, gymName, mode, myEmployeeId }: Props) {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const currentUserId = session?.user?.id ?? '';

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthDays = getMonthDays(year, month);
  const todayDateStr = toDateStr(new Date());
  const viewDateStr = toDateStr(viewDate);

  const [locations, setLocations] = useState<Location[]>([]);
  const [visibleLocationIds, setVisibleLocationIds] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [absences, setAbsences] = useState<ShiftAbsence[]>([]);
  const [pickupRequests, setPickupRequests] = useState<ShiftPickupRequest[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [defaultStart, setDefaultStart] = useState('08:00');
  const [defaultEnd, setDefaultEnd] = useState('20:00');
  const [defaultNextDay, setDefaultNextDay] = useState(false);
  const defaultsLoaded = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [detailView, setDetailView] = useState(false);
  const [conflictMsg, setConflictMsg] = useState('');

  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [empPickerSearch, setEmpPickerSearch] = useState('');

  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  const [editingShiftLocation, setEditingShiftLocation] = useState<Location | null>(null);

  const [settingsTarget, setSettingsTarget] = useState<Location | null>(null);
  const [showRotation, setShowRotation] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [showRequestsInbox, setShowRequestsInbox] = useState(false);

  const [pendingSwap, setPendingSwap] = useState<ScheduleShift | null>(null);

  const [pickupDate, setPickupDate] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [pickupStart, setPickupStart] = useState('08:00');
  const [pickupEnd, setPickupEnd] = useState('20:00');
  const [pickupNextDay, setPickupNextDay] = useState(false);
  const [pickupNote, setPickupNote] = useState('');
  const [submittingPickup, setSubmittingPickup] = useState(false);

  const [editingAbsence, setEditingAbsence] = useState<ShiftAbsence | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');

  // ---------- Loaders ----------
  const loadLocations = useCallback(async () => {
    const { data } = await supabase
      .from('gym_locations')
      .select('id, gym_id, label, sched_required_hours, sched_visible_until_date')
      .eq('gym_id', gymId)
      .order('display_order');
    const list = (data as Location[]) ?? [];
    setLocations(list);
    setVisibleLocationIds((prev) => prev.size > 0 ? prev : new Set(list.map((l) => l.id)));
  }, [gymId]);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('gym_employees')
      .select('id, user_id, full_name, position')
      .eq('gym_id', gymId)
      .order('display_order');
    setEmployees(((data as any[]) ?? []).map((e) => ({
      id: e.id, user_id: e.user_id, full_name: e.full_name, position: e.position,
    })));
  }, [gymId]);

  const loadShifts = useCallback(async () => {
    const startPad = new Date(year, month, 1); startPad.setDate(startPad.getDate() - 7);
    const endPad = new Date(year, month + 1, 0); endPad.setDate(endPad.getDate() + 7);
    const { data } = await supabase
      .from('schedule_shifts')
      .select('*')
      .eq('gym_id', gymId)
      .gte('shift_date', toDateStr(startPad))
      .lte('shift_date', toDateStr(endPad));
    setShifts((data as ScheduleShift[]) ?? []);
  }, [gymId, year, month]);

  const loadAbsences = useCallback(async () => {
    const startPad = new Date(year, month, 1); startPad.setDate(startPad.getDate() - 7);
    const endPad = new Date(year, month + 1, 0); endPad.setDate(endPad.getDate() + 7);
    const { data } = await supabase
      .from('schedule_absences')
      .select('*')
      .eq('gym_id', gymId)
      .gte('shift_date', toDateStr(startPad))
      .lte('shift_date', toDateStr(endPad));
    setAbsences((data as ShiftAbsence[]) ?? []);
  }, [gymId, year, month]);

  const loadPickups = useCallback(async () => {
    const q = supabase
      .from('shift_pickup_requests')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    const { data } = mode === 'manage'
      ? await q
      : await q.eq('employee_id', myEmployeeId ?? '');
    setPickupRequests((data as ShiftPickupRequest[]) ?? []);
  }, [gymId, mode, myEmployeeId]);

  const loadFilters = useCallback(async () => {
    // Persisted per-user in BOTH manage and view modes — same table,
    // same per-(user, gym) row. Used to be manager-only; now any
    // employee browsing the read-only schedule also keeps their last
    // location + role filter selection across visits.
    if (!currentUserId) return;
    const { data } = await supabase
      .from('schedule_manager_filters')
      .select('visible_location_ids, role_filter')
      .eq('manager_user_id', currentUserId)
      .eq('gym_id', gymId)
      .maybeSingle();
    const ids: string[] = (data as any)?.visible_location_ids ?? [];
    if (ids.length > 0) setVisibleLocationIds(new Set(ids));
    const role = (data as any)?.role_filter as string | null | undefined;
    if (role != null) setRoleFilter(role);
  }, [gymId, currentUserId]);

  // Distinct roles for this gym. Sourced from gym_roles (the
  // owner-managed role catalog) so even roles nobody currently holds
  // are pickable as filters. Falls back to distinct employees.position
  // values for gyms that haven't seeded their roles table yet.
  const [gymRoles, setGymRoles] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from('gym_roles')
      .select('name')
      .eq('gym_id', gymId)
      .order('display_order')
      .then(({ data }) => {
        setGymRoles(((data as any[]) ?? []).map((r) => r.name as string).filter(Boolean));
      });
  }, [gymId]);

  // Persist the role filter selection (both modes) so coming back to
  // the schedule shows the same view the user left it in.
  const persistRoleFilter = useCallback(async (role: string | null) => {
    if (!currentUserId) return;
    await supabase.from('schedule_manager_filters').upsert({
      manager_user_id: currentUserId,
      gym_id: gymId,
      role_filter: role,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'manager_user_id,gym_id' });
  }, [currentUserId, gymId]);

  // ---------- Default-times persistence (manage) ----------
  useEffect(() => {
    AsyncStorage.getItem('wyld_sched_default_times').then((raw) => {
      if (raw) {
        try {
          const v = JSON.parse(raw);
          if (v.start) setDefaultStart(v.start);
          if (v.end) setDefaultEnd(v.end);
          if (typeof v.nextDay === 'boolean') setDefaultNextDay(v.nextDay);
        } catch {}
      }
      defaultsLoaded.current = true;
    });
  }, []);
  function persistDefaults(s: string, e: string, nd: boolean) {
    AsyncStorage.setItem('wyld_sched_default_times', JSON.stringify({ start: s, end: e, nextDay: nd }));
  }

  useEffect(() => { loadLocations(); loadEmployees(); loadFilters(); }, [loadLocations, loadEmployees, loadFilters]);
  useEffect(() => { loadShifts(); loadAbsences(); loadPickups(); }, [loadShifts, loadAbsences, loadPickups]);

  // ---------- Realtime ----------
  useEffect(() => {
    if (!gymId) return;
    const ch = supabase
      .channel(`schedule-${gymId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_shifts', filter: `gym_id=eq.${gymId}` },
        () => loadShifts())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shift_pickup_requests', filter: `gym_id=eq.${gymId}` },
        () => loadPickups())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_absences', filter: `gym_id=eq.${gymId}` },
        () => loadAbsences())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gymId, loadShifts, loadPickups, loadAbsences]);

  // ---------- Helpers ----------
  const visibleLocations = useMemo(
    () => locations.filter((l) => visibleLocationIds.has(l.id)),
    [locations, visibleLocationIds],
  );

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const getEmp = (id: string) => empById.get(id) ?? null;

  // Filter chips show every role the gym has defined (gym_roles), plus
  // any free-text positions actually in use on employees that aren't in
  // gym_roles yet. Sorted in catalog order first, then loose ones.
  const allRoles = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of gymRoles) {
      if (r && !seen.has(r)) { seen.add(r); out.push(r); }
    }
    const loose: string[] = [];
    employees.forEach((e) => {
      if (e.position && !seen.has(e.position)) {
        seen.add(e.position);
        loose.push(e.position);
      }
    });
    loose.sort();
    return [...out, ...loose];
  }, [gymRoles, employees]);

  function shiftsForCell(dateStr: string, locId: string): ScheduleShift[] {
    const loc = locations.find((l) => l.id === locId);
    if (mode === 'view' && loc?.sched_visible_until_date && dateStr > loc.sched_visible_until_date) {
      return [];
    }
    return shifts.filter((s) => s.shift_date === dateStr && s.location_id === locId);
  }

  function applyFilter(list: ScheduleShift[]): ScheduleShift[] {
    return list.filter((s) => {
      const e = getEmp(s.employee_id);
      if (roleFilter && e?.position !== roleFilter) return false;
      if (nameSearch.trim()) {
        if (!e?.full_name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      }
      if (mineOnly && s.employee_id !== myEmployeeId) return false;
      return true;
    });
  }

  function absencesFor(dateStr: string, locId: string): ShiftAbsence[] {
    return absences.filter((a) => a.shift_date === dateStr && a.location_id === locId);
  }
  function requestFor(dateStr: string, locId: string): ShiftPickupRequest | undefined {
    if (!myEmployeeId) return undefined;
    return pickupRequests.find(
      (r) => r.shift_date === dateStr && r.location_id === locId && r.employee_id === myEmployeeId,
    );
  }

  // ---------- Actions ----------
  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([loadLocations(), loadEmployees(), loadShifts(), loadAbsences(), loadPickups()]);
    setRefreshing(false);
  }

  async function toggleLocVisibility(locId: string) {
    const next = new Set(visibleLocationIds);
    if (next.has(locId)) next.delete(locId); else next.add(locId);
    setVisibleLocationIds(next);
    // Persist in BOTH modes so an employee's location filter survives a
    // page reload, not just a manager's.
    if (currentUserId) {
      await supabase.from('schedule_manager_filters').upsert({
        manager_user_id: currentUserId,
        gym_id: gymId,
        visible_location_ids: Array.from(next),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'manager_user_id,gym_id' });
    }
  }

  async function addShift(dateStr: string, locId: string) {
    if (!selectedEmployee) {
      setConflictMsg('Pick an employee from the employee panel first.');
      setTimeout(() => setConflictMsg(''), 3000);
      return;
    }
    if (hasConflict(shifts, selectedEmployee.id, dateStr, defaultStart, defaultEnd, defaultNextDay)) {
      setConflictMsg(`${selectedEmployee.full_name} already has an overlapping shift on ${dateStr}.`);
      setTimeout(() => setConflictMsg(''), 3000);
      return;
    }
    const { data: created } = await supabase
      .from('schedule_shifts')
      .insert({
        gym_id: gymId,
        location_id: locId,
        employee_id: selectedEmployee.id,
        shift_date: dateStr,
        start_time: defaultStart,
        end_time: defaultEnd,
        is_next_day: defaultNextDay,
        created_by: currentUserId,
      })
      .select('*')
      .maybeSingle();

    if (created) {
      await supabase.from('schedule_history').insert({
        shift_id: created.id, action_type: 'created',
        employee_id: selectedEmployee.id, location_id: locId, gym_id: gymId,
        changed_by_user_id: currentUserId,
        new_values: { shift_date: dateStr, start_time: defaultStart, end_time: defaultEnd, is_next_day: defaultNextDay },
      });
    }
    await loadShifts();
  }

  async function saveShiftEdit(updated: Partial<ScheduleShift>) {
    if (!updated.id || !editingShift) return;
    await supabase
      .from('schedule_shifts')
      .update({
        start_time: updated.start_time, end_time: updated.end_time,
        is_next_day: updated.is_next_day, updated_at: new Date().toISOString(),
      })
      .eq('id', updated.id);
    await supabase.from('schedule_history').insert({
      shift_id: updated.id, action_type: 'updated',
      employee_id: editingShift.employee_id, location_id: editingShift.location_id, gym_id: gymId,
      changed_by_user_id: currentUserId,
      old_values: { start_time: editingShift.start_time, end_time: editingShift.end_time, is_next_day: editingShift.is_next_day, shift_date: editingShift.shift_date },
      new_values: { start_time: updated.start_time, end_time: updated.end_time, is_next_day: updated.is_next_day, shift_date: editingShift.shift_date },
    });
    await loadShifts();
  }

  async function deleteShift(shiftId: string, reason: DeleteReason) {
    const s = shifts.find((x) => x.id === shiftId);
    if (!s) return;
    await supabase.from('schedule_history').insert({
      shift_id: shiftId, action_type: 'deleted',
      employee_id: s.employee_id, location_id: s.location_id, gym_id: gymId,
      changed_by_user_id: currentUserId,
      old_values: { shift_date: s.shift_date, start_time: s.start_time, end_time: s.end_time, is_next_day: s.is_next_day },
      notes: reason,
    });
    await supabase.from('schedule_shifts').delete().eq('id', shiftId);
    if (reason !== 'Error in Entry') {
      await supabase.from('schedule_absences').insert({
        gym_id: gymId, location_id: s.location_id, employee_id: s.employee_id,
        shift_date: s.shift_date, reason, created_by: currentUserId,
      });
    }
    await Promise.all([loadShifts(), loadAbsences()]);
  }

  async function handleRotationCreate(newShifts: Omit<ScheduleShift, 'id' | 'created_at' | 'updated_at'>[]) {
    if (newShifts.length === 0) return;
    const { data: inserted } = await supabase.from('schedule_shifts').insert(newShifts).select('id, employee_id, location_id, shift_date, start_time, end_time, is_next_day');
    const histRows = ((inserted as any[]) ?? []).map((s) => ({
      shift_id: s.id, action_type: 'rotation_created',
      employee_id: s.employee_id, location_id: s.location_id, gym_id: gymId,
      changed_by_user_id: currentUserId,
      new_values: { shift_date: s.shift_date, start_time: s.start_time, end_time: s.end_time, is_next_day: s.is_next_day },
    }));
    if (histRows.length > 0) await supabase.from('schedule_history').insert(histRows);
    await loadShifts();
  }

  // Swap: long-press source, tap another → swap their employees.
  function getSwapState(s: ScheduleShift): 'source' | 'target' | null {
    if (!pendingSwap) return null;
    if (s.id === pendingSwap.id) return 'source';
    return 'target';
  }
  async function executeSwap(a: ScheduleShift, b: ScheduleShift) {
    setPendingSwap(null);
    const others = shifts.filter((s) => s.id !== a.id && s.id !== b.id);
    if (hasConflict(others, b.employee_id, a.shift_date, a.start_time, a.end_time, a.is_next_day)
        || hasConflict(others, a.employee_id, b.shift_date, b.start_time, b.end_time, b.is_next_day)) {
      setConflictMsg('Swap would create a conflicting shift.');
      setTimeout(() => setConflictMsg(''), 3000);
      return;
    }
    await Promise.all([
      supabase.from('schedule_shifts').update({ employee_id: b.employee_id, updated_at: new Date().toISOString() }).eq('id', a.id),
      supabase.from('schedule_shifts').update({ employee_id: a.employee_id, updated_at: new Date().toISOString() }).eq('id', b.id),
    ]);
    await supabase.from('schedule_history').insert([
      { shift_id: a.id, action_type: 'swapped', employee_id: b.employee_id, location_id: a.location_id, gym_id: gymId, changed_by_user_id: currentUserId, old_values: { employee_id: a.employee_id }, new_values: { employee_id: b.employee_id, with_shift: b.id } },
      { shift_id: b.id, action_type: 'swapped', employee_id: a.employee_id, location_id: b.location_id, gym_id: gymId, changed_by_user_id: currentUserId, old_values: { employee_id: b.employee_id }, new_values: { employee_id: a.employee_id, with_shift: a.id } },
    ]);
    await loadShifts();
  }

  function onShiftPress(s: ScheduleShift) {
    if (mode !== 'manage') return;
    if (pendingSwap) {
      if (pendingSwap.id === s.id) { setPendingSwap(null); return; }
      executeSwap(pendingSwap, s);
      return;
    }
    setEditingShift(s);
    setEditingShiftLocation(locations.find((l) => l.id === s.location_id) ?? null);
  }

  // ---------- Pickup actions ----------
  function openPickup(dateStr: string, loc: Location) {
    setPickupDate(dateStr);
    setPickupLocation(loc);
    setPickupStart(defaultStart);
    setPickupEnd(defaultEnd);
    setPickupNextDay(defaultNextDay);
    setPickupNote('');
  }
  async function submitPickup() {
    if (!pickupDate || !pickupLocation || !myEmployeeId) return;
    setSubmittingPickup(true);
    await supabase.from('shift_pickup_requests').insert({
      gym_id: gymId, location_id: pickupLocation.id, employee_id: myEmployeeId,
      shift_date: pickupDate, requested_start_time: pickupStart, requested_end_time: pickupEnd,
      is_next_day: pickupNextDay, notes: pickupNote.trim() || null, status: 'pending',
    });
    setSubmittingPickup(false);
    setPickupDate(null); setPickupLocation(null);
    await loadPickups();
  }
  async function approvePickup(req: ShiftPickupRequest) {
    const { data: created } = await supabase.from('schedule_shifts').insert({
      gym_id: req.gym_id, location_id: req.location_id, employee_id: req.employee_id,
      shift_date: req.shift_date, start_time: req.requested_start_time,
      end_time: req.requested_end_time, is_next_day: req.is_next_day,
      created_by: currentUserId,
    }).select('*').maybeSingle();
    if (created) {
      await supabase.from('schedule_history').insert({
        shift_id: created.id, action_type: 'created',
        employee_id: req.employee_id, location_id: req.location_id, gym_id: gymId,
        changed_by_user_id: currentUserId,
        new_values: { shift_date: req.shift_date, start_time: req.requested_start_time, end_time: req.requested_end_time, is_next_day: req.is_next_day, source: 'pickup_request' },
      });
    }
    await supabase.from('shift_pickup_requests').update({
      status: 'approved', reviewed_by: currentUserId, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    await Promise.all([loadShifts(), loadPickups()]);
  }
  async function denyPickup(req: ShiftPickupRequest) {
    await supabase.from('shift_pickup_requests').update({
      status: 'denied', reviewed_by: currentUserId, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    await loadPickups();
  }

  // ---------- Absence editing ----------
  async function updateAbsence(ab: ShiftAbsence, reason: string) {
    await supabase.from('schedule_absences').update({ reason }).eq('id', ab.id);
    setEditingAbsence(null);
    await loadAbsences();
  }
  async function removeAbsence(id: string) {
    await supabase.from('schedule_absences').delete().eq('id', id);
    await loadAbsences();
  }

  // ---------- Date nav ----------
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevDay = () => setViewDate(new Date(viewDate.getTime() - 86400000));
  const nextDay = () => setViewDate(new Date(viewDate.getTime() + 86400000));

  const pendingCount = pickupRequests.filter((r) => r.status === 'pending').length;

  // ---------- Render ----------
  return (
    <View style={styles.root}>
      {/* Header strip */}
      <View style={styles.headerStrip}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.sub}>{gymName}{mode === 'view' ? ' · Read-only' : ''}</Text>
        </View>
        {mode === 'manage' && (
          <View style={styles.headerActions}>
            <Pressable style={styles.iconBtn} onPress={() => { setHistoryDate(null); setShowHistory(true); }}>
              <Text style={styles.iconBtnText}>History</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setShowRequestsInbox(true)}>
              <Text style={styles.iconBtnText}>Requests</Text>
              {pendingCount > 0 ? (
                <View style={styles.bell}><Text style={styles.bellText}>{pendingCount}</Text></View>
              ) : null}
            </Pressable>
            <Pressable style={[styles.iconBtn, styles.iconBtnPrimary]} onPress={() => setShowRotation(true)}>
              <Text style={[styles.iconBtnText, { color: '#fff' }]}>Rotation</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* View toggle */}
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]} onPress={() => setViewMode('month')}>
          <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>Month</Text>
        </Pressable>
        <Pressable style={[styles.toggleBtn, viewMode === 'day' && styles.toggleBtnActive]} onPress={() => setViewMode('day')}>
          <Text style={[styles.toggleText, viewMode === 'day' && styles.toggleTextActive]}>Day</Text>
        </Pressable>
        <Pressable style={[styles.toggleBtn, detailView && styles.toggleBtnActive]} onPress={() => setDetailView((v) => !v)}>
          <Text style={[styles.toggleText, detailView && styles.toggleTextActive]}>Detail</Text>
        </Pressable>
        {mode === 'view' && (
          <Pressable style={[styles.toggleBtn, mineOnly && styles.toggleBtnActive]} onPress={() => setMineOnly((v) => !v)}>
            <Text style={[styles.toggleText, mineOnly && styles.toggleTextActive]}>Mine</Text>
          </Pressable>
        )}
      </View>

      {/* Location chips */}
      <View style={styles.locBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locBarContent}>
          {locations.map((loc) => {
            const on = visibleLocationIds.has(loc.id);
            return (
              <View key={loc.id} style={[styles.locChip, !on && styles.locChipOff]}>
                <Pressable onPress={() => toggleLocVisibility(loc.id)}>
                  <Text style={[styles.locChipText, !on && styles.locChipTextOff]} numberOfLines={1}>{loc.label}</Text>
                </Pressable>
                {mode === 'manage' && (
                  <Pressable style={styles.locChipGear} onPress={() => setSettingsTarget(loc)}>
                    <Text style={styles.locChipGearText}>⚙</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Role + name filter */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarContent}>
          <Pressable
            style={[styles.filterChip, roleFilter === null && styles.filterChipActive]}
            onPress={() => { setRoleFilter(null); persistRoleFilter(null); }}
          >
            <Text style={[styles.filterChipText, roleFilter === null && styles.filterChipTextActive]}>All Roles</Text>
          </Pressable>
          {allRoles.map((r) => (
            <Pressable
              key={r}
              style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
              onPress={() => {
                const next = r === roleFilter ? null : r;
                setRoleFilter(next);
                persistRoleFilter(next);
              }}
            >
              <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>{r}</Text>
            </Pressable>
          ))}
          <TextInput
            style={styles.searchInput}
            value={nameSearch}
            onChangeText={setNameSearch}
            placeholder="Search name..."
            placeholderTextColor="#94a3b8"
          />
        </ScrollView>
      </View>

      {/* Employee panel — manage only */}
      {mode === 'manage' && (
        <Pressable style={styles.empPanel} onPress={() => setShowEmpPicker(true)}>
          {selectedEmployee ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.empPanelName}>{selectedEmployee.full_name}</Text>
              {selectedEmployee.position ? <Text style={styles.empPanelPos}>{selectedEmployee.position}</Text> : null}
            </View>
          ) : (
            <Text style={styles.empPanelPlaceholder}>Pick an employee for new shifts</Text>
          )}
          <Text style={styles.empPanelTimes}>
            {formatTimeDisplay(defaultStart)} – {formatTimeDisplay(defaultEnd)}{defaultNextDay ? ' +1' : ''}
          </Text>
        </Pressable>
      )}

      {conflictMsg ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{conflictMsg}</Text>
        </View>
      ) : null}

      {pendingSwap && (
        <View style={[styles.banner, styles.bannerPurple]}>
          <Text style={[styles.bannerText, { color: '#fff' }]}>
            Swap mode: tap another shift to swap employees
          </Text>
          <Pressable onPress={() => setPendingSwap(null)}>
            <Text style={[styles.bannerText, { color: '#fff', fontWeight: '800' }]}>×</Text>
          </Pressable>
        </View>
      )}

      {/* Calendar */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
      >
        {viewMode === 'month' ? (
          <View style={styles.calendarWrap}>
            <View style={styles.monthNav}>
              <Pressable onPress={prevMonth} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></Pressable>
              <Text style={styles.monthLabel}>{formatMonthLabel(year, month)}</Text>
              <Pressable onPress={nextMonth} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></Pressable>
            </View>

            {isWide ? (
              <>
                <View style={styles.dayHeaders}>
                  {DAYS.map((d) => (
                    <Text key={d} style={[styles.dayHeader, { width: CELL_PCT }]}>{d}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {monthDays.map((day, idx) => {
                    const dateStr = toDateStr(day);
                    const inMonth = day.getMonth() === month;
                    const isToday = dateStr === todayDateStr;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.dayCell, { width: CELL_PCT },
                          !inMonth && styles.dayCellOther,
                          isToday && styles.dayCellToday,
                        ]}
                      >
                        <View style={styles.dayCellTop}>
                          <Text style={[styles.dayCellNum, !inMonth && styles.dayCellNumOther, isToday && styles.dayCellNumToday]}>
                            {day.getDate()}
                          </Text>
                          {inMonth && mode === 'manage' && (
                            <Pressable onPress={() => { setHistoryDate(dateStr); setShowHistory(true); }}>
                              <Text style={styles.dayCellHistory}>⏱</Text>
                            </Pressable>
                          )}
                        </View>
                        {inMonth && visibleLocations.map((loc) => {
                          const dayShifts = shiftsForCell(dateStr, loc.id);
                          const filtered = applyFilter(dayShifts);
                          const coverage = calcCoverage(dayShifts, loc.sched_required_hours);
                          const pillColor = loc.sched_required_hours === 0
                            ? theme.colors.border
                            : coverage.meetsRequired ? '#16a34a' : '#dc2626';
                          const myReq = requestFor(dateStr, loc.id);
                          const hasMy = dayShifts.some((s) => s.employee_id === myEmployeeId);
                          const availHrs = Math.max(0, loc.sched_required_hours - coverage.totalHours);
                          return (
                            <View key={loc.id} style={styles.lane}>
                              <View style={styles.laneTop}>
                                <Text style={styles.laneName} numberOfLines={1}>{loc.label}</Text>
                                <View style={[styles.coveragePill, { backgroundColor: pillColor }]} />
                              </View>
                              {detailView ? renderDetailGroups(filtered, getEmp, allRoles, onShiftPress, getSwapState, mode) :
                                <View style={styles.chipsRow}>
                                  {filtered.map((s) => {
                                    const e = getEmp(s.employee_id);
                                    const swap = getSwapState(s);
                                    const isMine = s.employee_id === myEmployeeId;
                                    return (
                                      <Pressable
                                        key={s.id}
                                        style={[
                                          styles.chip,
                                          isMine && styles.chipMine,
                                          swap === 'source' && styles.chipSwapSource,
                                          swap === 'target' && styles.chipSwapTarget,
                                        ]}
                                        onPress={() => onShiftPress(s)}
                                        onLongPress={() => mode === 'manage' && setPendingSwap(s)}
                                        delayLongPress={400}
                                      >
                                        <Text style={[styles.chipText, isMine && styles.chipTextMine]} numberOfLines={1}>
                                          {e?.full_name ?? '—'}
                                        </Text>
                                      </Pressable>
                                    );
                                  })}
                                  {mode === 'manage' && (
                                    <Pressable style={styles.addChip} onPress={() => addShift(dateStr, loc.id)}>
                                      <Text style={styles.addChipText}>+</Text>
                                    </Pressable>
                                  )}
                                </View>
                              }
                              {absencesFor(dateStr, loc.id).map((ab) => {
                                const e = getEmp(ab.employee_id);
                                return (
                                  <Pressable
                                    key={ab.id}
                                    style={styles.absChip}
                                    onPress={() => mode === 'manage' && (setEditingAbsence(ab), setAbsenceReason(ab.reason))}
                                  >
                                    <Text style={styles.absChipText} numberOfLines={1}>
                                      {e?.full_name ?? '?'} · {ab.reason}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                              {mode === 'view' && !hasMy && availHrs > 0 && (
                                myReq ? (
                                  <View style={[styles.reqBadge, myReq.status === 'approved' && styles.reqBadgeOk, myReq.status === 'denied' && styles.reqBadgeBad]}>
                                    <Text style={styles.reqBadgeText}>
                                      {myReq.status === 'pending' ? 'Requested' : myReq.status === 'approved' ? 'Approved' : 'Denied'}
                                    </Text>
                                  </View>
                                ) : (
                                  <Pressable style={styles.availBtn} onPress={() => openPickup(dateStr, loc)}>
                                    <Text style={styles.availBtnText}>{availHrs.toFixed(1)}h · Request</Text>
                                  </Pressable>
                                )
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              // Mobile stack
              <View style={styles.mobileStack}>
                {monthDays.filter((d) => d.getMonth() === month).map((day, idx) => {
                  const dateStr = toDateStr(day);
                  const isToday = dateStr === todayDateStr;
                  return (
                    <View key={idx} style={[styles.mobileDay, isToday && styles.mobileDayToday]}>
                      <View style={styles.mobileDayHead}>
                        <Text style={[styles.mobileDayNum, isToday && styles.mobileDayNumToday]}>{day.getDate()}</Text>
                        <Text style={styles.mobileDayName}>{DAYS[day.getDay()]}</Text>
                      </View>
                      {visibleLocations.map((loc) => {
                        const dayShifts = shiftsForCell(dateStr, loc.id);
                        const filtered = applyFilter(dayShifts);
                        if (filtered.length === 0 && absencesFor(dateStr, loc.id).length === 0) return null;
                        return (
                          <View key={loc.id} style={styles.mobileLane}>
                            <Text style={styles.mobileLaneName}>{loc.label}</Text>
                            {filtered.map((s) => {
                              const e = getEmp(s.employee_id);
                              const isMine = s.employee_id === myEmployeeId;
                              return (
                                <Pressable
                                  key={s.id}
                                  style={[styles.mobileRow, isMine && styles.mobileRowMine]}
                                  onPress={() => onShiftPress(s)}
                                >
                                  <Text style={[styles.mobileRowName, isMine && styles.mobileRowNameMine]}>
                                    {e?.full_name ?? '—'}{isMine ? ' (You)' : ''}
                                  </Text>
                                  <Text style={[styles.mobileRowTime, isMine && styles.mobileRowTimeMine]}>
                                    {formatTimeDisplay(s.start_time.substring(0, 5))}–{formatTimeDisplay(s.end_time.substring(0, 5))}{s.is_next_day ? ' +1' : ''}
                                  </Text>
                                </Pressable>
                              );
                            })}
                            {mode === 'manage' && (
                              <Pressable style={styles.mobileAddBtn} onPress={() => addShift(dateStr, loc.id)}>
                                <Text style={styles.mobileAddBtnText}>+ Add shift</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          // Day view
          <View style={styles.dayWrap}>
            <View style={styles.monthNav}>
              <Pressable onPress={prevDay} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></Pressable>
              <Pressable onPress={() => setViewDate(new Date())}>
                <Text style={styles.monthLabel}>{formatDateLabel(viewDate)}</Text>
                {viewDateStr === todayDateStr && (
                  <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Today</Text></View>
                )}
              </Pressable>
              <Pressable onPress={nextDay} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></Pressable>
            </View>

            {visibleLocations.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No locations visible. Toggle one on above.</Text>
              </View>
            )}

            {visibleLocations.map((loc) => {
              const dayShifts = shiftsForCell(viewDateStr, loc.id);
              const filtered = applyFilter(dayShifts);
              const coverage = calcCoverage(dayShifts, loc.sched_required_hours);
              const myReq = requestFor(viewDateStr, loc.id);
              const hasMy = dayShifts.some((s) => s.employee_id === myEmployeeId);
              const availHrs = Math.max(0, loc.sched_required_hours - coverage.totalHours);
              return (
                <View key={loc.id} style={styles.dayCard}>
                  <View style={styles.dayCardHead}>
                    <Text style={styles.dayCardName}>{loc.label}</Text>
                    {loc.sched_required_hours > 0 && (
                      <Text style={[styles.dayCardCov, coverage.meetsRequired && styles.dayCardCovOk]}>
                        {coverage.totalHours.toFixed(1)} / {loc.sched_required_hours} hrs
                      </Text>
                    )}
                    {mode === 'manage' && (
                      <Pressable style={styles.dayAddBtn} onPress={() => addShift(viewDateStr, loc.id)}>
                        <Text style={styles.dayAddBtnText}>+</Text>
                      </Pressable>
                    )}
                  </View>

                  {filtered.length === 0 ? (
                    <Text style={styles.dayEmpty}>No shifts scheduled</Text>
                  ) : (
                    filtered.map((s) => {
                      const e = getEmp(s.employee_id);
                      const isMine = s.employee_id === myEmployeeId;
                      const swap = getSwapState(s);
                      const hrs = calcShiftHours(s.start_time, s.end_time, s.is_next_day);
                      return (
                        <Pressable
                          key={s.id}
                          style={[
                            styles.dayRow,
                            isMine && styles.dayRowMine,
                            swap === 'source' && styles.dayRowSwapSource,
                            swap === 'target' && styles.dayRowSwapTarget,
                          ]}
                          onPress={() => onShiftPress(s)}
                          onLongPress={() => mode === 'manage' && setPendingSwap(s)}
                          delayLongPress={400}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dayRowName, isMine && styles.dayRowNameMine]}>
                              {e?.full_name ?? '—'}{isMine ? ' (You)' : ''}
                            </Text>
                            {e?.position ? <Text style={styles.dayRowPos}>{e.position}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.dayRowTime}>
                              {formatTimeDisplay(s.start_time.substring(0, 5))} – {formatTimeDisplay(s.end_time.substring(0, 5))}{s.is_next_day ? ' +1' : ''}
                            </Text>
                            <Text style={styles.dayRowHrs}>{hrs.toFixed(1)} hrs</Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  {absencesFor(viewDateStr, loc.id).map((ab) => {
                    const e = getEmp(ab.employee_id);
                    return (
                      <View key={ab.id} style={styles.absRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.absRowName}>{e?.full_name ?? '?'}</Text>
                          <Text style={styles.absRowReason}>{ab.reason}</Text>
                        </View>
                        {mode === 'manage' && (
                          <>
                            <Pressable style={styles.absEditBtn} onPress={() => { setEditingAbsence(ab); setAbsenceReason(ab.reason); }}>
                              <Text style={styles.absEditBtnText}>Edit</Text>
                            </Pressable>
                            <Pressable onPress={() => removeAbsence(ab.id)}>
                              <Text style={styles.absDelBtn}>×</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    );
                  })}

                  {mode === 'view' && !hasMy && availHrs > 0 && (
                    <View style={styles.dayAvailRow}>
                      <Text style={styles.dayAvailText}>{availHrs.toFixed(1)} hrs available</Text>
                      {myReq ? (
                        <View style={[styles.reqBadge, myReq.status === 'approved' && styles.reqBadgeOk, myReq.status === 'denied' && styles.reqBadgeBad]}>
                          <Text style={styles.reqBadgeText}>
                            {myReq.status === 'pending' ? 'Pending' : myReq.status === 'approved' ? 'Approved' : 'Denied'}
                          </Text>
                        </View>
                      ) : (
                        <Pressable style={styles.pickupBtn} onPress={() => openPickup(viewDateStr, loc)}>
                          <Text style={styles.pickupBtnText}>Request Pickup</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─── Modals ─── */}

      {/* Employee picker */}
      <Modal visible={showEmpPicker} transparent animationType={isWide ? 'fade' : 'slide'}>
        <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
          <View style={[styles.modalSheet, isWide && styles.modalSheetWide]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Employee</Text>
              <Pressable onPress={() => { setShowEmpPicker(false); setEmpPickerSearch(''); }}><Text style={styles.x}>×</Text></Pressable>
            </View>
            <Text style={styles.sectionLabel}>Default Shift Times</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TimePicker label="Start" value={defaultStart} onChange={(t) => {
                  const nd = detectNextDay(t, defaultEnd) || defaultNextDay;
                  setDefaultStart(t); setDefaultNextDay(nd); persistDefaults(t, defaultEnd, nd);
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <TimePicker label="End" value={defaultEnd} onChange={(t) => {
                  const nd = detectNextDay(defaultStart, t) || defaultNextDay;
                  setDefaultEnd(t); setDefaultNextDay(nd); persistDefaults(defaultStart, t, nd);
                }} />
              </View>
            </View>
            <Pressable
              style={[styles.overnightToggle, defaultNextDay && styles.overnightToggleActive]}
              onPress={() => { const nd = !defaultNextDay; setDefaultNextDay(nd); persistDefaults(defaultStart, defaultEnd, nd); }}
            >
              <Text style={[styles.overnightToggleText, defaultNextDay && styles.overnightToggleTextActive]}>
                {defaultNextDay ? '🌙 Overnight (end is next day)' : '☀️ Same day'}
              </Text>
            </Pressable>
            <TextInput
              style={styles.empSearch}
              value={empPickerSearch}
              onChangeText={setEmpPickerSearch}
              placeholder="Search employees..."
              placeholderTextColor="#94a3b8"
            />
            <ScrollView style={{ maxHeight: 320 }}>
              {selectedEmployee && (
                <Pressable
                  style={styles.clearEmp}
                  onPress={() => { setSelectedEmployee(null); setShowEmpPicker(false); }}
                >
                  <Text style={styles.clearEmpText}>Clear Selection</Text>
                </Pressable>
              )}
              {employees
                .filter((e) => e.full_name.toLowerCase().includes(empPickerSearch.toLowerCase()))
                .map((e) => (
                  <Pressable
                    key={e.id}
                    style={[styles.empItem, selectedEmployee?.id === e.id && styles.empItemActive]}
                    onPress={() => { setSelectedEmployee(e); setShowEmpPicker(false); setEmpPickerSearch(''); }}
                  >
                    <View>
                      <Text style={styles.empItemName}>{e.full_name}</Text>
                      {e.position ? <Text style={styles.empItemPos}>{e.position}</Text> : null}
                    </View>
                    {selectedEmployee?.id === e.id && <View style={styles.empItemCheck} />}
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Absence reason editor */}
      <Modal visible={editingAbsence !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Absence Reason</Text>
              <Pressable onPress={() => setEditingAbsence(null)}><Text style={styles.x}>×</Text></Pressable>
            </View>
            <ScrollView>
              {DELETE_REASONS.filter((r) => r !== 'Error in Entry').map((r) => (
                <Pressable key={r} style={styles.reasonRow} onPress={() => setAbsenceReason(r)}>
                  <View style={[styles.radio, absenceReason === r && styles.radioActive]} />
                  <Text style={[styles.reasonText, absenceReason === r && styles.reasonTextActive]}>{r}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable
                  style={[styles.absModalBtn, { backgroundColor: '#FEE2E2', flex: 1 }]}
                  onPress={() => { removeAbsence(editingAbsence!.id); setEditingAbsence(null); }}
                >
                  <Text style={[styles.absModalBtnText, { color: theme.colors.danger }]}>Remove</Text>
                </Pressable>
                <Pressable
                  style={[styles.absModalBtn, { backgroundColor: theme.colors.wyldPurple, flex: 1 }]}
                  onPress={() => updateAbsence(editingAbsence!, absenceReason)}
                >
                  <Text style={[styles.absModalBtnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pickup-request inbox (manage) */}
      <Modal visible={showRequestsInbox} transparent animationType={isWide ? 'fade' : 'slide'}>
        <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
          <View style={[styles.modalSheet, isWide && styles.modalSheetWide]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pickup Requests</Text>
              <Pressable onPress={() => setShowRequestsInbox(false)}><Text style={styles.x}>×</Text></Pressable>
            </View>
            <ScrollView>
              {pickupRequests.length === 0 ? (
                <Text style={styles.empty2}>No pickup requests.</Text>
              ) : pickupRequests.map((req) => {
                const e = getEmp(req.employee_id);
                const loc = locations.find((l) => l.id === req.location_id);
                return (
                  <View key={req.id} style={styles.reqCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>{e?.full_name ?? 'Unknown'}</Text>
                      <Text style={styles.reqLoc}>{loc?.label ?? 'Unknown location'}</Text>
                      <Text style={styles.reqWhen}>
                        {req.shift_date} · {formatTimeDisplay(req.requested_start_time)} – {formatTimeDisplay(req.requested_end_time)}{req.is_next_day ? ' +1' : ''}
                      </Text>
                      {req.notes ? <Text style={styles.reqNote}>"{req.notes}"</Text> : null}
                    </View>
                    {req.status === 'pending' ? (
                      <View style={{ gap: 6 }}>
                        <Pressable style={[styles.smallBtn, { backgroundColor: '#16a34a' }]} onPress={() => approvePickup(req)}>
                          <Text style={styles.smallBtnText}>Approve</Text>
                        </Pressable>
                        <Pressable style={[styles.smallBtn, { backgroundColor: theme.colors.danger }]} onPress={() => denyPickup(req)}>
                          <Text style={styles.smallBtnText}>Deny</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={[styles.statusTag, req.status === 'approved' && { backgroundColor: '#dcfce7' }, req.status === 'denied' && { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.statusTagText, req.status === 'approved' && { color: '#15803d' }, req.status === 'denied' && { color: theme.colors.danger }]}>
                          {req.status}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pickup-request form (view) */}
      <Modal visible={pickupDate !== null && pickupLocation !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, isWide && styles.modalSheetWide]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Pickup</Text>
              <Pressable onPress={() => { setPickupDate(null); setPickupLocation(null); }}><Text style={styles.x}>×</Text></Pressable>
            </View>
            <Text style={styles.reqHint}>{pickupLocation?.label} · {pickupDate}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TimePicker label="Start" value={pickupStart} onChange={(t) => {
                  setPickupStart(t);
                  if (detectNextDay(t, pickupEnd)) setPickupNextDay(true);
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <TimePicker label="End" value={pickupEnd} onChange={(t) => {
                  setPickupEnd(t);
                  if (detectNextDay(pickupStart, t)) setPickupNextDay(true);
                }} />
              </View>
            </View>
            <Pressable
              style={[styles.overnightToggle, pickupNextDay && styles.overnightToggleActive]}
              onPress={() => setPickupNextDay((v) => !v)}
            >
              <Text style={[styles.overnightToggleText, pickupNextDay && styles.overnightToggleTextActive]}>
                {pickupNextDay ? '🌙 Overnight (end is next day)' : '☀️ Same day'}
              </Text>
            </Pressable>
            <Text style={styles.sectionLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={pickupNote}
              onChangeText={setPickupNote}
              placeholder="Anything the manager should know..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
            <Pressable style={[styles.submitBtn, submittingPickup && styles.submitBtnBusy]} disabled={submittingPickup} onPress={submitPickup}>
              {submittingPickup ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <ShiftEditModal
        visible={editingShift !== null}
        shift={editingShift}
        location={editingShiftLocation}
        employee={editingShift ? getEmp(editingShift.employee_id) : null}
        allShifts={shifts}
        onSave={saveShiftEdit}
        onDelete={deleteShift}
        onClose={() => { setEditingShift(null); setEditingShiftLocation(null); }}
      />

      <RotationModal
        visible={showRotation}
        employees={employees}
        locations={locations}
        gymId={gymId}
        allShifts={shifts}
        currentUserId={currentUserId}
        onCreated={handleRotationCreate}
        onClose={() => setShowRotation(false)}
      />

      <ScheduleHistoryPanel
        visible={showHistory}
        gymId={gymId}
        employees={employees}
        locations={locations}
        filterDate={historyDate}
        onClose={() => { setShowHistory(false); setHistoryDate(null); }}
      />

      <LocationSettingsModal
        visible={settingsTarget !== null}
        location={settingsTarget}
        onClose={(saved) => { setSettingsTarget(null); if (saved) loadLocations(); }}
      />
    </View>
  );
}

// Detail-grouped renderer (used in month-cell detail view)
function renderDetailGroups(
  filtered: ScheduleShift[],
  getEmp: (id: string) => EmployeeOption | null,
  allRoles: string[],
  onShiftPress: (s: ScheduleShift) => void,
  getSwapState: (s: ScheduleShift) => 'source' | 'target' | null,
  mode: 'manage' | 'view',
) {
  const groups: Record<string, ScheduleShift[]> = {};
  filtered.forEach((s) => {
    const e = getEmp(s.employee_id);
    const key = e?.position ?? 'No role';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return (
    <View style={{ gap: 4 }}>
      {Object.entries(groups).map(([role, list]) => (
        <View key={role}>
          <Text style={styles.detailGroupLabel}>{role}</Text>
          {list.map((s) => {
            const e = getEmp(s.employee_id);
            const swap = getSwapState(s);
            return (
              <Pressable
                key={s.id}
                style={[
                  styles.detailRow,
                  swap === 'source' && styles.chipSwapSource,
                  swap === 'target' && styles.chipSwapTarget,
                ]}
                onPress={() => onShiftPress(s)}
              >
                <Text style={styles.detailRowName} numberOfLines={1}>{e?.full_name ?? '—'}</Text>
                <Text style={styles.detailRowTime}>
                  {formatTimeDisplay(s.start_time.substring(0, 5)).replace(' ', '').toLowerCase()}–
                  {formatTimeDisplay(s.end_time.substring(0, 5)).replace(' ', '').toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  headerStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  iconBtnPrimary: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  iconBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  bell: {
    backgroundColor: theme.colors.danger, borderRadius: 999, minWidth: 18, paddingHorizontal: 4,
    alignItems: 'center', marginLeft: 4,
  },
  bellText: { color: '#fff', fontWeight: '800', fontSize: 10 },

  toggleRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  toggleBtnActive: { borderBottomColor: theme.colors.wyldPurple },
  toggleText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  toggleTextActive: { color: theme.colors.wyldPurple },

  locBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  locBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  locChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F3FF', borderRadius: 14, paddingLeft: 12, paddingRight: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.colors.wyldPurple,
  },
  locChipOff: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  locChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.wyldPurple, maxWidth: 130 },
  locChipTextOff: { color: theme.colors.textSecondary },
  locChipGear: { padding: 2 },
  locChipGearText: { fontSize: 12 },

  filterBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  filterBarContent: { paddingHorizontal: 12, paddingVertical: 7, gap: 6, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  searchInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, fontSize: 12, color: theme.colors.charcoal, minWidth: 130,
  },

  empPanel: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  empPanelPlaceholder: { flex: 1, color: theme.colors.textSecondary, fontSize: 13 },
  empPanelName: { fontWeight: '800', color: theme.colors.charcoal, fontSize: 14 },
  empPanelPos: { color: theme.colors.textSecondary, fontSize: 11 },
  empPanelTimes: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 12 },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEE2E2', padding: 10, gap: 6,
  },
  bannerPurple: { backgroundColor: theme.colors.wyldPurple },
  bannerText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },

  calendarWrap: { paddingBottom: 24 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  navBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  navBtnText: { fontSize: 24, color: theme.colors.charcoal, lineHeight: 24 },
  monthLabel: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },

  dayHeaders: { flexDirection: 'row' },
  dayHeader: {
    textAlign: 'center', fontSize: 12, fontWeight: '700',
    color: theme.colors.textSecondary, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    minHeight: 130, borderWidth: 0.5, borderColor: theme.colors.border,
    padding: 6, backgroundColor: '#fff',
  },
  dayCellOther: { backgroundColor: '#fafafa' },
  dayCellToday: { borderColor: theme.colors.wyldPurple, borderWidth: 2 },
  dayCellTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  dayCellNum: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  dayCellNumOther: { color: theme.colors.textSecondary, fontWeight: '400' },
  dayCellNumToday: { color: theme.colors.wyldPurple, fontWeight: '800' },
  dayCellHistory: { fontSize: 12, opacity: 0.6 },

  lane: { marginBottom: 4 },
  laneTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  laneName: { flex: 1, fontSize: 10, fontWeight: '700', color: theme.colors.charcoal },
  coveragePill: { width: 8, height: 8, borderRadius: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  chip: {
    backgroundColor: '#EDE9FE', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 3, maxWidth: 100,
  },
  chipMine: { backgroundColor: theme.colors.wyldPurple },
  chipText: { fontSize: 10, fontWeight: '700', color: theme.colors.wyldPurpleDark },
  chipTextMine: { color: '#fff' },
  chipSwapSource: { backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: theme.colors.wyldPurple },
  chipSwapTarget: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#16a34a' },

  addChip: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.wyldPurple,
    alignItems: 'center', justifyContent: 'center',
  },
  addChipText: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 14 },

  detailGroupLabel: {
    fontSize: 9, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  detailRow: { backgroundColor: '#F5F3FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 1 },
  detailRowName: { fontSize: 10, fontWeight: '600', color: theme.colors.charcoal },
  detailRowTime: { fontSize: 9, color: theme.colors.textSecondary },

  absChip: {
    backgroundColor: '#FFE4E6', borderWidth: 1, borderColor: '#FDA4AF',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2,
  },
  absChipText: { fontSize: 9, fontWeight: '600', color: '#9F1239' },

  reqBadge: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  reqBadgeOk: { backgroundColor: '#dcfce7' },
  reqBadgeBad: { backgroundColor: '#fee2e2' },
  reqBadgeText: { fontSize: 9, fontWeight: '700', color: '#92400e' },
  availBtn: {
    alignSelf: 'flex-start', marginTop: 4, backgroundColor: theme.colors.wyldPurple,
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3,
  },
  availBtnText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Mobile stack
  mobileStack: { padding: 12, gap: 10 },
  mobileDay: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12 },
  mobileDayToday: { borderColor: theme.colors.wyldPurple, borderWidth: 2 },
  mobileDayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  mobileDayNum: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  mobileDayNumToday: { color: theme.colors.wyldPurple },
  mobileDayName: { color: theme.colors.textSecondary, fontSize: 13 },
  mobileLane: { paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 6 },
  mobileLaneName: { fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple, marginBottom: 4 },
  mobileRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: theme.colors.surface, marginBottom: 2,
  },
  mobileRowMine: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: theme.colors.wyldPurple },
  mobileRowName: { fontSize: 13, fontWeight: '600', color: theme.colors.charcoal, flex: 1 },
  mobileRowNameMine: { color: theme.colors.wyldPurple },
  mobileRowTime: { fontSize: 12, color: theme.colors.textSecondary },
  mobileRowTimeMine: { color: theme.colors.wyldPurple, fontWeight: '700' },
  mobileAddBtn: { paddingVertical: 6 },
  mobileAddBtnText: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 12 },

  // Day view
  dayWrap: { padding: 12, paddingBottom: 32 },
  todayBadge: { alignSelf: 'center', backgroundColor: theme.colors.wyldPurple, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  todayBadgeText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  dayCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dayCardName: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  dayCardCov: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },
  dayCardCovOk: { color: '#16a34a' },
  dayAddBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  dayAddBtnText: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 16 },
  dayEmpty: { color: theme.colors.textSecondary, fontSize: 13, fontStyle: 'italic' },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: theme.colors.surface, marginBottom: 4,
  },
  dayRowMine: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: theme.colors.wyldPurple },
  dayRowSwapSource: { backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: theme.colors.wyldPurple },
  dayRowSwapTarget: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#16a34a' },
  dayRowName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  dayRowNameMine: { color: theme.colors.wyldPurple },
  dayRowPos: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  dayRowTime: { fontSize: 13, fontWeight: '700', color: theme.colors.wyldPurple },
  dayRowHrs: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },

  absRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFE4E6', borderWidth: 1, borderColor: '#FDA4AF',
    borderRadius: 8, padding: 10, marginBottom: 6,
  },
  absRowName: { fontWeight: '700', color: '#9F1239' },
  absRowReason: { color: '#BE185D', fontSize: 12, marginTop: 2 },
  absEditBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#FCE7F3', borderWidth: 1, borderColor: '#FBCFE8' },
  absEditBtnText: { color: '#9F1239', fontWeight: '700', fontSize: 12 },
  absDelBtn: { color: theme.colors.danger, fontSize: 22, paddingHorizontal: 6 },

  dayAvailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  dayAvailText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  pickupBtn: { backgroundColor: theme.colors.wyldPurple, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  pickupBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14 },
  empty2: { color: theme.colors.textSecondary, fontSize: 14, paddingVertical: 16, textAlign: 'center' },

  // ─── Modal shared ───
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalOverlayWide: { justifyContent: 'center', alignItems: 'center' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '90%',
  },
  modalSheetWide: { width: 480, borderRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 6,
  },

  empSearch: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, marginBottom: 12,
    fontSize: 14, color: theme.colors.charcoal,
  },
  clearEmp: { marginBottom: 10 },
  clearEmpText: { color: theme.colors.danger, fontWeight: '700', fontSize: 13 },
  empItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  empItemActive: { backgroundColor: '#F5F3FF', paddingHorizontal: 8, borderRadius: 8 },
  empItemName: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  empItemPos: { color: theme.colors.textSecondary, fontSize: 11 },
  empItemCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.wyldPurple },

  overnightToggle: {
    marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center',
  },
  overnightToggleActive: { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.charcoal },
  overnightToggleText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  overnightToggleTextActive: { color: '#fff' },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.border },
  radioActive: { borderColor: theme.colors.wyldPurple, backgroundColor: theme.colors.wyldPurple },
  reasonText: { fontSize: 14, color: theme.colors.charcoal, flex: 1 },
  reasonTextActive: { fontWeight: '800', color: theme.colors.wyldPurple },
  absModalBtn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  absModalBtnText: { fontWeight: '800', fontSize: 14 },

  reqCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  reqName: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  reqLoc: { fontSize: 12, color: theme.colors.wyldPurple, fontWeight: '700', marginTop: 2 },
  reqWhen: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  reqNote: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  reqHint: { fontSize: 14, fontWeight: '800', color: theme.colors.wyldPurple, marginBottom: 12 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#fef3c7' },
  statusTagText: { fontWeight: '800', fontSize: 11, color: '#92400e', textTransform: 'capitalize' },

  noteInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: '#fff', marginBottom: 12, textAlignVertical: 'top', minHeight: 80,
  },
  submitBtn: {
    backgroundColor: theme.colors.wyldPurple, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
