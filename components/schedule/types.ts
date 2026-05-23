// Shared types for the Schedule feature. Mirrors the EMS app's shape but
// uses our locations / gym_employees / positions instead of baskets / EMTs.

export type Location = {
  id: string;
  gym_id: string;
  label: string;
  sched_required_hours: number;
  sched_visible_until_date: string | null;
};

export type EmployeeOption = {
  id: string;            // gym_employees.id
  user_id: string | null;
  full_name: string;
  position: string | null;
};

export type ScheduleShift = {
  id: string;
  gym_id: string;
  location_id: string;
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  is_next_day: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftPickupRequest = {
  id: string;
  gym_id: string;
  location_id: string;
  employee_id: string;
  shift_date: string;
  requested_start_time: string;
  requested_end_time: string;
  is_next_day: boolean;
  notes: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ShiftAbsence = {
  id: string;
  gym_id: string;
  location_id: string;
  employee_id: string;
  shift_date: string;
  reason: string;
  created_by: string | null;
  created_at: string;
};

export type ViewMode = 'month' | 'day';

export type DeleteReason =
  | 'Error in Entry'
  | 'Sick'
  | 'Bereavement'
  | 'Permitted'
  | 'Unexcused'
  | 'No Call/Show';

export const DELETE_REASONS: DeleteReason[] = [
  'Error in Entry',
  'Sick',
  'Bereavement',
  'Permitted',
  'Unexcused',
  'No Call/Show',
];
