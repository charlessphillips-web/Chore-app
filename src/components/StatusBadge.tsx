import { Text, View } from 'react-native';
import { effectiveStatus } from '../lib/review';
import type { ChoreLog } from '../lib/types';
import { colors } from './theme';

const BADGE = {
  pending: { label: 'Waiting for a check', color: colors.warning },
  verified: { label: 'Verified', color: colors.success },
  auto_verified: { label: 'Auto-verified', color: colors.success },
  rejected: { label: 'Rejected', color: colors.danger },
} as const;

export function StatusBadge({ log }: { log: Pick<ChoreLog, 'status' | 'at' | 'reviewedByName'> }) {
  const s = effectiveStatus(log);
  const b = BADGE[s];
  const by = (s === 'verified' || s === 'rejected') && log.reviewedByName ? ` by ${log.reviewedByName}` : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: b.color }} />
      <Text style={{ color: b.color, fontSize: 13, fontWeight: '600' }}>
        {b.label}{by}{s === 'rejected' ? ' — not counted' : ''}
      </Text>
    </View>
  );
}
