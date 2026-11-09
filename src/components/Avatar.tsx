import { Image, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { BGS, HAIR_COLORS, isLightBg, SKINS, type Avatar as AvatarData, type CharacterAvatar } from '../lib/avatar';
import { jpegUri } from '../lib/photos';
import { colors, fonts } from './theme';

const INK = '#111111';

/** A round profile picture: photo, drawn character, or the person's initial. */
export function Avatar({ avatar, name, size = 40 }: { avatar: AvatarData | null | undefined; name: string; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' as const };
  if (avatar?.kind === 'photo') {
    return <Image source={{ uri: jpegUri(avatar.data) }} style={round} accessibilityLabel={`${name}'s photo`} />;
  }
  if (avatar?.kind === 'character') {
    return (
      <View style={round} accessibilityLabel={`${name}'s character`}>
        <Character a={avatar} size={size} />
      </View>
    );
  }
  return (
    <View style={[round, { backgroundColor: colors.cardRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }]}>
      <Text style={{ fontFamily: fonts.mono, fontSize: size * 0.42, color: colors.text }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

/** Simple line-drawn character (120×120 drawing, scaled). */
export function Character({ a, size }: { a: CharacterAvatar; size: number }) {
  const skin = SKINS[a.skin];
  const hair = HAIR_COLORS[a.hairColor];
  const clothes = isLightBg(a.bg) ? '#1A1A1A' : '#EDEDED';
  const stroke = { stroke: INK, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const top = 'M35 58 C34 36 46 26 60 26 C76 26 87 36 85 58 C80 46 70 40 60 40 C48 40 40 46 35 58 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect width="120" height="120" fill={BGS[a.bg]} />
      {/* Long hair sits behind the head. */}
      {a.hair === 3 && (
        <Path d="M31 64 C28 34 44 24 60 24 C76 24 92 34 89 64 L91 100 C84 104 77 102 75 96 L75 62 L45 62 L45 96 C43 102 36 104 29 100 Z" fill={hair} {...stroke} />
      )}
      {/* Shoulders and neck */}
      <Path d="M18 122 C18 100 36 92 60 92 C84 92 102 100 102 122 Z" fill={clothes} {...stroke} />
      <Path d="M52 84 L52 94 C56 97 64 97 68 94 L68 84" fill={skin} {...stroke} />
      {/* Head */}
      <Path d="M35 60 C35 41 46 31 60 31 C74 31 85 41 85 60 C85 78 74 90 60 90 C46 90 35 78 35 60 Z" fill={skin} {...stroke} />
      {/* Hair on top */}
      {(a.hair === 1 || a.hair === 3 || a.hair === 4) && <Path d={top} fill={hair} {...stroke} />}
      {a.hair === 6 && <Path d={top} fill={hair} opacity={0.55} />}
      {a.hair === 2 && <Path d="M34 60 C32 34 50 24 64 26 C80 28 88 40 86 56 C78 44 62 36 48 46 C42 50 38 54 34 60 Z" fill={hair} {...stroke} />}
      {a.hair === 4 && <Circle cx="60" cy="22" r="9" fill={hair} {...stroke} />}
      {a.hair === 5 && (
        <G fill={hair} {...stroke}>
          {[[40, 46], [45, 36], [54, 30], [66, 30], [75, 36], [80, 46]].map(([x, y]) => (
            <Circle key={`${x}`} cx={x} cy={y} r="9" />
          ))}
        </G>
      )}
      {/* Eyes */}
      {a.eyes === 0 && <G fill={INK}><Circle cx="51" cy="61" r="2.6" /><Circle cx="69" cy="61" r="2.6" /></G>}
      {a.eyes === 1 && <G fill="none" {...stroke}><Path d="M47 62 Q51 57 55 62" /><Path d="M65 62 Q69 57 73 62" /></G>}
      {a.eyes === 2 && (
        <G>
          <Circle cx="51" cy="61" r="4.5" fill="#FFFFFF" {...stroke} strokeWidth={1.6} />
          <Circle cx="69" cy="61" r="4.5" fill="#FFFFFF" {...stroke} strokeWidth={1.6} />
          <Circle cx="51.5" cy="61.5" r="2" fill={INK} />
          <Circle cx="69.5" cy="61.5" r="2" fill={INK} />
        </G>
      )}
      {a.eyes === 3 && <G><Circle cx="51" cy="61" r="2.6" fill={INK} /><Path d="M65 62 Q69 58 73 62" fill="none" {...stroke} /></G>}
      {/* Nose */}
      <Path d="M60 65 Q57.5 70 61 71" fill="none" {...stroke} strokeWidth={1.6} />
      {/* Mouth */}
      {a.mouth === 0 && <Path d="M52 76 Q60 83 68 76" fill="none" {...stroke} />}
      {a.mouth === 1 && <Path d="M54 78 L66 78" fill="none" {...stroke} />}
      {a.mouth === 2 && <Path d="M51 75 Q60 87 69 75 Z" fill={INK} {...stroke} />}
      {a.mouth === 3 && <Path d="M53 78 Q62 81 68 74" fill="none" {...stroke} />}
      {/* Extras */}
      {a.extra === 1 && (
        <G fill="none" {...stroke} strokeWidth={1.8}>
          <Circle cx="51" cy="61" r="7.5" /><Circle cx="69" cy="61" r="7.5" /><Path d="M58.5 61 L61.5 61" />
        </G>
      )}
      {a.extra === 2 && (
        <G fill="none" {...stroke} strokeWidth={1.8}>
          <Rect x="43" y="55" width="15" height="12" rx="2" /><Rect x="62" y="55" width="15" height="12" rx="2" /><Path d="M58 60 L62 60" />
        </G>
      )}
      {a.extra === 3 && (
        <G {...stroke}>
          <Path d="M33 50 C33 30 46 21 60 21 C74 21 87 30 87 50 Z" fill="#2B2B2B" />
          <Rect x="31" y="45" width="58" height="9" rx="4" fill="#3A3A3A" />
        </G>
      )}
    </Svg>
  );
}
