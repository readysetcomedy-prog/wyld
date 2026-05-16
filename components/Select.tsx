import { Platform } from 'react-native';

export type SelectOption = { value: string; label: string };

const baseStyle: any = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 14,
  fontWeight: 600,
  background: '#fff',
  color: '#0F172A',
  fontFamily: 'inherit',
  cursor: 'pointer',
  maxWidth: '100%',
};

// A native <select>. Renders only on web (owner/admin dashboards are
// web-first, like the date inputs). Browsers give selects type-ahead,
// and they never overflow the screen the way a bubble row does.
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  if (Platform.OS !== 'web') return null;
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      style={{ ...baseStyle, ...(fullWidth ? { width: '100%' } : null) }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
