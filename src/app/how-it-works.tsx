import { router } from 'expo-router';
import { StoryIntro } from '../components/StoryIntro';

/** "How Choreboard works", opened from Settings. */
export default function HowItWorksScreen() {
  return <StoryIntro showWelcome={false} finishLabel={'Hold to\nclose'} onFinish={() => router.back()} />;
}
