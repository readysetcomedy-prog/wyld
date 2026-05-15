import { rgba } from './colors';

export type PresetName = 'clean' | 'bold' | 'warm' | 'modern';
export type HeroVariant = 'split' | 'fullbleed';

export const PRESET_OPTIONS: { value: PresetName; label: string; blurb: string }[] = [
  { value: 'clean', label: 'Clean', blurb: 'Spacious, neutral, restrained' },
  { value: 'bold', label: 'Bold', blurb: 'High-contrast headlines, tinted sections' },
  { value: 'warm', label: 'Warm', blurb: 'Cream tones, softer corners' },
  { value: 'modern', label: 'Modern', blurb: 'Crisp edges, flat surfaces' },
];

export type PresetStyles = {
  card: {
    borderRadius: number;
    backgroundColor: string;
    borderWidth: number;
    borderColor: string;
    shadowOpacity: number;
    shadowRadius: number;
  };
  sectionTint: string; // background color for the "tinted" section block
  headline: {
    fontWeight: '700' | '800' | '900';
    textTransform: 'none' | 'uppercase';
    letterSpacing: number;
  };
  heroOverlay: number; // dark overlay alpha for fullbleed hero
};

export function getPresetStyles(preset: PresetName, primary: string): PresetStyles {
  switch (preset) {
    case 'bold':
      return {
        card: {
          borderRadius: 8,
          backgroundColor: '#fff',
          borderWidth: 0,
          borderColor: 'transparent',
          shadowOpacity: 0.14,
          shadowRadius: 24,
        },
        sectionTint: rgba(primary, 0.07),
        headline: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
        heroOverlay: 0.55,
      };
    case 'warm':
      return {
        card: {
          borderRadius: 18,
          backgroundColor: '#fffdf8',
          borderWidth: 1,
          borderColor: '#f1ead9',
          shadowOpacity: 0.06,
          shadowRadius: 14,
        },
        sectionTint: '#fdf6e8',
        headline: { fontWeight: '800', textTransform: 'none', letterSpacing: 0 },
        heroOverlay: 0.35,
      };
    case 'modern':
      return {
        card: {
          borderRadius: 4,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#0F172A',
          shadowOpacity: 0,
          shadowRadius: 0,
        },
        sectionTint: '#f8fafc',
        headline: { fontWeight: '700', textTransform: 'none', letterSpacing: -0.5 },
        heroOverlay: 0.3,
      };
    case 'clean':
    default:
      return {
        card: {
          borderRadius: 12,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        sectionTint: '#f8fafc',
        headline: { fontWeight: '800', textTransform: 'none', letterSpacing: 0 },
        heroOverlay: 0.4,
      };
  }
}
