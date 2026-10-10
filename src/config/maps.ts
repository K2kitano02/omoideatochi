import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type MapAvailability = {
  status: 'ready' | 'unsupported' | 'expo-go' | 'missing-key';
  message?: string;
};

export function createMapAvailability({
  platform,
  isExpoGo,
  settings,
}: {
  platform: string;
  isExpoGo: boolean;
  settings: unknown;
}): MapAvailability {
  if (platform !== 'ios' && platform !== 'android') {
    return {
      status: 'unsupported',
      message: '地図はiOS・Androidの開発ビルドで確認してください。',
    };
  }
  if (isExpoGo) {
    return {
      status: 'expo-go',
      message:
        'Google Mapsの確認には専用の開発ビルドが必要です。Expo Goでは地図を表示しません。',
    };
  }
  const configured =
    settings !== null &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    (settings as Record<string, unknown>)[
      platform === 'ios' ? 'iosConfigured' : 'androidConfigured'
    ] === true;
  if (!configured) {
    return {
      status: 'missing-key',
      message:
        'このOSの地図キーが未設定です。.envを設定し、開発ビルドを作り直してください。',
    };
  }
  return { status: 'ready' };
}

export function getMapAvailability(): MapAvailability {
  return createMapAvailability({
    platform: Platform.OS,
    isExpoGo:
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    settings: Constants.expoConfig?.extra?.googleMaps,
  });
}
