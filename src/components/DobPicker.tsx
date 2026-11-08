import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDob, parseDob, toDobString } from '../lib/dob';
import { colors, radius, space } from './theme';
import { Button, Icon } from './ui';

/** Date of birth as a scroll wheel (iPhone) or calendar pop-up (Android). */
export function DobPicker({ value, onChange }: { value: string; onChange: (dob: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = parseDob(value) ?? new Date(2005, 0, 1);
  const today = new Date();

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date of birth"
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.card, borderRadius: radius, borderWidth: 1,
          borderColor: open ? colors.primaryBright : colors.border, paddingHorizontal: space.md, paddingVertical: 14,
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.muted }}>
          {value ? formatDob(value) : 'Select your date of birth'}
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
            maximumDate={today}
            minimumDate={new Date(today.getFullYear() - 100, 0, 1)}
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
