// Sidebar shortcut — owners click "Schedule" in the sidebar, this redirects
// them to the full-screen /schedule/[gymId] page so the calendar grid has
// the whole viewport rather than the padded owner content area.

import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function OwnerScheduleRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile?.gym_id) return <Redirect href="/owner" />;
  return <Redirect href={`/schedule/${profile.gym_id}` as never} />;
}
