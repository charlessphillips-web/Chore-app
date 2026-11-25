/**
 * Sends push notifications from this phone (until the Rotawise server is
 * switched on: functions/, which needs Firebase's Blaze plan). Uses the same
 * wording and sizes as the server will (pushMessages.ts).
 */
import { toExpo, type PushMessage } from './pushMessages';
import { wants } from './notifyPrefs';
import type { Member } from './types';

export interface Send { to: string[]; msg: PushMessage }

export async function sendNotifications(members: Member[], sends: Send[]): Promise<boolean> {
  const byUid = new Map(members.map((m) => [m.uid, m]));
  const msgs = sends.flatMap((s) => [...new Set(s.to)].flatMap((u) => {
    const m = byUid.get(u);
    return m?.pushToken && wants(m.notifPrefs, s.msg.kind) ? [toExpo(s.msg, m.pushToken)] : [];
  }));
  if (!msgs.length) return false;
  try {
    let ok = false;
    for (let i = 0; i < msgs.length; i += 100) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(msgs.slice(i, i + 100)),
      });
      const json = await res.json();
      ok = ok || (res.ok && Array.isArray(json?.data) && json.data.some((r: { status?: string }) => r.status === 'ok'));
    }
    return ok;
  } catch {
    return false;
  }
}

/** Fire and forget: a notification failing never stops the action. */
export const notifyQuietly = (members: Member[], sends: Send[]) => { sendNotifications(members, sends).catch(() => {}); };
