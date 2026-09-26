import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { GroupService } from '../features/groups/groupService';
import { GroupDetailScreen } from './GroupDetailScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const groupId = '40000000-0000-0000-0000-000000000001';

const groupDetails = {
  id: groupId,
  name: '家族',
  createdBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
  createdAt: '2026-09-19T00:00:00.000Z',
  members: [
    {
      userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
      displayName: 'なおき',
      role: 'owner' as const,
      joinedAt: '2026-09-19T00:00:00.000Z',
    },
    {
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002',
      displayName: 'あや',
      role: 'member' as const,
      joinedAt: '2026-09-20T00:00:00.000Z',
    },
  ],
};

const createGroupService = (
  getGroupDetails: GroupService['getGroupDetails'],
): Pick<GroupService, 'getGroupDetails'> => ({ getGroupDetails });

describe('<GroupDetailScreen />', () => {
  test('招待管理画面へグループ情報とオーナー判定を渡す', async () => {
    const onInvite = jest.fn();
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001"
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
        onInvite={onInvite}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'メンバーを招待' }),
    );

    expect(onInvite).toHaveBeenCalledWith({
      groupId,
      groupName: '家族',
      isOwner: true,
    });
  });

  test('招待導線に承認待ち件数を表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
        pendingCount={2}
      />,
    );

    expect(await screen.findByText('承認待ち 2件')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'メンバーを招待、承認待ち2件' }),
    ).toBeTruthy();
  });

  test('グループ名と作成者・通常メンバーを区別して表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({
        ok: true,
        group: groupDetails,
      }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByRole('header', { name: '家族' })).toBeTruthy();
    expect(screen.getByText('2人')).toBeTruthy();
    expect(screen.getByText('なおき')).toBeTruthy();
    expect(screen.getByText('あや')).toBeTruthy();
    expect(screen.getByLabelText('作成者 なおき')).toBeTruthy();
    expect(screen.getByLabelText('メンバー あや')).toBeTruthy();
  });

  test('表示名が取得できないメンバーだけ短縮UUIDを代替表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({
        ok: true,
        group: {
          ...groupDetails,
          members: [{ ...groupDetails.members[1], displayName: null }],
        },
      }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByText('bbbbbbbb…0002')).toBeTruthy();
  });

  test('戻るボタンでグループ一覧へ戻るよう依頼する', async () => {
    const onBack = jest.fn();
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={onBack}
      />,
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'グループ一覧に戻る' }),
    );

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('取得中は読み込み状態を表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockReturnValue(new Promise(() => undefined)),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('グループ詳細を読み込み中')).toBeTruthy();
  });

  test('表示できるメンバーがいない場合は空状態を表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({
        ok: true,
        group: { ...groupDetails, members: [] },
      }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByText('メンバーはいません')).toBeTruthy();
    expect(screen.getByText('0人')).toBeTruthy();
  });

  test('通信エラーから再読み込みすると詳細を表示する', async () => {
    const getGroupDetails = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          type: 'network',
          message: '通信に失敗しました。接続を確認して再度お試しください。',
        },
      })
      .mockResolvedValueOnce({ ok: true, group: groupDetails });
    const groupService = createGroupService(getGroupDetails);

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole('alert', {
        name: '通信に失敗しました。接続を確認して再度お試しください。',
      }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));

    expect(await screen.findByRole('header', { name: '家族' })).toBeTruthy();
    expect(getGroupDetails).toHaveBeenCalledTimes(2);
  });

  test('閲覧権限がない場合は理由を表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'permission-denied',
          message: 'このグループの情報を表示する権限がありません。',
        },
      }),
    );

    await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole('alert', {
        name: 'このグループの情報を表示する権限がありません。',
      }),
    ).toBeTruthy();
  });

  test('画面を離れた後に取得が完了しても画面を更新しない', async () => {
    let resolveRequest:
      | ((result: Awaited<ReturnType<GroupService['getGroupDetails']>>) => void)
      | undefined;
    const request = new Promise<
      Awaited<ReturnType<GroupService['getGroupDetails']>>
    >((resolve) => {
      resolveRequest = resolve;
    });
    const groupService = createGroupService(jest.fn().mockReturnValue(request));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const view = await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    await view.unmount();
    await act(async () => {
      resolveRequest?.({ ok: true, group: groupDetails });
      await request;
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('表示対象が変わったら以前のグループを隠して新しい詳細を読み込む', async () => {
    const nextGroupId = '40000000-0000-0000-0000-000000000002';
    let resolveNextRequest:
      | ((result: Awaited<ReturnType<GroupService['getGroupDetails']>>) => void)
      | undefined;
    const nextRequest = new Promise<
      Awaited<ReturnType<GroupService['getGroupDetails']>>
    >((resolve) => {
      resolveNextRequest = resolve;
    });
    const getGroupDetails = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, group: groupDetails })
      .mockReturnValueOnce(nextRequest);
    const groupService = createGroupService(getGroupDetails);
    const view = await render(
      <GroupDetailScreen
        groupId={groupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );
    expect(await screen.findByRole('header', { name: '家族' })).toBeTruthy();

    await view.rerender(
      <GroupDetailScreen
        groupId={nextGroupId}
        groupService={groupService}
        onBack={jest.fn()}
      />,
    );

    expect(screen.queryByRole('header', { name: '家族' })).toBeNull();
    expect(screen.getByLabelText('グループ詳細を読み込み中')).toBeTruthy();

    await act(async () => {
      resolveNextRequest?.({
        ok: true,
        group: {
          ...groupDetails,
          id: nextGroupId,
          name: '学生時代の友達',
        },
      });
      await nextRequest;
    });

    expect(
      await screen.findByRole('header', { name: '学生時代の友達' }),
    ).toBeTruthy();
    expect(getGroupDetails).toHaveBeenNthCalledWith(2, nextGroupId);
  });
});
