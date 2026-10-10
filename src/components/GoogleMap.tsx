import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

const initialRegion = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapAttempt = ({ onRetry }: { onRetry: () => void }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'timeout'>(
    'loading',
  );
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    active.current = true;
    timer.current = setTimeout(() => {
      if (active.current) setStatus('timeout');
      timer.current = null;
    }, 15000);
    return () => {
      active.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const onMapReady = () => {
    if (!active.current) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setStatus('ready');
  };

  return (
    <View style={styles.container}>
      <MapView
        accessibilityLabel="Google Maps"
        followsUserLocation={false}
        initialRegion={initialRegion}
        onMapReady={onMapReady}
        provider={PROVIDER_GOOGLE}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsUserLocation={false}
        style={styles.map}
      />
      <View accessibilityLiveRegion="polite" style={styles.help}>
        {status === 'loading' && (
          <Text style={styles.status}>地図を読み込んでいます…</Text>
        )}
        {status === 'timeout' && (
          <Text style={styles.status}>
            地図の読み込みに時間がかかっています。
          </Text>
        )}
        <Text style={styles.description}>
          表示されない場合は、通信・APIキー制限・課金設定を確認してください。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>地図を再読み込み</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const GoogleMap = () => {
  const [attempt, setAttempt] = useState(0);
  return (
    <MapAttempt
      key={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F9FA' },
  map: { flex: 1, minHeight: 120 },
  help: { padding: 14, gap: 8 },
  status: { color: '#102B3D', fontSize: 13, fontWeight: '700' },
  description: { color: '#596D79', fontSize: 12, lineHeight: 18 },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#E7A84B',
  },
  retryText: { color: '#102B3D', fontSize: 13, fontWeight: '700' },
});
