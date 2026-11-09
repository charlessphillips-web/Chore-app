import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDob, parseDob, toDobString } from '../lib/dob';
import { colors, radius, space } from './theme';
import { Button, Icon } from './ui';

interface DateFieldProps {
  value: string;
  onChange: (date: string) => void;
  /** Read out by screen readers. */
  label?: string;
  placeholder?: string;
  /** "YYYY-MM-DD" limits. */
  min?: string;
  max?: string;
}

/** Date of birth as a scroll wheel (iPhone) or calendar pop-up (Android). */
export function DobPicker({ value, onChange }: { value: string; onChange: (dob: string) => void }) {
  const today = new Date();
  return (
    <DateField
      value={value}
      onChange={onChange}
      label="Date of birth"
      placeholder="Select your date of birth"
      min={toDobString(new Date(today.getFullYear() - 100, 0, 1))}
      max={toDobString(today)}
    />
  );
}

/** Any date, as a scroll wheel (iPhone) or calendar pop-up (Android). Value is "YYYY-MM-DD". */
export function DateField({ value, onChange, label = 'Date', placeholder = 'Select a date', min, max }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const minDate = min ? parseDob(min) ?? undefined : undefined;
  const maxDate = max ? parseDob(max) ?? undefined : undefined;
  const current = parseDob(value) ?? (label === 'Date of birth' ? new Date(2005, 0, 1) : maxDate && maxDate < new Date() ? maxDate : new Date());

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.card, borderRadius: radius, borderWidth: 1,
          borderColor: open ? colors.primaryBright : colors.border, paddingHorizontal: space.md, paddingVertical: 14,
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.muted }}>
          {value ? formatDob(value) : placeholder}
        </Text>
        <Icon name="calendar-outline" color={colors.muted} />
      </Pressable>
      {open && (
        <>
          <DateTimePicker
            value={current}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            maximumDate={maxDate}
            minimumDate={minDate}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setOpen(false);
              if (event.type === 'set' && date) onChange(toDobString(date));
            }}
          />
          {Platform.OS === 'ios' && (
            <Button
              title="Done"
              variant="secondary"
              onPress={() => {
                if (!value) onChange(toDobString(current));
                setOpen(false);
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
