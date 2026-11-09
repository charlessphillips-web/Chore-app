import { useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cropProfilePhoto, type PickedImage } from '../lib/photos';
import { haptics } from '../lib/haptics';
import { Button, ErrorText } from './ui';
import { colors, fonts, space } from './theme';

const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

/**
 * Instagram-style crop: the photo sits behind a circle; drag to move it,
 * pinch (or use the slider) to zoom. Whatever is inside the circle is saved.
 */
export function PhotoCropper({
  image, onDone, onCancel,
}: {
  image: PickedImage;
  onDone: (base64: string) => void;
  onCancel: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const W = Math.min(screenW, 480);
  const H = W * 1.1;
  const D = W - 48; // circle diameter
  const base = D / Math.min(image.width, image.height); // scale where the photo just covers the circle

  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // photo centre relative to circle centre
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = base * zoom;
  const dispW = image.width * s;
  const dispH = image.height * s;
  const limit = (p: { x: number; y: number }, z: number) => {
    const maxX = (image.width * base * z - D) / 2;
    const maxY = (image.height * base * z - D) / 2;
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
  };

  // Latest values for the gesture handlers.
  const live = useRef({ zoom, pos });
  useEffect(() => {
    live.current = { zoom, pos };
  }, [zoom, pos]);
  const start = useRef({ pos: { x: 0, y: 0 }, zoom: 1, pinch: 0 });

  // The handlers only read the refs when a finger moves, not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { pos: live.current.pos, zoom: live.current.zoom, pinch: 0 };
        },
        onPanResponderMove: (e, g) => {
          if (e.nativeEvent.touches.length === 2) {
            const d = dist(e);
            if (!start.current.pinch) {
              start.current = { ...start.current, pinch: d, zoom: live.current.zoom, pos: live.current.pos };
              return;
            }
            const z = clamp((start.current.zoom * d) / start.current.pinch, 1, MAX_ZOOM);
            setZoom(z);
            setPos((p) => limit(p, z));
          } else if (!start.current.pinch) {
            setPos(limit({ x: start.current.pos.x + g.dx, y: start.current.pos.y + g.dy }, live.current.zoom));
          }
        },
      }),
  );

  // Zoom slider (also works with a mouse on the web version).
  const trackW = W - 96;
  function setFromX(x: number) {
    const z = 1 + clamp(x / trackW, 0, 1) * (MAX_ZOOM - 1);
    setZoom(z);
    setPos((p) => limit(p, z));
  }
  const [slider] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  );

  async function done() {
    setBusy(true);
    setError(null);
    try {
      const size = D / s;
      const cx = image.width / 2 - pos.x / s;
      const cy = image.height / 2 - pos.y / s;
      const crop = {
        originX: Math.round(clamp(cx - size / 2, 0, image.width - size)),
        originY: Math.round(clamp(cy - size / 2, 0, image.height - size)),
        width: Math.floor(size),
        height: Math.floor(size),
      };
      const data = await cropProfilePhoto(image, crop);
      haptics.success();
      onDone(data);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const B = Math.max(W, H);
  return (
    <Modal animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>MOVE AND SCALE</Text>
        <View style={[styles.stage, { width: W, height: H }]} {...pan.panHandlers}>
          <Image
            source={{ uri: image.uri }}
            style={{
              position: 'absolute', width: dispW, height: dispH,
              left: W / 2 + pos.x - dispW / 2, top: H / 2 + pos.y - dispH / 2,
            }}
          />
          {/* Dims everything outside the circle */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', width: D + 2 * B, height: D + 2 * B, borderRadius: (D + 2 * B) / 2,
              borderWidth: B, borderColor: 'rgba(0,0,0,0.7)', left: (W - D) / 2 - B, top: (H - D) / 2 - B,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', width: D, height: D, borderRadius: D / 2, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.6)', left: (W - D) / 2, top: (H - D) / 2,
            }}
          />
        </View>
        <View style={styles.zoomRow}>
          <Text style={styles.zoomLabel}>−</Text>
          <View style={[styles.track, { width: trackW }]} {...slider.panHandlers} accessibilityLabel="Zoom" accessibilityRole="adjustable">
            <View pointerEvents="none" style={styles.trackLine} />
            <View pointerEvents="none" style={[styles.knob, { left: ((zoom - 1) / (MAX_ZOOM - 1)) * trackW - 10 }]} />
          </View>
          <Text style={styles.zoomLabel}>+</Text>
        </View>
        <Text style={styles.hint}>Drag to move · pinch or slide to zoom</Text>
        <ErrorText>{error}</ErrorText>
        <View style={styles.buttons}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} disabled={busy} />
          <Button title="Use photo" onPress={done} loading={busy} style={{ flex: 1 }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', gap: space.md, paddingTop: space.md },
  title: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, color: colors.text },
  stage: { overflow: 'hidden', backgroundColor: '#050505' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  zoomLabel: { color: colors.muted, fontSize: 18, fontFamily: fonts.mono },
  track: { height: 32, justifyContent: 'center' },
  trackLine: { height: 2, backgroundColor: colors.line, borderRadius: 1 },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, top: 6 },
  hint: { color: colors.muted, fontSize: 12 },
  buttons: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, alignSelf: 'stretch' },
});
