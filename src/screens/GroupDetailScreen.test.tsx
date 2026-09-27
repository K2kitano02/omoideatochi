import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { GroupLifecycleService } from '../features/groups/groupLifecycleService';
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

type LifecycleService = Pick<
  GroupLifecycleService,
  'leaveGroup' | 'removeGroupMember' | 'dissolveGroup'
>;

const createLifecycleService = (
  overrides: Partial<LifecycleService> = {},
): LifecycleService => ({
  leaveGroup: jest.fn().mockResolvedValue({
    ok: true,
    result: { action: 'left', groupId },
  }),
  removeGroupMember: jest.fn().mockResolvedValue({
    ok: true,
    result: {
      action: 'member-removed',
      groupId,
      userId: groupDetails.members[1].userId,
    },
  }),
  dissolveGroup: jest.fn().mockResolvedValue({
    ok: true,
    result: { action: 'dissolved', groupId },
  }),
  ...overrides,
});

describe('<GroupDetailScreen />', () => {
  test('通常メンバーには退出だけを表示し作成者向け操作を隠す', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002"
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService()}
        onBack={jest.fn()}
        onGroupUnavailable={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole('button', { name: 'グループを退出' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'グループを解散' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'あやをグループから削除' }),
    ).toBeNull();
  });

  test('作成者には通常メンバーの削除と解散だけを表示する', async () => {
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.createdBy}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService()}
        onBack={jest.fn()}
        onGroupUnavailable={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole('button', {
        name: 'あやをグループから削除',
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: 'なおきをグループから削除',
      }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'グループを解散' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'グループを退出' })).toBeNull();
  });

  test('退出は確認後に実行し成功するとグループ一覧へ戻る', async () => {
    const leaveGroup = jest.fn().mockResolvedValue({
      ok: true,
      result: { action: 'left', groupId },
    });
    const lifecycleService = createLifecycleService({ leaveGroup });
    const onGroupUnavailable = jest.fn();
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.members[1].userId}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={lifecycleService}
        onBack={jest.fn()}
        onGroupUnavailable={onGroupUnavailable}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを退出' }),
    );

    expect(screen.getByLabelText('退出の確認')).toBeTruthy();
    expect(screen.getByText('「家族」から退出しますか？')).toBeTruthy();
    expect(leaveGroup).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: '退出する' }));

    await waitFor(() => expect(onGroupUnavailable).toHaveBeenCalledTimes(1));
    expect(leaveGroup).toHaveBeenCalledWith(groupId);
  });

  test('確認をキャンセルした場合は退出しない', async () => {
    const leaveGroup = jest.fn();
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.members[1].userId}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService({ leaveGroup })}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを退出' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByLabelText('退出の確認')).toBeNull();
    expect(leaveGroup).not.toHaveBeenCalled();
  });

  test('メンバー削除は対象者を確認してから実行し一覧を更新する', async () => {
    const removeGroupMember = jest.fn().mockResolvedValue({
      ok: true,
      result: {
        action: 'member-removed',
        groupId,
        userId: groupDetails.members[1].userId,
      },
    });
    const getGroupDetails = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, group: groupDetails })
      .mockResolvedValueOnce({
        ok: true,
        group: { ...groupDetails, members: [groupDetails.members[0]] },
      });

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.createdBy}
        groupId={groupId}
        groupService={createGroupService(getGroupDetails)}
        lifecycleService={createLifecycleService({ removeGroupMember })}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'あやをグループから削除',
      }),
    );

    expect(screen.getByLabelText('メンバー削除の確認')).toBeTruthy();
    expect(screen.getByText('あやをグループから削除しますか？')).toBeTruthy();
    expect(removeGroupMember).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => expect(screen.queryByText('あや')).toBeNull());
    expect(removeGroupMember).toHaveBeenCalledWith(
      groupId,
      groupDetails.members[1].userId,
    );
    expect(getGroupDetails).toHaveBeenCalledTimes(2);
  });

  test('確認欄に「解散」と正確に入力した場合だけ解散できる', async () => {
    const dissolveGroup = jest.fn().mockResolvedValue({
      ok: true,
      result: { action: 'dissolved', groupId },
    });
    const onGroupUnavailable = jest.fn();
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.createdBy}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService({ dissolveGroup })}
        onBack={jest.fn()}
        onGroupUnavailable={onGroupUnavailable}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを解散' }),
    );

    const confirmButton = screen.getByRole('button', { name: '解散する' });
    expect(confirmButton.props.accessibilityState).toEqual({ disabled: true });
    expect(
      screen.getByText('確認のため「解散」と入力してください'),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('確認のため「解散」と入力'),
      '家族',
    );
    expect(confirmButton.props.accessibilityState).toEqual({ disabled: true });
    expect(dissolveGroup).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByLabelText('確認のため「解散」と入力'),
      '解散',
    );
    await fireEvent.press(screen.getByRole('button', { name: '解散する' }));

    await waitFor(() => expect(onGroupUnavailable).toHaveBeenCalledTimes(1));
    expect(dissolveGroup).toHaveBeenCalledWith(groupId);
  });

  test('通信エラーを日本語で表示し同じ画面から再試行できる', async () => {
    const leaveGroup = jest.fn().mockResolvedValue({
      ok: false,
      reason: 'network',
    });
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.members[1].userId}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService({ leaveGroup })}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを退出' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: '退出する' }));

    expect(
      await screen.findByRole('alert', {
        name: '通信に失敗しました。接続を確認して再度お試しください。',
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText('退出の確認')).toBeTruthy();
  });

  test('ライフサイクル処理が例外になっても安全なエラーを表示する', async () => {
    const leaveGroup = jest
      .fn()
      .mockRejectedValue(new Error('private service details'));
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.members[1].userId}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService({ leaveGroup })}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを退出' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: '退出する' }));

    const alert = await screen.findByRole('alert', {
      name: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(alert).toBeTruthy();
    expect(screen.getByLabelText('退出の確認')).toBeTruthy();
    expect(JSON.stringify(alert.props)).not.toContain(
      'private service details',
    );
  });

  test('処理中に確認ボタンを連打しても退出処理を重複実行しない', async () => {
    let resolveLeave:
      | ((
          value: Awaited<ReturnType<GroupLifecycleService['leaveGroup']>>,
        ) => void)
      | undefined;
    const request = new Promise<
      Awaited<ReturnType<GroupLifecycleService['leaveGroup']>>
    >((resolve) => {
      resolveLeave = resolve;
    });
    const leaveGroup = jest.fn().mockReturnValue(request);
    const groupService = createGroupService(
      jest.fn().mockResolvedValue({ ok: true, group: groupDetails }),
    );

    await render(
      <GroupDetailScreen
        currentUserId={groupDetails.members[1].userId}
        groupId={groupId}
        groupService={groupService}
        lifecycleService={createLifecycleService({ leaveGroup })}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'グループを退出' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: '退出する' }));
    await fireEvent.press(screen.getByRole('button', { name: '処理中' }));

    expect(leaveGroup).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: '処理中' }).props.accessibilityState,
    ).toEqual({ disabled: true });

    await act(async () => {
      resolveLeave?.({
        ok: true,
        result: { action: 'left', groupId },
      });
      await request;
    });
  });

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
