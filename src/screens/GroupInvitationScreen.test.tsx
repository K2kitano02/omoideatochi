import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { GroupInvitationService } from '../features/groups/groupInvitationService';
import { GroupInvitationScreen } from './GroupInvitationScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const groupId = '40000000-0000-0000-0000-000000000001';
const token = '12345678'.repeat(8);
const firstRequestId = '50000000-0000-0000-0000-000000000001';
const secondRequestId = '50000000-0000-0000-0000-000000000002';

const createService = (
  overrides: Partial<
    Pick<
      GroupInvitationService,
      'createInvitation' | 'listJoinRequests' | 'resolveJoinRequest'
    >
  > = {},
) => ({
  createInvitation: jest.fn().mockResolvedValue({
    ok: true,
    invitation: {
      token,
      expiresAt: '2026-09-21T12:10:00.000Z',
      requiresApproval: true,
    },
  }),
  listJoinRequests: jest.fn().mockResolvedValue({
    ok: true,
    requests: [],
  }),
  resolveJoinRequest: jest.fn(),
  ...overrides,
});

describe('<GroupInvitationScreen />', () => {
  test('通常メンバーが承認制の招待コードを発行してコピーする', async () => {
    const service = createService();
    const copyText = jest.fn().mockResolvedValue(true);

    await render(
      <GroupInvitationScreen
        copyText={copyText}
        groupId={groupId}
        groupName="家族"
        invitationService={service}
        isOwner={false}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      screen.getByRole('button', { name: '招待コードを発行' }),
    );

    expect(await screen.findByLabelText('招待コード')).toHaveTextContent(
      Array(8).fill('12345678').join(' '),
    );
    expect(screen.getByText('参加にはオーナーの承認が必要です')).toBeTruthy();
    expect(service.listJoinRequests).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('button', { name: '招待コードをコピー' }),
    );

    expect(copyText).toHaveBeenCalledWith(token);
    expect(await screen.findByText('コピーしました')).toBeTruthy();
  });

  test('オーナーが参加申請を承認または拒否する', async () => {
    const onPendingCountsChanged = jest.fn();
    const service = createService({
      listJoinRequests: jest.fn().mockResolvedValue({
        ok: true,
        requests: [
          {
            requestId: firstRequestId,
            applicantId: 'abcdef01-0000-0000-0000-123456789abc',
            createdAt: '2026-09-21T12:00:00.000Z',
          },
          {
            requestId: secondRequestId,
            applicantId: '98765432-0000-0000-0000-fedcba987654',
            createdAt: '2026-09-21T12:01:00.000Z',
          },
        ],
      }),
      resolveJoinRequest: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 'approved' })
        .mockResolvedValueOnce({ ok: true, status: 'rejected' }),
    });

    await render(
      <GroupInvitationScreen
        groupId={groupId}
        groupName="家族"
        invitationService={service}
        isOwner
        onBack={jest.fn()}
        onPendingCountsChanged={onPendingCountsChanged}
      />,
    );

    expect(await screen.findByText('利用者 abcdef01…9abc')).toBeTruthy();
    expect(screen.getByText('利用者 98765432…7654')).toBeTruthy();
    expect(service.listJoinRequests).toHaveBeenCalledWith(groupId);

    await fireEvent.press(
      screen.getByRole('button', {
        name: '利用者 abcdef01…9abcの参加を許可',
      }),
    );

    await waitFor(() => {
      expect(service.resolveJoinRequest).toHaveBeenCalledWith(
        firstRequestId,
        true,
      );
    });
    expect(screen.queryByText('利用者 abcdef01…9abc')).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', {
        name: '利用者 98765432…7654の参加を拒否',
      }),
    );

    await waitFor(() => {
      expect(service.resolveJoinRequest).toHaveBeenCalledWith(
        secondRequestId,
        false,
      );
    });
    expect(await screen.findByText('承認待ちの申請はありません')).toBeTruthy();
    expect(onPendingCountsChanged).toHaveBeenCalledTimes(2);
  });

  test('参加申請の読み込み失敗後に再試行できる', async () => {
    const listJoinRequests = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { type: 'network', message: '通信に失敗しました。' },
      })
      .mockResolvedValueOnce({ ok: true, requests: [] });
    const service = createService({ listJoinRequests });

    await render(
      <GroupInvitationScreen
        groupId={groupId}
        groupName="家族"
        invitationService={service}
        isOwner
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '通信に失敗しました。',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '参加申請を再読み込み' }),
    );

    expect(await screen.findByText('承認待ちの申請はありません')).toBeTruthy();
    expect(listJoinRequests).toHaveBeenCalledTimes(2);
  });

  test('招待コード発行中の多重送信を防ぎ、失敗理由を表示する', async () => {
    let resolveCreate!: (
      value: Awaited<ReturnType<GroupInvitationService['createInvitation']>>,
    ) => void;
    const createInvitation = jest.fn(
      () =>
        new Promise<
          Awaited<ReturnType<GroupInvitationService['createInvitation']>>
        >((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const service = createService({ createInvitation });

    await render(
      <GroupInvitationScreen
        groupId={groupId}
        groupName="家族"
        invitationService={service}
        isOwner={false}
        onBack={jest.fn()}
      />,
    );

    await fireEvent.press(
      screen.getByRole('button', { name: '招待コードを発行' }),
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: '招待コードを発行',
        disabled: true,
      }),
    );

    expect(createInvitation).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate({
        ok: false,
        error: { type: 'network', message: '通信に失敗しました。' },
      });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '通信に失敗しました。',
    );
  });
});
