// Per-gym dashboard colors, supplied at the layout level (OwnerLayout,
// /m/[gymId]/_layout, /admin/_layout) and consumed by inner pages so they
// can brand their CTAs, sub-tabs, and accents in the gym's chosen colors
// rather than the default WyLD purple.
//
// Owners pick the dashboard colors in /owner/settings. The website's
// primary/accent are separate columns; if dashboard colors aren't set,
// callers should fall back to the website values (handled by the
// provider).

import { createContext, useContext, ReactNode } from 'react';
import { theme } from './theme';

export type GymThemeValue = {
  primary: string;
  accent: string;
  // Subtle tint of the primary color used as the inner-page background
  // so the dashboard feels "in the gym" without overwhelming content.
  contentTint: string;
};

const GymThemeContext = createContext<GymThemeValue | null>(null);

export function GymThemeProvider({
  value,
  children,
}: {
  value: GymThemeValue;
  children: ReactNode;
}) {
  return <GymThemeContext.Provider value={value}>{children}</GymThemeContext.Provider>;
}

// Inside a branded layout, returns that layout's colors. Outside, returns
// WyLD defaults so unprovided pages still render correctly.
export function useGymTheme(): GymThemeValue {
  return useContext(GymThemeContext) ?? {
    primary: theme.colors.wyldPurple,
    accent: theme.colors.tealDark,
    contentTint: theme.colors.background,
  };
}

// Mix a hex color with white to get a very faint tint. `amount` is 0..1
// — 0 returns white, 1 returns the original color. Used to derive the
// content-area background from a gym's primary color.
export function tintWithWhite(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, '0')}`;
}
