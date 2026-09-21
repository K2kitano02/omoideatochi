import { act, render, screen } from '@testing-library/react-native';
import type { AppStateStatus } from 'react-native';
import { Text, View } from 'react-native';

import type { GroupInvitationService } from './groupInvitationService';
import { useOwnedGroupPendingCounts } from './useOwnedGroupPendingCounts';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const firstGroupId = '40000000-0000-0000-0000-000000000001';
const secondGroupId = '40000000-0000-0000-0000-000000000002';

const createAppState = () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  return {
    source: {
      addEventListener: jest.fn(
        (_event: 'change', nextListener: (state: AppStateStatus) => void) => {
          listener = nextListener;
          return { remove };
        },
      ),
    },
    change: (state: AppStateStatus) => listener?.(state),
    remove,
  };
};

type PendingCountService = Pick<
  GroupInvitationService,
  'listOwnedGroupPendingCounts'
>;

const PendingCountHarness = ({
  appState,
  service,
}: {
  appState: ReturnType<typeof createAppState>['source'];
  service: PendingCountService;
}) => {
  const { countsByGroup, totalCount } = useOwnedGroupPendingCounts({
    appState,
    service,
  });

  return (
    <View>
      <Text>合計 {totalCount}</Text>
      <Text>1件目 {countsByGroup[firstGroupId] ?? 0}</Text>
      <Text>2件目 {countsByGroup[secondGroupId] ?? 0}</Text>
    </View>
  );
};

describe('useOwnedGroupPendingCounts', () => {
  test('初回取得したグループ別件数と合計を返す', async () => {
    const appState = createAppState();
    const service = {
      listOwnedGroupPendingCounts: jest.fn().mockResolvedValue({
        ok: true,
        counts: [
          { groupId: firstGroupId, pendingCount: 2 },
          { groupId: secondGroupId, pendingCount: 1 },
        ],
      }),
    };

    await render(
      <PendingCountHarness appState={appState.source} service={service} />,
    );

    expect(await screen.findByText('合計 3')).toBeTruthy();
    expect(screen.getByText('1件目 2')).toBeTruthy();
    expect(screen.getByText('2件目 1')).toBeTruthy();
  });

  test('アプリが前面へ戻ると最新件数へ更新し、終了時に監視を解除する', async () => {
    const appState = createAppState();
    const service = {
      listOwnedGroupPendingCounts: jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          counts: [{ groupId: firstGroupId, pendingCount: 2 }],
        })
        .mockResolvedValueOnce({
          ok: true,
          counts: [{ groupId: firstGroupId, pendingCount: 1 }],
        }),
    };
    const view = await render(
      <PendingCountHarness appState={appState.source} service={service} />,
    );
    await screen.findByText('合計 2');

    await act(async () => {
      appState.change('background');
      appState.change('active');
    });

    expect(await screen.findByText('合計 1')).toBeTruthy();
    await view.unmount();
    expect(appState.remove).toHaveBeenCalledTimes(1);
  });
});
