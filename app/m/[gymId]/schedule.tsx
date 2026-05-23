// The Schedule view is a full-screen page (it needs its own viewport for
// the calendar grid). Inside the per-gym dashboard, this tab just hands
// the user off to the top-level /schedule/[gymId] route — passing ?back=
// so the Schedule's Back button returns to this gym's dashboard, not to
// the user's personal profile.

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MemberGymScheduleRedirect() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const back = encodeURIComponent(`/m/${gymId}`);
  return <Redirect href={`/schedule/${gymId}?back=${back}` as never} />;
}
