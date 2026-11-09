import { Text, View } from 'react-native';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, PRIVACY_VERSION } from '../lib/legal';
import { Label } from './ui';
import { colors, space, type } from './theme';

const contact = CONTACT_EMAIL ? `email ${CONTACT_EMAIL}` : 'use Settings → Report a bug';

const ROWS: [string, string, string][] = [
  ['Username and profile picture', 'So housemates know who did what', 'Your housemates'],
  ['Date of birth, gender, student or not, university', 'Anonymous statistics about who uses the app', 'Only the app owner. Never your housemates'],
  ['House name and area (e.g. "LS6 · Leeds")', 'Statistics on where the app is used. We never store your full postcode or address', 'Your housemates; the area only by the app owner'],
  ['Chores you log, with photos', 'So housemates can check chores were done', 'Your housemates'],
  ['Chores you flag, checks and send-backs', 'To ask the right housemate and keep scores fair', 'Your housemates'],
  ['Chore offers, prices and how you asked to be paid (a Monzo/PayPal link, or cash)', 'So housemates can pay each other. The app never handles money', 'The housemates in that deal'],
  ['Push notification token', 'To send you notifications', 'Nobody'],
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
        We don&apos;t collect your real name, email, phone number, contacts or exact location. You sign in anonymously:
        your account is tied to the app on your phone.
      </P>

      <Label>Where it&apos;s stored</Label>
      <P>On Google Firebase (Google Cloud). Notifications are sent through Expo&apos;s push service. Postcodes are looked up with postcodes.io.</P>

      <Label>How long we keep it</Label>
      <P>• Your profile and chores: while you use the app.</P>
      <P>• Leave a house: your membership and scores there are removed. Chores you logged stay in the house&apos;s history.</P>
      <P>• Delete your account (Settings → Delete my account): your profile is deleted straight away.</P>
      <P>• Bug reports and suggestions: until dealt with, and no more than 12 months.</P>

      <Label>Your rights (UK GDPR)</Label>
      <P>
        You can see, correct or delete your information at any time. Edit your details in Settings → Personal details,
        delete everything in Settings → Delete my account, or {contact} for anything else.
      </P>

      <Label>Age</Label>
      <P>You must be 13 or over to use {APP_NAME}.</P>

      <Label>Changes</Label>
      <P>If this policy changes, we&apos;ll ask you to agree to the new version in the app.</P>
    </View>
  );
}
