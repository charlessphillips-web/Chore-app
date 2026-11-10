import { router } from 'expo-router';
import { StoryIntro } from '../components/StoryIntro';

/** First thing new users see: how it works as stories, then the sign-up questions. */
export default function Welcome() {
  return <StoryIntro onFinish={() => router.replace('/create-account')} />;
}
