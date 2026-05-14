import { createContext, useContext, ReactNode } from 'react';

export type GymSite = {
  gym: {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  };
  theme: {
    primary_color: string;
    accent_color: string;
    logo_url: string | null;
  };
  modules: {
    calendar_enabled: boolean;
    store_enabled: boolean;
    news_enabled: boolean;
    faq_enabled: boolean;
    bookings_enabled: boolean;
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
