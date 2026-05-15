import { createContext, ReactNode, useContext } from 'react';
import { View, ViewStyle } from 'react-native';
import { useGymSite } from '@/components/GymSiteContext';
import { getPresetStyles } from '@/lib/stylePresets';

export type BlockWidth = 'narrow' | 'wide' | 'full';
export type BlockAlign = 'left' | 'center';
export type BlockStyle = {
  box?: boolean;
  tint?: boolean;
  stripe?: boolean;
  width?: BlockWidth;
  align?: BlockAlign;
};

const WIDTHS: Record<BlockWidth, number | undefined> = {
  narrow: 520,
  wide: 820,
  full: undefined,
};

const AlignContext = createContext<BlockAlign>('left');
export const useBlockAlign = () => useContext(AlignContext);

export function StyledBlock({
  style: bs = {},
  defaults = {},
  children,
}: {
  style?: BlockStyle;
  defaults?: BlockStyle;
  children: ReactNode;
}) {
  const site = useGymSite();
  const preset = getPresetStyles(site.theme.style_preset, site.theme.primary_color);
  const s: Required<BlockStyle> = {
    box: false,
    tint: false,
    stripe: false,
    width: 'wide',
    align: 'left',
    ...defaults,
    ...bs,
  };

  const decorated = s.box || s.tint || s.stripe;
  const containerStyle: ViewStyle = {
    width: '100%',
    maxWidth: WIDTHS[s.width],
    alignSelf: s.align === 'center' ? 'center' : 'stretch',
    paddingVertical: decorated ? 20 : 0,
    paddingHorizontal: decorated ? 24 : 0,
    gap: 12,
  };

  if (s.box) {
    Object.assign(containerStyle, {
      backgroundColor: preset.card.backgroundColor,
      borderRadius: preset.card.borderRadius,
      borderWidth: preset.card.borderWidth,
      borderColor: preset.card.borderColor,
      shadowColor: '#0f172a',
      shadowOpacity: preset.card.shadowOpacity,
      shadowRadius: preset.card.shadowRadius,
      shadowOffset: { width: 0, height: 4 },
    });
  }
  if (s.tint) {
    containerStyle.backgroundColor = preset.sectionTint;
    if (!s.box) containerStyle.borderRadius = preset.card.borderRadius;
  }
  if (s.stripe) {
    containerStyle.borderLeftWidth = 4;
    containerStyle.borderLeftColor = site.theme.primary_color;
  }

  return (
    <AlignContext.Provider value={s.align}>
      <View style={containerStyle}>{children}</View>
    </AlignContext.Provider>
  );
}
