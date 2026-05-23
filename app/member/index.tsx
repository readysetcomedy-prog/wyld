// "My gyms" lives under Profile now. The top-level /member entry just
// redirects there so existing bookmarks / nav state don't 404.

import { Redirect } from 'expo-router';

export default function MemberIndex() {
  return <Redirect href="/member/profile" />;
}
