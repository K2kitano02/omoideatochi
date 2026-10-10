import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { GoogleMap } from './GoogleMap';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, PROVIDER_GOOGLE: 'google' };
});

describe('GoogleMap', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it('Google SDKへ固定の公開地点を渡し、位置情報・POIを利用しない', async () => {
    await render(<GoogleMap />);
    const map = screen.getByLabelText('Google Maps');
    expect(map.props.provider).toBe('google');
    expect(map.props.initialRegion).toEqual({
      latitude: 35.681236,
      longitude: 139.767125,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    expect(map.props.googleMapId).toBeUndefined();
    expect(map.props.showsUserLocation).toBe(false);
    expect(map.props.showsMyLocationButton).toBe(false);
    expect(map.props.followsUserLocation).toBe(false);
    expect(map.props.showsPointsOfInterests).toBe(false);
  });

  it('SDK準備完了で待機を終了しても、通信・キー確認の案内を残す', async () => {
    const schedule = jest.spyOn(globalThis, 'setTimeout');
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    await render(<GoogleMap />);
    const timerIndex = schedule.mock.calls.findIndex(
      (call) => call[1] === 15000,
    );
    const timer = schedule.mock.results[timerIndex].value;
    expect(screen.getByText('地図を読み込んでいます…')).toBeOnTheScreen();
    await act(() => screen.getByLabelText('Google Maps').props.onMapReady());
    await act(() => jest.advanceTimersByTime(0));
    expect(screen.queryByText('地図を読み込んでいます…')).toBeNull();
    expect(screen.getByText(/通信・APIキー制限・課金設定/)).toBeOnTheScreen();
    expect(clear).toHaveBeenCalledWith(timer);
    schedule.mockRestore();
    clear.mockRestore();
  });

  it('15秒で案内し、再試行後に旧イベントが届いても新しい待機を終了しない', async () => {
    await render(<GoogleMap />);
    const oldMap = screen.getByLabelText('Google Maps');
    const oldReady = oldMap.props.onMapReady;
    await act(() => jest.advanceTimersByTime(14999));
    expect(screen.queryByText(/読み込みに時間がかかっています/)).toBeNull();
    await act(() => jest.advanceTimersByTime(1));
    expect(
      screen.getByText(/読み込みに時間がかかっています/),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: '地図を再読み込み' }),
    );
    expect(screen.getByLabelText('Google Maps')).not.toBe(oldMap);
    await act(() => oldReady());
    expect(screen.getByText('地図を読み込んでいます…')).toBeOnTheScreen();
    await act(() => screen.getByLabelText('Google Maps').props.onMapReady());
    expect(screen.queryByText('地図を読み込んでいます…')).toBeNull();
  });

  it('画面離脱でタイマーを解除する', async () => {
    const schedule = jest.spyOn(globalThis, 'setTimeout');
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    const view = await render(<GoogleMap />);
    const timerIndex = schedule.mock.calls.findIndex(
      (call) => call[1] === 15000,
    );
    const timer = schedule.mock.results[timerIndex].value;
    await view.unmount();
    expect(clear).toHaveBeenCalledWith(timer);
    schedule.mockRestore();
    clear.mockRestore();
  });
});
