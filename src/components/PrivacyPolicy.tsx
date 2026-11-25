import { Text, View } from 'react-native';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, PRIVACY_VERSION } from '../lib/legal';
import { Label } from './ui';
import { colors, space, type } from './theme';

const contact = CONTACT_EMAIL ? `email ${CONTACT_EMAIL}` : 'use Settings → Report a bug';

const ROWS: [string, string, string][] = [
  ['Username and profile picture', 'So housemates know who did what', 'Your housemates'],
  ['Email and password', 'Your login: so you can sign in on another phone and reset your password. Passwords are stored securely by Google Firebase, and we can never see them', 'Nobody, not even your housemates'],
  ['Sign in with Apple or Google', 'An easier login. We only get your email (with Apple this can be a private "hide my email" address). We never see your Apple or Google password', 'Nobody, not even your housemates'],
  ['Date of birth, gender, student or not, university', 'Anonymous statistics about who uses the app', 'Only the app owner. Never your housemates'],
  ['House name and area (e.g. "LS6 · Leeds")', 'Statistics on where the app is used. We never store your full postcode or address', 'Your housemates; the area only by the app owner'],
  ['Chores you log: the photo, an optional "before" photo and an optional one-line note', 'So housemates can check chores were done. The full-size photo is deleted once it\'s been checked; a small thumbnail stays in the house history', 'Your housemates'],
  ['Reactions (e.g. 👏) and streaks', 'The house feed and weekly streaks', 'Your housemates'],
  ['Away dates (e.g. "away 12–19 Dec")', 'So you aren\'t given chores while you\'re away and scores stay fair. Only the dates, never where you went', 'Your housemates'],
  ['Chores you flag, checks and send-backs', 'To ask the right housemate and keep scores fair', 'Your housemates'],
  ['Chore offers, prices and how you asked to be paid (a Monzo/PayPal link, or cash)', 'So housemates can pay each other. The app never handles money', 'The housemates in that deal'],
  ['Push notification token (a code that lets notifications reach your phone)', 'To send you notifications. It\'s kept separately and only the Rotawise server can use it', 'Nobody, not even your housemates'],
  ['Bug reports and suggestions (with any screenshot), phone model, app version', 'To fix problems and improve the app', 'Only the app owner'],
  ['When you last opened the app', 'Statistics on how many people use the app', 'Only the app owner'],
  ['Anonymous usage counts (e.g. "12 chores logged today")', 'To see which features are used and improve the app. Not linked to you', 'Only the app owner'],
];

function P({ children }: { children: React.ReactNode }) {
  return <Text style={[type.body, { color: colors.muted, lineHeight: 23 }]}>{children}</Text>;
}

/** The privacy policy text. Shown at sign-up, in Settings, and at /privacy on the web. */
export function PrivacyPolicy() {
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.small}>Last updated {new Date(PRIVACY_VERSION).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <P>
        {APP_NAME} helps people who share a house split chores fairly. This explains what we collect, why, and what
        control you have.{OWNER_NAME ? ` ${APP_NAME} is run by ${OWNER_NAME}, United Kingdom.` : ''} Questions? {contact[0].toUpperCase() + contact.slice(1)}.
      </P>

      <Label>What we collect</Label>
      {ROWS.map(([what, why, who]) => (
        <View key={what} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 4 }}>
          <Text style={[type.body, { fontWeight: '600' }]}>{what}</Text>
          <Text style={type.small}>Why: {why}</Text>
          <Text style={type.small}>Who sees it: {who}</Text>
        </View>
      ))}
      <P>
        We don&apos;t collect your real name, phone number, contacts or exact location.
      </P>

      <Label>Kept only on your phone</Label>
      <P>
        If you turn on &quot;Ask me if I&apos;m away&quot;, your phone remembers where home is so it can ask you in the evening
        if you&apos;ve gone away. That location never leaves your phone: we never receive it, and nor do your housemates.
        Turn it off any time in Settings → Away. Your light/dark mode, app icon and celebration settings are also stored
        only on your phone.
      </P>

      <Label>Why we&apos;re allowed to use it</Label>
      <P>• To run the app you asked for (your login, house, chores, photos, notes, reactions, away dates, payments between housemates): this is needed to provide the service (contract).</P>
      <P>• Age, gender, university and area statistics, and anonymous usage counts: our legitimate interest in understanding who uses {APP_NAME} and improving it. You can choose &quot;Prefer not to say&quot; for gender.</P>
      <P>• Notifications: only if you allow them on your phone, and you can turn each type off in Settings → Notifications.</P>

      <Label>Where it&apos;s stored</Label>
      <P>
        On Google Firebase (Google Cloud), encrypted in transit and at rest. Only members of your house can read your
        house&apos;s data. Google may store it outside the UK, under its standard data protection terms. Notifications are
        sent through Expo&apos;s push service (and Apple/Google&apos;s). Sign in with Apple/Google is handled by Apple and Google.
        Postcodes are looked up with postcodes.io. We keep backups of the database for up to 7 days, to recover from
        accidents.
      </P>

      <Label>How long we keep it</Label>
      <P>• Your profile and chores: while you use the app.</P>
      <P>• Leave a house: your membership and scores there are removed. Chores you logged stay in the house&apos;s history.</P>
      <P>• Delete your account (Settings → Delete my account): your profile is deleted straight away, and drops out of backups within 7 days.</P>
      <P>• Bug reports and suggestions: until dealt with, and no more than 12 months.</P>

      <Label>Your rights (UK GDPR)</Label>
      <P>
        You can see, correct or delete your information at any time. Edit your details in Settings → Personal details,
        delete everything in Settings → Delete my account, or {contact} for anything else.
      </P>

      <Label>Age</Label>
      <P>You must be 13 or over to use {APP_NAME}.</P>

      <Label>If something goes wrong</Label>
      <P>If your information is ever exposed in a way that puts you at risk, we&apos;ll tell you and, where required, the Information Commissioner&apos;s Office (ICO) within 72 hours. You can also complain to the ICO at ico.org.uk.</P>

      <Label>Changes</Label>
      <P>If this policy changes, we&apos;ll ask you to agree to the new version in the app.</P>
    </View>
  );
}
