import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GoogleMap } from '../components/GoogleMap';
import { getMapAvailability } from '../config/maps';

let NativeGoogleMap: typeof GoogleMap | undefined;

export const MapScreen = ({ isFocused = true }: { isFocused?: boolean }) => {
  const availability = getMapAvailability();
  // Native maps enforce module availability at import time. Do not import them
  // while showing the Expo Go / missing-key / unsupported fallback.
  const MapComponent =
    availability.status === 'ready' && isFocused
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- Defer native module enforcement until maps are usable.
        (NativeGoogleMap ??= require('../components/GoogleMap').GoogleMap)
      : undefined;
  return (
    <SafeAreaView accessibilityLabel="地図画面" style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MEMORY MAP</Text>
        <Text accessibilityRole="header" style={styles.title}>
          思い出の地図
        </Text>
        <Text style={styles.description}>
          自分が残した思い出を、ここからいつでも振り返れます。
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {availability.status === 'ready' ? (
          MapComponent && <MapComponent />
        ) : (
          <View style={styles.notice}>
            <Text style={styles.placeholderTitle}>地図を表示するには</Text>
            <Text style={styles.placeholderText}>{availability.message}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 28,
  },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  mapContainer: {
    backgroundColor: '#F6F9FA',
    borderRadius: 28,
    flex: 1,
    marginBottom: 20,
    marginTop: 28,
    overflow: 'hidden',
  },
  notice: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  placeholderTitle: {
    color: '#102B3D',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderText: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
});
