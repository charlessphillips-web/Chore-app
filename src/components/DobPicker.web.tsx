import { useState } from 'react';
import { parseDob, toDobString } from '../lib/dob';
import { Input } from './ui';

/** Web version (used for testing in a browser): type DD/MM/YYYY. */
export function DobPicker({ value, onChange }: { value: string; onChange: (dob: string) => void }) {
  const initial = parseDob(value);
  const [text, setText] = useState(
    initial ? `${String(initial.getDate()).padStart(2, '0')}/${String(initial.getMonth() + 1).padStart(2, '0')}/${initial.getFullYear()}` : '',
  );
  return (
    <Input
      accessibilityLabel="Date of birth"
      value={text}
      placeholder="DD/MM/YYYY"
      maxLength={10}
      onChangeText={(t) => {
        setText(t);
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t.trim());
        const d = m ? parseDob(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : null;
        onChange(d ? toDobString(d) : '');
      }}
    />
  );
}
