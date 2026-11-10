import { Text, View } from 'react-native';
import { checkProgress, effectiveStatus } from '../lib/review';
import type { ChoreLog } from '../lib/types';
import { colors } from './theme';

const BADGE = {
  pending: { label: 'Waiting for a check', color: colors.warning },
  verified: { label: 'Verified', color: colors.success },
  auto_verified: { label: 'Auto-verified', color: colors.success },
  rejected: { label: 'Sent back', color: colors.danger },
} as const;

export function StatusBadge({ log }: { log: Pick<ChoreLog, 'status' | 'at' | 'reviewedByName' | 'rejectReason' | 'checks' | 'checksNeeded'> }) {
  const s = effectiveStatus(log);
  const b = BADGE[s];
  const p = checkProgress(log);
  const progress = s === 'pending' && p.needed > 1 ? ` · ${p.done} of ${p.needed}` : '';
  const by = (s === 'verified' || s === 'rejected') && log.reviewedByName ? ` by ${log.reviewedByName}` : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: b.color }} />
      <Text style={{ color: b.color, fontSize: 13, fontWeight: '600' }}>
        {b.label}{progress}{by}{s === 'rejected' ? ` — ${log.rejectReason ?? 'not counted'}` : ''}
      </Text>
    </View>
  );
}
