import { Text, View } from 'react-native';
import { toDobString } from '../lib/dob';
import { colors, radius, space } from './theme';

/**
 * Web version (the web link). Uses the browser's own date picker, which on
 * an iPhone is the same scroll wheel as the app.
 */
export function DobPicker({ value, onChange }: { value: string; onChange: (dob: string) => void }) {
  return (
    <DateField
      value={value}
      onChange={onChange}
      label="Date of birth"
      placeholder="Select your date of birth"
      min="1900-01-01"
      max={toDobString(new Date())}
    />
  );
}

export function DateField({
  value, onChange, label = 'Date', placeholder = 'Select a date', min, max,
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border,
        justifyContent: 'center', minHeight: 50,
      }}
    >
      {!value && (
        <Text
          style={{ position: 'absolute', left: space.md, fontSize: 16, color: colors.muted }}
          pointerEvents="none"
        >
          {placeholder}
        </Text>
      )}
      <input
        type="date"
        aria-label={label}
        value={value}
        max={max}
        min={min}
        onChange={(e) => onChange(e.currentTarget.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: value ? colors.text : 'transparent',
          colorScheme: 'dark',
          fontSize: 16,
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          padding: `14px ${space.md}px`,
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 50,
        }}
      />
    </View>
  );
}
