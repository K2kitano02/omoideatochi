import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { createMapAvailability, getMapAvailability } from './maps';

jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      executionEnvironment: actual.ExecutionEnvironment.Bare,
      expoConfig: null,
    },
  };
});

describe('地図表示可否', () => {
  it.each([
    ['ios', false, { iosConfigured: true, androidConfigured: false }, 'ready'],
    [
      'android',
      false,
      { iosConfigured: true, androidConfigured: false },
      'missing-key',
    ],
    ['android', false, { androidConfigured: true }, 'ready'],
    ['ios', true, null, 'expo-go'],
    ['web', true, null, 'unsupported'],
    ['unknown', false, { iosConfigured: true }, 'unsupported'],
    ['ios', false, null, 'missing-key'],
    ['ios', false, [], 'missing-key'],
    ['ios', false, {}, 'missing-key'],
    ['ios', false, { iosConfigured: 'true' }, 'missing-key'],
    ['ios', false, { iosConfigured: false }, 'missing-key'],
  ])('%s / Expo Go=%s / %j は %s', (platform, isExpoGo, settings, status) => {
    const result = createMapAvailability({ platform, isExpoGo, settings });
    expect(result.status).toBe(status);
    if (status !== 'ready') expect(result.message).toEqual(expect.any(String));
  });

  it('実行環境と当該OSの設定から判定し、設定欠落でも例外にならない', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'ios');
    const environment = jest.replaceProperty(
      Constants,
      'executionEnvironment',
      ExecutionEnvironment.StoreClient,
    );
    const config = jest.replaceProperty(Constants, 'expoConfig', null);
    expect(getMapAvailability().status).toBe('expo-go');
    environment.replaceValue(ExecutionEnvironment.Bare);
    expect(getMapAvailability().status).toBe('missing-key');
    config.replaceValue({
      name: 'test',
      slug: 'test',
      extra: { googleMaps: { iosConfigured: true } },
    });
    expect(getMapAvailability().status).toBe('ready');
    platform.restore();
    environment.restore();
    config.restore();
  });
});
