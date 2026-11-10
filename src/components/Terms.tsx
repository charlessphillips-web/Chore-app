import { Text, View } from 'react-native';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, PRIVACY_VERSION } from '../lib/legal';
import { Label } from './ui';
import { colors, space, type } from './theme';

function P({ children }: { children: React.ReactNode }) {
  return <Text style={[type.body, { color: colors.muted, lineHeight: 23 }]}>{children}</Text>;
}

/** Terms of use, in plain English. Shown at /terms. */
export function Terms() {
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.small}>Last updated {new Date(PRIVACY_VERSION).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <P>
        These are the rules for using {APP_NAME}, run by {OWNER_NAME} in the United Kingdom. By using the app you agree to
        them. Questions? Email {CONTACT_EMAIL}.
      </P>

      <Label>Who can use it</Label>
      <P>You must be 13 or over. Keep your login to yourself, and only make one account for yourself.</P>

      <Label>Be a good housemate</Label>
      <P>• Only log chores you actually did, and check housemates&apos; photos honestly.</P>
      <P>• Photos should show the chore, not people. Nothing rude, offensive or private.</P>
      <P>• No bullying, harassment or spamming (e.g. nudges) of housemates.</P>
      <P>We can remove content, or remove someone from {APP_NAME}, if these rules are broken.</P>

      <Label>Paying housemates</Label>
      <P>
        Chore offers are agreements between housemates. {APP_NAME} only keeps a note of the deal: it never holds, sends
        or receives money, and isn&apos;t part of any payment. You pay each other directly (e.g. Monzo, PayPal or cash),
        and sort out any disagreements between yourselves.
      </P>

      <Label>Your content</Label>
      <P>
        Photos, names and pictures you add stay yours. You let us store them and show them to your housemates so the app
        works. See the privacy policy for what we collect and why.
      </P>

      <Label>The app</Label>
      <P>
        {APP_NAME} is new and still being improved, so things may change, break or be unavailable at times. It&apos;s provided
        as it is. As far as the law allows, we&apos;re not responsible for losses from using it (for example a missed bin
        day or a housemate who doesn&apos;t pay). Nothing here affects your legal rights as a consumer.
      </P>

      <Label>Leaving</Label>
      <P>You can leave a house or delete your account at any time in Settings.</P>

      <Label>Changes</Label>
      <P>If these terms change, we&apos;ll ask you to agree to the new version in the app. These terms are governed by the law of England and Wales.</P>
    </View>
  );
}
