// Per-browser state for the WyLD demo-accounts dev tool: the on/off toggle,
// the draggable D-badge position, the stashed "real" session that lets us
// pop back from a demo account to our original one, and an authorization
// check (admin or perm_demo on the WyLD roster). Web-only by design — the
// dev tool isn't surfaced on native.

import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const KEY_ON = 'wyld_demo_mode_on';
const KEY_POS = 'wyld_demo_badge_pos';
const KEY_STASH = 'wyld_demo_original_session';
const TOGGLE_EVENT = 'wyld:demo-mode-change';
const STASH_EVENT = 'wyld:demo-stash-change';

function isWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function emit(name: string) {
  if (!isWeb()) return;
  window.dispatchEvent(new CustomEvent(name));
}

// ---- Toggle ------------------------------------------------------------
export function getDemoModeOn(): boolean {
  if (!isWeb()) return false;
  try {
    return window.localStorage.getItem(KEY_ON) === '1';
  } catch {
    return false;
  }
}

export function setDemoModeOn(on: boolean) {
  if (!isWeb()) return;
  try {
    window.localStorage.setItem(KEY_ON, on ? '1' : '0');
    emit(TOGGLE_EVENT);
  } catch {}
}

export function useDemoModeOn(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => getDemoModeOn());
  useEffect(() => {
    if (!isWeb()) return;
    const handler = () => setOn(getDemoModeOn());
    window.addEventListener(TOGGLE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return [on, (v) => { setDemoModeOn(v); setOn(v); }];
}

// ---- Badge position ---------------------------------------------------
export type BadgePos = { x: number; y: number };

export function getBadgePos(): BadgePos | null {
  if (!isWeb()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_POS);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.x === 'number' && typeof v?.y === 'number') return v;
  } catch {}
  return null;
}

export function setBadgePos(p: BadgePos) {
  if (!isWeb()) return;
  try {
    window.localStorage.setItem(KEY_POS, JSON.stringify(p));
  } catch {}
}

// ---- Original-session stash (return-to-self) --------------------------
type StashedSession = { access_token: string; refresh_token: string; email: string | null };

export function getStashedSession(): StashedSession | null {
  if (!isWeb()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_STASH);
    return raw ? (JSON.parse(raw) as StashedSession) : null;
  } catch {
    return null;
  }
}

export function setStashedSession(s: StashedSession | null) {
  if (!isWeb()) return;
  try {
    if (s) window.localStorage.setItem(KEY_STASH, JSON.stringify(s));
    else window.localStorage.removeItem(KEY_STASH);
    emit(STASH_EVENT);
  } catch {}
}

export function useStashedSession(): StashedSession | null {
  const [s, setS] = useState<StashedSession | null>(() => getStashedSession());
  useEffect(() => {
    if (!isWeb()) return;
    const handler = () => setS(getStashedSession());
    window.addEventListener(STASH_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(STASH_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return s;
}

// Stash the *current* session, then sign in as the demo email.
//
// CRITICAL: refresh the admin's session FIRST so the tokens we stash are
// freshly minted. The SDK auto-refreshes the access_token periodically,
// which rotates the refresh_token; if we stashed an older refresh_token
// it'd already be in the rotation/reuse-detection window by the time
// the user clicked Return, producing the 400 invalid_grant we were
// hitting in production.
//
// We deliberately don't call signOut() before signInWithPassword:
// signInWithPassword replaces the local session by itself, and any
// server-side side effects of signOut have caused trouble in the past.
export async function switchToDemo(email: string): Promise<void> {
  const existing = getStashedSession();
  if (!existing) {
    // Force a refresh to get the freshest possible refresh_token before
    // we hand control to the demo session.
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    const current = refreshed?.session ?? (await supabase.auth.getSession()).data.session;
    if (refreshErr) {
      // Non-fatal — we'll fall back to whatever getSession() returns,
      // which is still better than nothing.
      // eslint-disable-next-line no-console
      console.warn('[demoMode] refresh before stash failed:', refreshErr.message);
    }
    if (current) {
      setStashedSession({
        access_token: current.access_token,
        refresh_token: current.refresh_token,
        email: current.user?.email ?? null,
      });
    }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: 'demo' });
  if (error) throw error;
}

// Restore the previously stashed admin session.
//
// Uses refreshSession() with the stashed refresh_token to mint a fresh
// session. Because switchToDemo refreshed *before* stashing, this
// refresh_token has never been used — it should be accepted by the
// Supabase auth server.
//
// Safety net for failures: when refreshSession is called with a bad
// token, the SDK clears the current session as a side effect — which
// would dump the user out of their demo session and bounce them to
// /sign-in via the auth guard. We capture the current demo session
// FIRST and setSession() back to it on failure so the user stays
// where they are and sees the error inline, instead of being silently
// kicked.
export async function returnToSelf(): Promise<void> {
  const stash = getStashedSession();
  if (!stash) throw new Error('No stashed session to restore');

  // Snapshot the current (demo) session so we can roll back if the
  // refresh fails.
  const { data: currentData } = await supabase.auth.getSession();
  const currentSession = currentData.session;

  const { error } = await supabase.auth.refreshSession({
    refresh_token: stash.refresh_token,
  });
  if (error) {
    if (currentSession) {
      // Best-effort restore so the demo session keeps working.
      await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });
    }
    throw error;
  }
  setStashedSession(null);
}

// ---- Authorization check (cached per-session) -------------------------
// True if the *currently signed in* user is admin or has perm_demo on the
// WyLD employee roster. Returns null while loading.
export function useDemoAuthorized(userId: string | null | undefined): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setOk(false);
      return;
    }
    setOk(null);
    supabase.rpc('is_demo_authorized').then(({ data, error }) => {
      if (cancelled) return;
      setOk(!error && data === true);
    });
    return () => { cancelled = true; };
  }, [userId]);
  return ok;
}

// ---- 50 realistic demo names (stable order) ----------------------------
export const DEMO_NAMES: string[] = [
  'Alice Johnson', 'Bob Smith', 'Carlos Rivera', 'Dana Lee', 'Ethan Park',
  'Fiona Walsh', 'Grace Kim', 'Henry Adams', 'Ivy Chen', 'Jack Murphy',
  'Kara Patel', 'Liam Brooks', 'Maya Rodriguez', 'Noah Hughes', 'Olivia Reyes',
  'Paul Nguyen', 'Quinn Foster', 'Rachel Wong', 'Sam Carter', 'Tina Khan',
  'Uma Sharma', 'Victor Diaz', 'Wendy Lin', 'Xander Cole', 'Yara Ahmed',
  'Zoe Mitchell', 'Aaron Bell', 'Bianca Ortiz', 'Caleb Stone', 'Diana Pham',
  'Elliot Vance', 'Faith Romero', 'Gabriel Yu', 'Hannah Wood', 'Isaac Hart',
  'Jenna Brooks', 'Kyle Mason', 'Lana Singh', 'Mason Reed', 'Nora Jensen',
  'Owen Frye', 'Piper Cole', 'Quincy Wright', 'Ruby Tran', 'Silas Berg',
  'Tara Hill', 'Uri Stein', 'Vera Black', 'Wes Greene', 'Yusuf Aziz',
];

export function emailForName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()
      .replace(/\s+/g, '.') + '@demo.com'
  );
}
