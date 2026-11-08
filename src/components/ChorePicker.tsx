import { PRESET_CHORES, choreKey } from '../lib/chores';
import { Chip, ChipRow, Input, Label } from './ui';

/** Pick a common chore, or type your own. */
export function ChorePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selectedKey = choreKey(value);
  return (
    <>
      <Label>Which chore?</Label>
      <ChipRow>
        {PRESET_CHORES.map((c) => (
          <Chip key={c} label={c} selected={choreKey(c) === selectedKey} onPress={() => onChange(c)} />
        ))}
      </ChipRow>
      <Input value={value} onChangeText={onChange} placeholder="…or type another chore" maxLength={40} />
    </>
  );
}
