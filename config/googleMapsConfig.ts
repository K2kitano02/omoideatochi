import type { ExpoConfig } from 'expo/config';

type GoogleMapsKeys = { ios?: string; android?: string };

export function createGoogleMapsConfig(
  base: ExpoConfig,
  keys: GoogleMapsKeys,
): ExpoConfig {
  const iosKey = keys.ios?.trim();
  const androidKey = keys.android?.trim();
  const options = {
    ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}),
    ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}),
  };

  return {
    ...base,
    ios: { ...base.ios, bundleIdentifier: 'com.k2kitano02.omoideatochi' },
    android: { ...base.android, package: 'com.k2kitano02.omoideatochi' },
    plugins: [
      ...(base.plugins ?? []),
      ['react-native-maps', options],
      ['expo-build-properties', { ios: { enableSceneSupport: true } }],
    ],
    extra: {
      ...base.extra,
      googleMaps: {
        iosConfigured: Boolean(iosKey),
        androidConfigured: Boolean(androidKey),
      },
    },
  };
}
