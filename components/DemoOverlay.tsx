// Global overlay for the demo-accounts dev tool. Renders nothing on native.
// Just a draggable "D" badge — visible when the user is demo-authorized AND
// has the toggle on, OR when a stashed original session exists so a demo
// session can still get back to the switcher. Returning to the real
// account lives on /demo-switch (the button on that page); no overlay
// banner — explicit request from the user, it was in the way.

import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  useDemoModeOn,
  useDemoAuthorized,
  useStashedSession,
  getBadgePos,
  setBadgePos,
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

  return (
    <>
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
});
