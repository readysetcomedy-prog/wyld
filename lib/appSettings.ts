import { supabase } from './supabase';

export const DEFAULT_BASE_URL = 'https://wyldinc.app';

export async function fetchBaseUrl(): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('base_url')
    .eq('id', 1)
    .maybeSingle();
  return data?.base_url ?? DEFAULT_BASE_URL;
}

export function liveUrlForGym(
  baseUrl: string,
  gym: { slug: string | null; custom_domain: string | null },
): string | null {
  if (gym.custom_domain) return `https://${gym.custom_domain}`;
  if (!gym.slug) return null;
  return `${baseUrl.replace(/\/$/, '')}/g/${gym.slug}`;
}
