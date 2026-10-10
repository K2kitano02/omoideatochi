import type { ExpoConfig } from 'expo/config';

import { createGoogleMapsConfig } from '../config/googleMapsConfig';

const base: ExpoConfig = {
  name: '思い出跡地',
  slug: 'omoideatochi',
  icon: './assets/icon.png',
  ios: { supportsTablet: true },
  android: { adaptiveIcon: { foregroundImage: './assets/icon.png' } },
  plugins: ['expo-sqlite', 'expo-asset'],
  extra: { existing: 'preserved' },
};

describe('Google Mapsビルド設定', () => {
  it('Xcode 27で起動できるようにiOSのScene対応をビルドへ渡す', () => {
    const result = createGoogleMapsConfig(base, {});
    expect(result.plugins).toContainEqual([
      'expo-build-properties',
      { ios: { enableSceneSupport: true } },
    ]);
  });

  it.each([
    [
      { ios: ' test-only-ios ' },
      true,
      false,
      { iosGoogleMapsApiKey: 'test-only-ios' },
    ],
    [
      { android: ' test-only-android ' },
      false,
      true,
      { androidGoogleMapsApiKey: 'test-only-android' },
    ],
    [
      { ios: 'test-only-ios', android: 'test-only-android' },
      true,
      true,
      {
        iosGoogleMapsApiKey: 'test-only-ios',
        androidGoogleMapsApiKey: 'test-only-android',
      },
    ],
    [{}, false, false, {}],
    [{ ios: ' ', android: '\t' }, false, false, {}],
  ])(
    'OS別のキーを正規化し、公開設定には設定有無だけを渡す (%j)',
    (keys, iosConfigured, androidConfigured, options) => {
      const result = createGoogleMapsConfig(base, keys);
      expect(result.extra?.googleMaps).toEqual({
        iosConfigured,
        androidConfigured,
      });
      expect(result.plugins).toContainEqual(['react-native-maps', options]);
      expect(JSON.stringify(result.extra)).not.toContain('test-only');
    },
  );

  it('元の設定を変更せず、既存設定を保持して両OSの識別子を指定する', () => {
    const before = JSON.stringify(base);
    const result = createGoogleMapsConfig(base, {});
    expect(JSON.stringify(base)).toBe(before);
    expect(result.ios).toEqual({
      supportsTablet: true,
      bundleIdentifier: 'com.k2kitano02.omoideatochi',
    });
    expect(result.android).toEqual({
      adaptiveIcon: { foregroundImage: './assets/icon.png' },
      package: 'com.k2kitano02.omoideatochi',
    });
    expect(result.icon).toBe('./assets/icon.png');
    expect(result.extra?.existing).toBe('preserved');
    expect(result.plugins).toEqual([
      'expo-sqlite',
      'expo-asset',
      ['react-native-maps', {}],
      ['expo-build-properties', { ios: { enableSceneSupport: true } }],
    ]);
    expect(result.ios?.infoPlist).toBeUndefined();
    expect(result.android?.permissions).toBeUndefined();
  });
});
