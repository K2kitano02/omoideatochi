import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { GroupInvitationService } from '../features/groups/groupInvitationService';
import { JoinGroupScreen } from './JoinGroupScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const groupId = '40000000-0000-0000-0000-000000000001';
const requestId = '50000000-0000-0000-0000-000000000001';
const token = 'abcdef12'.repeat(8);

const createService = (
  overrides: Partial<
    Pick<
      GroupInvitationService,
      | 'previewInvitation'
      | 'redeemInvitation'
      | 'listMyJoinRequests'
      | 'cancelJoinRequest'
    >
  > = {},
) => ({
  previewInvitation: jest.fn().mockResolvedValue({
    ok: true,
    preview: {
      groupId,
      groupName: '家族',
      requiresApproval: true,
      expiresAt: '2026-09-21T12:10:00.000Z',
    },
  }),
  redeemInvitation: jest.fn().mockResolvedValue({
    ok: true,
    result: { status: 'pending', groupId, requestId },
  }),
  listMyJoinRequests: jest.fn().mockResolvedValue({ ok: true, requests: [] }),
  cancelJoinRequest: jest.fn().mockResolvedValue({ ok: true }),
  ...overrides,
});

describe('<JoinGroupScreen />', () => {
  test('コードを確認し、共有範囲へ同意して参加申請する', async () => {
    const service = createService();

    await render(
      <JoinGroupScreen
        invitationService={service}
        onBack={jest.fn()}
        onJoined={jest.fn()}
      />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('招待コード'),
      'ABCD EF12 '.repeat(8),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '招待内容を確認' }),
    );

    expect(await screen.findByText('家族')).toBeTruthy();
    expect(service.previewInvitation).toHaveBeenCalledWith(token);
    expect(
      screen.getByText(
        '参加すると、グループで共有された過去の写真・メモ・正確な位置情報を閲覧できます。',
      ),
    ).toBeTruthy();

    const joinButton = screen.getByRole('button', { name: '参加を申し込む' });
    expect(joinButton).toBeDisabled();

    await fireEvent.press(
      screen.getByRole('checkbox', { name: '共有範囲に同意する' }),
    );
    expect(joinButton).toBeEnabled();
    await fireEvent.press(joinButton);

    await waitFor(() => {
      expect(service.redeemInvitation).toHaveBeenCalledWith(token, true);
    });
    expect(
      await screen.findByText('オーナーの承認を待っています'),
    ).toBeTruthy();
  });

  test('オーナー発行コードでは参加後にグループ詳細へ移動する', async () => {
    const onJoined = jest.fn();
    const service = createService({
      previewInvitation: jest.fn().mockResolvedValue({
        ok: true,
        preview: {
          groupId,
          groupName: '家族',
          requiresApproval: false,
          expiresAt: '2026-09-21T12:10:00.000Z',
        },
      }),
      redeemInvitation: jest.fn().mockResolvedValue({
        ok: true,
        result: { status: 'joined', groupId },
      }),
    });

    await render(
      <JoinGroupScreen
        invitationService={service}
        onBack={jest.fn()}
        onJoined={onJoined}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('招待コード'), token);
    await fireEvent.press(
      screen.getByRole('button', { name: '招待内容を確認' }),
    );
    expect(await screen.findByText('すぐに参加できます')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: '共有範囲に同意する' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'グループに参加' }),
    );

    await waitFor(() => {
      expect(onJoined).toHaveBeenCalledWith(groupId);
    });
  });

  test('自分の承認待ち申請を表示して取り消す', async () => {
    const service = createService({
      listMyJoinRequests: jest.fn().mockResolvedValue({
        ok: true,
        requests: [
          {
            requestId,
            groupId,
            groupName: '家族',
            status: 'pending',
            createdAt: '2026-09-21T12:00:00.000Z',
            resolvedAt: null,
          },
          {
            requestId: '50000000-0000-0000-0000-000000000002',
            groupId: '40000000-0000-0000-0000-000000000002',
            groupName: '友人',
            status: 'rejected',
            createdAt: '2026-09-20T12:00:00.000Z',
            resolvedAt: '2026-09-20T12:05:00.000Z',
          },
        ],
      }),
    });

    await render(
      <JoinGroupScreen
        invitationService={service}
        onBack={jest.fn()}
        onJoined={jest.fn()}
      />,
    );

    expect(await screen.findByText('家族への参加申請')).toBeTruthy();
    expect(screen.getByText('友人への参加申請')).toBeTruthy();
    expect(screen.getByText('拒否されました')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '友人への参加申請を取り消す' }),
    ).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: '家族への参加申請を取り消す' }),
    );

    await waitFor(() => {
      expect(service.cancelJoinRequest).toHaveBeenCalledWith(requestId);
    });
    expect(screen.queryByText('家族への参加申請')).toBeNull();
  });

  test('無効なコードの安全なエラーを表示する', async () => {
    const service = createService({
      previewInvitation: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'invitation-not-found',
          message: '招待コードが見つかりません。入力内容を確認してください。',
        },
      }),
    });

    await render(
      <JoinGroupScreen
        invitationService={service}
        onBack={jest.fn()}
        onJoined={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText('招待コード'), 'invalid');
    await fireEvent.press(
      screen.getByRole('button', { name: '招待内容を確認' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '招待コードが見つかりません。入力内容を確認してください。',
    );
  });

  test('参加処理中の多重送信を防ぐ', async () => {
    let resolveRedeem!: (
      value: Awaited<ReturnType<GroupInvitationService['redeemInvitation']>>,
    ) => void;
    const redeemInvitation = jest.fn(
      () =>
        new Promise<
          Awaited<ReturnType<GroupInvitationService['redeemInvitation']>>
        >((resolve) => {
          resolveRedeem = resolve;
        }),
    );
    const service = createService({ redeemInvitation });

    await render(
      <JoinGroupScreen
        invitationService={service}
        onBack={jest.fn()}
        onJoined={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText('招待コード'), token);
    await fireEvent.press(
      screen.getByRole('button', { name: '招待内容を確認' }),
    );
    await screen.findByText('家族');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: '共有範囲に同意する' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '参加を申し込む' }),
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: '参加を申し込む',
        disabled: true,
      }),
    );

    expect(redeemInvitation).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRedeem({
        ok: true,
        result: { status: 'pending', groupId, requestId },
      });
    });
  });
});
