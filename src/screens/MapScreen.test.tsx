import { render, screen } from '@testing-library/react-native';

import { getMapAvailability } from '../config/maps';
import { MapScreen } from './MapScreen';

jest.mock('../config/maps', () => ({ getMapAvailability: jest.fn() }));
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, PROVIDER_GOOGLE: 'google' };
});

const availability = jest.mocked(getMapAvailability);

describe('MapScreen', () => {
  it('対応する開発ビルドでは地図を表示する', async () => {
    availability.mockReturnValue({ status: 'ready' });
    await render(<MapScreen />);
    expect(screen.getByLabelText('Google Maps')).toBeOnTheScreen();
    expect(screen.getByLabelText('地図画面')).toBeOnTheScreen();
  });

  it.each([
    ['missing-key', '地図キーを設定してください'],
    ['expo-go', '開発ビルドで開いてください'],
    ['unsupported', 'iOS・Androidで開いてください'],
  ] as const)(
    '%sでは地図を生成せず、理由を表示する',
    async (status, message) => {
      availability.mockReturnValue({ status, message });
      await render(<MapScreen />);
      expect(screen.getByText(message)).toBeOnTheScreen();
      expect(screen.queryByLabelText('Google Maps')).toBeNull();
    },
  );

  it('タブを離れると地図を破棄し、戻ると読み込みから再生成する', async () => {
    availability.mockReturnValue({ status: 'ready' });
    const view = await render(<MapScreen isFocused />);
    const initialReady = screen.getByLabelText('Google Maps').props.onMapReady;
    await view.rerender(<MapScreen isFocused={false} />);
    expect(screen.queryByLabelText('Google Maps')).toBeNull();
    await view.rerender(<MapScreen isFocused />);
    expect(screen.getByLabelText('Google Maps').props.onMapReady).not.toBe(
      initialReady,
    );
    expect(screen.getByText('地図を読み込んでいます…')).toBeOnTheScreen();
  });
});
