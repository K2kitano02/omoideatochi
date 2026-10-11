import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import {
  clusterMemoryMapPosts,
  type MapRegion,
} from '../features/memories/memoryMapClusters';
import type { MemoryMapPost } from '../features/memories/memoryTypes';

type GoogleMapProps = {
  posts?: readonly MemoryMapPost[];
  groupIds?: readonly string[];
};
const emptyPosts: readonly MemoryMapPost[] = [];
const emptyIds: readonly string[] = [];
export const groupMapColors = [
  '#35788C',
  '#925DA3',
  '#4E7B48',
  '#B65A45',
  '#6565A8',
];

const initialRegion = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapAttempt = ({
  onRetry,
  posts,
  groupIds,
}: GoogleMapProps & { onRetry: () => void }) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<MapRegion>(initialRegion);
  const [width, setWidth] = useState(0);
  const markers = useMemo(
    () => clusterMemoryMapPosts(posts ?? emptyPosts, region, width),
    [posts, region, width],
  );
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
        ref={mapRef}
        accessibilityLabel="Google Maps"
        followsUserLocation={false}
        initialRegion={initialRegion}
        onMapReady={onMapReady}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onRegionChangeComplete={(next) => {
          if (active.current) setRegion(next);
        }}
        pitchEnabled={false}
        rotateEnabled={false}
        provider={PROVIDER_GOOGLE}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsUserLocation={false}
        style={styles.map}
      >
        {markers.map((marker) => {
          const index = (groupIds ?? emptyIds).indexOf(marker.groupId ?? '');
          const isPersonal = marker.kind === 'personal';
          const color = isPersonal
            ? '#BC7C20'
            : groupMapColors[Math.max(index, 0) % groupMapColors.length];
          const label = isPersonal ? '自分' : `グループ${index + 1}`;
          return (
            <Marker
              key={marker.key}
              accessibilityLabel={`${label}の投稿、${marker.count}件`}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              onPress={() => {
                if (marker.count > 1)
                  mapRef.current?.animateToRegion(
                    {
                      latitude: marker.latitude,
                      longitude: marker.longitude,
                      latitudeDelta: Math.max(
                        region.latitudeDelta / 4,
                        0.00001,
                      ),
                      longitudeDelta: Math.max(
                        region.longitudeDelta / 4,
                        0.00001,
                      ),
                    },
                    300,
                  );
              }}
            >
              <View style={[styles.marker, { backgroundColor: color }]}>
                <Text style={styles.markerLabel}>
                  {isPersonal ? '●' : `G${index + 1}`}
                </Text>
                {marker.count > 1 && (
                  <Text style={styles.markerCount}>{marker.count}</Text>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>
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

export const GoogleMap = ({ posts, groupIds }: GoogleMapProps = {}) => {
  const [attempt, setAttempt] = useState(0);
  return (
    <MapAttempt
      key={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
      posts={posts}
      groupIds={groupIds}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F9FA' },
  map: { flex: 1, minHeight: 120 },
  marker: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  markerLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  markerCount: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
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
