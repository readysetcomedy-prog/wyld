// Global overlay for the demo-accounts dev tool. Renders nothing on native.
// Two pieces:
//   1. A draggable "D" badge — visible when the user is demo-authorized AND
//      has the toggle on, OR when a stashed original session exists.
//   2. A "Return to my account" banner — visible whenever a stashed session
//      exists, so the founder can pop back from any demo without having to
//      sign in again. Failure surfaces inline; on success we leave it where
//      it is (refreshSession swapped the auth state).

import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  useDemoModeOn,
  useDemoAuthorized,
  useStashedSession,
  getBadgePos,
  setBadgePos,
  returnToSelf,
} from '@/lib/demoMode';
import { theme } from '@/lib/theme';

const BADGE_SIZE = 48;

export function DemoOverlay() {
  if (Platform.OS !== 'web') return null;
  return <DemoOverlayWeb />;
}

function DemoOverlayWeb() {
  const { profile } = useAuth();
  const router = useRouter();
  const [on] = useDemoModeOn();
  const authorized = useDemoAuthorized(profile?.id);
  const stash = useStashedSession();

  // Position: default to bottom-right with a safe inset.
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 24, y: 24 };
    const saved = getBadgePos();
    if (saved) return saved;
    return {
      x: Math.max(16, window.innerWidth - BADGE_SIZE - 24),
      y: Math.max(16, window.innerHeight - BADGE_SIZE - 24),
    };
  });

  const dragRef = useRef<{
    startMouseX: number; startMouseY: number;
    startPosX: number; startPosY: number;
    moved: boolean;
  } | null>(null);

  function clampToViewport(p: { x: number; y: number }) {
    if (typeof window === 'undefined') return p;
    return {
      x: Math.max(8, Math.min(window.innerWidth - BADGE_SIZE - 8, p.x)),
      y: Math.max(8, Math.min(window.innerHeight - BADGE_SIZE - 8, p.y)),
    };
  }

  function onMouseDown(e: any) {
    dragRef.current = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startPosX: pos.x, startPosY: pos.y,
      moved: false,
    };
    const move = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startMouseX;
      const dy = ev.clientY - d.startMouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      const next = clampToViewport({ x: d.startPosX + dx, y: d.startPosY + dy });
      setPos(next);
    };
    const up = (ev: MouseEvent) => {
      const d = dragRef.current;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (d && d.moved) {
        const dx = ev.clientX - d.startMouseX;
        const dy = ev.clientY - d.startMouseY;
        const final = clampToViewport({ x: d.startPosX + dx, y: d.startPosY + dy });
        setBadgePos(final);
      } else if (d && !d.moved) {
        // Treat as a click.
        router.push('/demo-switch' as never);
      }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // Keep badge inside viewport on resize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showBadge =
    !!profile && (((authorized === true) && on) || !!stash);
  const showBanner = !!stash;
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  async function onReturn() {
    setBannerErr(null);
    setReturning(true);
    try {
      await returnToSelf();
      // refreshSession() already replaced the auth state in the global
      // client; force a reload so every consumer (AuthProvider listener,
      // any cached queries) sees the restored admin session.
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
      else router.replace('/dashboard' as never);
    } catch (e: any) {
      setReturning(false);
      setBannerErr(e?.message ?? 'Could not restore your account session.');
    }
  }

  return (
    <>
      {showBanner ? (
        <View style={styles.banner} pointerEvents="box-none">
          <View style={styles.bannerInner}>
            <Text style={styles.bannerText}>
              Signed in as a demo account
              {stash?.email ? <Text style={styles.bannerEmail}> — your account: {stash.email}</Text> : null}
            </Text>
            <Pressable
              style={[styles.bannerBtn, returning && { opacity: 0.6 }]}
              disabled={returning}
              onPress={onReturn}
            >
              <Text style={styles.bannerBtnText}>
                {returning ? 'Returning…' : 'Return to my account'}
              </Text>
            </Pressable>
          </View>
          {bannerErr ? (
            <View style={styles.bannerError}>
              <Text style={styles.bannerErrorText}>{bannerErr}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showBadge ? (
        <View
          // @ts-expect-error — react-native-web accepts DOM event handlers
          onMouseDown={onMouseDown}
          style={[styles.badge, { left: pos.x, top: pos.y }]}
        >
          <Text style={styles.badgeText}>D</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'fixed' as any,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: theme.colors.wyldPurple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 9999,
    // @ts-expect-error — web-only cursor
    cursor: 'grab',
    userSelect: 'none' as any,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 22 },

  banner: {
    position: 'fixed' as any,
    left: 0, right: 0, top: 0,
    zIndex: 9998,
    alignItems: 'center',
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxWidth: '100%',
    flexWrap: 'wrap',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bannerText: { color: '#1f2937', fontWeight: '700', fontSize: 13 },
  bannerEmail: { fontWeight: '500' },
  bannerBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bannerError: {
    marginTop: 4,
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bannerErrorText: { color: '#fee2e2', fontSize: 12, fontWeight: '600' },
});
