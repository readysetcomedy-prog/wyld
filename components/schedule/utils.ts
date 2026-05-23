// Time and calendar math shared by every Schedule UI piece.

import { ScheduleShift } from './types';

export function formatTimeDisplay(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${mStr} ${period}`;
}

export function calcShiftHours(start: string, end: string, isNextDay: boolean): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (isNextDay) endMins += 24 * 60;
  else if (endMins <= startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

// Returns true if the end time clearly falls before/at the start time
// (and the user hasn't already flagged it as overnight).
export function detectNextDay(start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em <= sh * 60 + sm;
}

// Does the proposed shift overlap any existing one for this employee on this date?
export function hasConflict(
  shifts: ScheduleShift[],
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  isNextDay: boolean,
  excludeId?: string,
): boolean {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const newStart = sh * 60 + sm;
  let newEnd = eh * 60 + em;
  if (isNextDay) newEnd += 24 * 60;
  else if (newEnd <= newStart) newEnd += 24 * 60;

  return shifts.some((s) => {
    if (s.employee_id !== employeeId) return false;
    if (s.shift_date !== shiftDate) return false;
    if (excludeId && s.id === excludeId) return false;
    const [ash, asm] = s.start_time.split(':').map(Number);
    const [aeh, aem] = s.end_time.split(':').map(Number);
    const existStart = ash * 60 + asm;
    let existEnd = aeh * 60 + aem;
    if (s.is_next_day) existEnd += 24 * 60;
    else if (existEnd <= existStart) existEnd += 24 * 60;
    return newStart < existEnd && newEnd > existStart;
  });
}

// 5- or 6-row month grid starting on Sunday.
export function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days: Date[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  const last = new Date(year, month + 1, 0);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  let overflow = 1;
  while (days.length < 35) {
    days.push(new Date(year, month + 1, overflow++));
  }
  return days;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function calcCoverage(
  shifts: { start_time: string; end_time: string; is_next_day: boolean }[],
  requiredHours: number,
) {
  let totalHours = 0;
  for (const s of shifts) {
    totalHours += calcShiftHours(s.start_time, s.end_time, s.is_next_day);
  }
  const meetsRequired = requiredHours === 0 || totalHours >= requiredHours;
  return { totalHours, meetsRequired };
}
