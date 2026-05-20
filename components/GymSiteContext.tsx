import { createContext, useContext, ReactNode } from 'react';

export type GymSiteLocation = {
  id: string;
  label: string | null;
  slug: string | null;
  is_primary: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type GymSite = {
  gym: {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  };
  // Locations the gym has set up. Empty array if none.
  locations: GymSiteLocation[];
  // The location the visitor is currently viewing (or null on the
  // pick-a-location landing). For single-location gyms this is the
  // primary location if one exists.
  currentLocation: GymSiteLocation | null;
  // True when admin granted multi_location for this gym.
  multiLocationEnabled: boolean;
  theme: {
    primary_color: string;
    accent_color: string;
    logo_url: string | null;
    style_preset: 'clean' | 'bold' | 'warm' | 'modern';
    hero_variant: 'split' | 'fullbleed';
    section_dividers: boolean;
  };
  modules: {
    calendar_enabled: boolean;
    store_enabled: boolean;
    news_enabled: boolean;
    faq_enabled: boolean;
    bookings_enabled: boolean;
    about_enabled: boolean;
    services_enabled: boolean;
    contact_enabled: boolean;
    news_visible: boolean;
    faq_visible: boolean;
    store_visible: boolean;
    applications_enabled: boolean;
  };
  settings: {
    contact_email: string | null;
    contact_phone: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    hours: Record<string, string> | null;
    social_instagram: string | null;
    social_facebook: string | null;
    social_x: string | null;
    social_tiktok: string | null;
  };
  pages: Record<string, any>;
};

const Ctx = createContext<GymSite | null>(null);

export function GymSiteProvider({ value, children }: { value: GymSite; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGymSite() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGymSite must be used inside GymSiteProvider');
  return v;
}
