import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { getMapAvailability } from '../config/maps';
import { MapScreen } from './MapScreen';

jest.mock('../config/maps', () => ({ getMapAvailability: jest.fn() }));
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    PROVIDER_GOOGLE: 'google',
  };
});
const mockListGroups = jest.fn();
const mockListMapPosts = jest.fn();
jest.mock('../features/groups/groups', () => ({
  getGroupService: () => ({ listGroups: mockListGroups }),
}));
jest.mock('../features/memories/memories', () => ({
  getMemoryService: () => ({
    createReadScope: () => {
      const scope = jest
        .requireActual('../features/memories/memoryReadScope')
        .createMemoryReadScope();
      return {
        ...scope,
        listMapPosts: (ids: string[], options: unknown) =>
          scope.run(() => mockListMapPosts(ids, options)),
      };
    },
  }),
}));

const availability = jest.mocked(getMapAvailability);

describe('MapScreen', () => {
  beforeEach(() => {
    mockListGroups.mockReset().mockResolvedValue({ ok: true, groups: [] });
    mockListMapPosts
      .mockReset()
      .mockResolvedValue({ ok: true, data: { posts: [], nextCursor: null } });
  });
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

  it('投稿がなければ空状態を表示し、再取得ボタンを操作できる', async () => {
    availability.mockReturnValue({ status: 'ready' });
    await render(<MapScreen />);
    expect(
      await screen.findByText('表示する投稿はありません。'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '投稿を再取得' }));
    expect(
      await screen.findByText('表示する投稿はありません。'),
    ).toBeOnTheScreen();
  });

  it('チェック操作でグループ投稿を追加・除去し、チェック状態を表示する', async () => {
    availability.mockReturnValue({ status: 'ready' });
    const id = '35000000-0000-0000-0000-000000000001';
    const own = {
      id: 'personal',
      kind: 'personal',
      groupId: null,
      latitude: 0,
      longitude: 0,
      createdAt: '2026-10-10T00:00:00Z',
    };
    mockListGroups.mockResolvedValue({
      ok: true,
      groups: [
        {
          id,
          name: '旅の思い出',
          createdBy: 'fixture',
          createdAt: '2026-10-10T00:00:00Z',
        },
      ],
    });
    mockListMapPosts.mockImplementation(async (ids: string[]) => ({
      ok: true,
      data: {
        posts: [
          own,
          ...(ids.length
            ? [{ ...own, id: 'group', kind: 'group', groupId: id }]
            : []),
        ],
        nextCursor: null,
      },
    }));
    await render(<MapScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText('自分の投稿、1件')).toBeOnTheScreen(),
    );
    const checkbox = screen.getByRole('checkbox', {
      name: '旅の思い出を地図に表示',
    });
    expect(
      screen.getByRole('checkbox', {
        name: '旅の思い出を地図に表示',
        checked: false,
      }),
    ).toBeOnTheScreen();
    await fireEvent.press(checkbox);
    expect(
      await screen.findByLabelText('グループ1の投稿、1件'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('checkbox', {
        name: '旅の思い出を地図に表示',
        checked: true,
      }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: '旅の思い出を地図に表示' }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText('グループ1の投稿、1件')).toBeNull(),
    );
  });

  it('投稿取得失敗を表示し、再試行で回復する', async () => {
    availability.mockReturnValue({ status: 'ready' });
    mockListMapPosts.mockResolvedValueOnce({
      ok: false,
      error: { type: 'network', message: '通信に失敗しました。' },
    });
    await render(<MapScreen />);
    expect(await screen.findByText('通信に失敗しました。')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '投稿を再取得' }));
    expect(
      await screen.findByText('表示する投稿はありません。'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('通信に失敗しました。')).toBeNull();
  });

  it('アカウントが変わったら前のグループ選択とマーカーを引き継がない', async () => {
    availability.mockReturnValue({ status: 'ready' });
    const id = '35000000-0000-0000-0000-000000000001';
    mockListGroups.mockResolvedValue({
      ok: true,
      groups: [
        {
          id,
          name: '旅の思い出',
          createdBy: 'fixture',
          createdAt: '2026-10-10T00:00:00Z',
        },
      ],
    });
    const view = await render(<MapScreen currentUserId="account-a" />);
    const checkbox = await screen.findByRole('checkbox', {
      name: '旅の思い出を地図に表示',
    });
    await fireEvent.press(checkbox);
    expect(
      screen.getByRole('checkbox', {
        name: '旅の思い出を地図に表示',
        checked: true,
      }),
    ).toBeOnTheScreen();
    await view.rerender(<MapScreen currentUserId="account-b" />);
    expect(
      await screen.findByRole('checkbox', {
        name: '旅の思い出を地図に表示',
        checked: false,
      }),
    ).toBeOnTheScreen();
  });
});
