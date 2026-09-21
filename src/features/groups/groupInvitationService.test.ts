import { createGroupInvitationService } from './groupInvitationService';

const GROUP_ID = '40000000-0000-0000-0000-000000000001';
const INVITATION_TOKEN = 'a'.repeat(64);
const REQUEST_ID = '50000000-0000-0000-0000-000000000001';
const APPLICANT_ID = '00000000-0000-0000-0000-000000000002';

type ClientError = {
  code: string;
  message: string;
  details: string;
  hint: string;
};

const databaseError = (overrides: Partial<ClientError> = {}): ClientError => ({
  code: 'XX000',
  message: 'internal database failure',
  details: 'password=secret access_token=access-secret',
  hint: 'select * from private.group_invitations',
  ...overrides,
});

const createClient = () => {
  const rpc = jest.fn();

  return {
    client: { rpc },
    rpc,
  };
};

describe('createGroupInvitationService', () => {
  test('招待コードを発行して画面用の形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          invitation_token: INVITATION_TOKEN,
          expires_at: '2026-09-20T12:10:00.000Z',
          requires_approval: true,
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.createInvitation(GROUP_ID);

    expect(rpc).toHaveBeenCalledWith('create_group_invitation', {
      p_group_id: GROUP_ID,
    });
    expect(result).toEqual({
      ok: true,
      invitation: {
        token: INVITATION_TOKEN,
        expiresAt: '2026-09-20T12:10:00.000Z',
        requiresApproval: true,
      },
    });
  });

  test('招待コードから参加前の確認情報を取得する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          group_id: GROUP_ID,
          group_name: '家族',
          requires_approval: false,
          expires_at: '2026-09-20T12:10:00.000Z',
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.previewInvitation(INVITATION_TOKEN);

    expect(rpc).toHaveBeenCalledWith('preview_group_invitation', {
      p_token: INVITATION_TOKEN,
    });
    expect(result).toEqual({
      ok: true,
      preview: {
        groupId: GROUP_ID,
        groupName: '家族',
        requiresApproval: false,
        expiresAt: '2026-09-20T12:10:00.000Z',
      },
    });
  });

  test.each([
    {
      name: '作成者発行コードでは即時参加',
      row: {
        outcome: 'joined',
        group_id: GROUP_ID,
        join_request_id: null,
      },
      expected: {
        ok: true,
        result: { status: 'joined', groupId: GROUP_ID },
      },
    },
    {
      name: '通常メンバー発行コードでは承認待ち',
      row: {
        outcome: 'pending',
        group_id: GROUP_ID,
        join_request_id: REQUEST_ID,
      },
      expected: {
        ok: true,
        result: {
          status: 'pending',
          groupId: GROUP_ID,
          requestId: REQUEST_ID,
        },
      },
    },
  ])('$nameを区別して返す', async ({ row, expected }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: [row], error: null });
    const service = createGroupInvitationService(client as never);

    const result = await service.redeemInvitation(INVITATION_TOKEN, true);

    expect(rpc).toHaveBeenCalledWith('redeem_group_invitation', {
      p_token: INVITATION_TOKEN,
      p_consent: true,
    });
    expect(result).toEqual(expected);
  });

  test('作成者向けの承認待ち申請を画面用の形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          request_id: REQUEST_ID,
          applicant_id: APPLICANT_ID,
          created_at: '2026-09-20T12:00:00.000Z',
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.listJoinRequests(GROUP_ID);

    expect(rpc).toHaveBeenCalledWith('list_group_join_requests', {
      p_group_id: GROUP_ID,
    });
    expect(result).toEqual({
      ok: true,
      requests: [
        {
          requestId: REQUEST_ID,
          applicantId: APPLICANT_ID,
          createdAt: '2026-09-20T12:00:00.000Z',
        },
      ],
    });
  });

  test('所有グループごとの承認待ち件数を画面用の形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          group_id: GROUP_ID,
          pending_count: 2,
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.listOwnedGroupPendingCounts();

    expect(result).toEqual({
      ok: true,
      counts: [{ groupId: GROUP_ID, pendingCount: 2 }],
    });
  });

  test('自分の参加申請履歴を状態付きで変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          request_id: REQUEST_ID,
          group_id: GROUP_ID,
          group_name: '家族',
          status: 'rejected',
          created_at: '2026-09-20T12:00:00.000Z',
          resolved_at: '2026-09-20T12:05:00.000Z',
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.listMyJoinRequests();

    expect(rpc).toHaveBeenCalledWith('get_my_group_join_requests');
    expect(result).toEqual({
      ok: true,
      requests: [
        {
          requestId: REQUEST_ID,
          groupId: GROUP_ID,
          groupName: '家族',
          status: 'rejected',
          createdAt: '2026-09-20T12:00:00.000Z',
          resolvedAt: '2026-09-20T12:05:00.000Z',
        },
      ],
    });
  });

  test('申請者が承認待ち申請を取り消す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: null });
    const service = createGroupInvitationService(client as never);

    const result = await service.cancelJoinRequest(REQUEST_ID);

    expect(rpc).toHaveBeenCalledWith('cancel_group_join_request', {
      p_request_id: REQUEST_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  test.each([
    { approve: true, status: 'approved' },
    { approve: false, status: 'rejected' },
  ] as const)(
    '作成者が申請を$statusへ変更する',
    async ({ approve, status }) => {
      const { client, rpc } = createClient();
      rpc.mockResolvedValue({ data: status, error: null });
      const service = createGroupInvitationService(client as never);

      const result = await service.resolveJoinRequest(REQUEST_ID, approve);

      expect(rpc).toHaveBeenCalledWith('resolve_group_join_request', {
        p_request_id: REQUEST_ID,
        p_approve: approve,
      });
      expect(result).toEqual({ ok: true, status });
    },
  );

  test.each([
    {
      name: '未認証',
      error: databaseError({
        code: '28000',
        message: 'authentication_required',
      }),
      expected: {
        type: 'unauthenticated',
        message: 'ログインが必要です。再度ログインしてください。',
      },
    },
    {
      name: '権限不足',
      error: databaseError({
        code: '42501',
        message: 'permission_denied',
      }),
      expected: {
        type: 'permission-denied',
        message: 'この招待または参加申請を操作する権限がありません。',
      },
    },
  ])('$nameを安全な発行エラーへ変換する', async ({ error, expected }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error });
    const service = createGroupInvitationService(client as never);

    const result = await service.createInvitation(GROUP_ID);

    expect(result).toEqual({ ok: false, error: expected });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test.each([
    {
      name: '存在しない招待',
      message: 'invitation_not_found',
      expected: {
        type: 'invitation-not-found',
        message: '招待コードが見つかりません。入力内容を確認してください。',
      },
    },
    {
      name: '期限切れ招待',
      message: 'invitation_expired',
      expected: {
        type: 'invitation-expired',
        message: 'この招待コードの有効期限が切れています。',
      },
    },
    {
      name: '使用済み招待',
      message: 'invitation_used',
      expected: {
        type: 'invitation-used',
        message: 'この招待コードはすでに使用されています。',
      },
    },
  ])('$nameを区別する', async ({ message, expected }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: databaseError({ code: 'P0001', message }),
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.previewInvitation(INVITATION_TOKEN);

    expect(result).toEqual({ ok: false, error: expected });
  });

  test.each([
    {
      name: '共有範囲への同意不足',
      message: 'consent_required',
      expected: {
        type: 'consent-required',
        message: '共有範囲への同意が必要です。',
      },
    },
    {
      name: '参加済み',
      message: 'already_member',
      expected: {
        type: 'already-member',
        message: 'このグループにはすでに参加しています。',
      },
    },
    {
      name: '申請済み',
      message: 'request_already_pending',
      expected: {
        type: 'request-already-pending',
        message: 'このグループへの参加申請はすでに送信済みです。',
      },
    },
    {
      name: 'グループ満員',
      message: 'group_full',
      expected: {
        type: 'group-full',
        message: 'このグループは参加人数の上限に達しています。',
      },
    },
  ])('$nameを参加エラーとして区別する', async ({ message, expected }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: databaseError({ code: 'P0001', message }),
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.redeemInvitation(INVITATION_TOKEN, true);

    expect(result).toEqual({ ok: false, error: expected });
  });

  test('処理済み申請を専用エラーへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: databaseError({
        code: 'P0001',
        message: 'request_not_pending',
      }),
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.cancelJoinRequest(REQUEST_ID);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'request-not-pending',
        message: 'この参加申請はすでに処理されています。',
      },
    });
  });

  test('不正な承認引数を安全な入力エラーへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: databaseError({
        code: '22023',
        message: 'invalid_argument',
      }),
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.resolveJoinRequest(REQUEST_ID, true);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'invalid-argument',
        message: '入力内容が正しくありません。',
      },
    });
  });

  test('通信例外をnetworkへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockRejectedValue(new TypeError('Network request failed'));
    const service = createGroupInvitationService(client as never);

    const result = await service.previewInvitation(INVITATION_TOKEN);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });

  test('未知のDBエラーから内部情報を除いて返す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: databaseError() });
    const service = createGroupInvitationService(client as never);

    const result = await service.listJoinRequests(GROUP_ID);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          '招待情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test('不正なDB応答と招待コードのハッシュを画面へ渡さない', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: [
        {
          invitation_token: null,
          expires_at: '2026-09-20T12:10:00.000Z',
          requires_approval: true,
          token_hash: 'database-token-hash-must-not-be-returned',
        },
      ],
      error: null,
    });
    const service = createGroupInvitationService(client as never);

    const result = await service.createInvitation(GROUP_ID);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          '招待情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('database-token-hash');
  });

  test('申請一覧が空なら正常な空配列を返す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: [], error: null });
    const service = createGroupInvitationService(client as never);

    const result = await service.listMyJoinRequests();

    expect(result).toEqual({ ok: true, requests: [] });
  });

  test('同じ招待発行の処理中はRPCを二重送信せず完了後は再実行できる', async () => {
    const { client, rpc } = createClient();
    const response = {
      data: [
        {
          invitation_token: INVITATION_TOKEN,
          expires_at: '2026-09-20T12:10:00.000Z',
          requires_approval: false,
        },
      ],
      error: null,
    };
    let resolveFirstRequest!: (value: typeof response) => void;
    rpc
      .mockReturnValueOnce(
        new Promise<typeof response>((resolve) => {
          resolveFirstRequest = resolve;
        }),
      )
      .mockResolvedValueOnce(response);
    const service = createGroupInvitationService(client as never);

    const firstRequest = service.createInvitation(GROUP_ID);
    const duplicateRequest = service.createInvitation(GROUP_ID);

    expect(rpc).toHaveBeenCalledTimes(1);

    resolveFirstRequest(response);
    await expect(firstRequest).resolves.toEqual({
      ok: true,
      invitation: {
        token: INVITATION_TOKEN,
        expiresAt: '2026-09-20T12:10:00.000Z',
        requiresApproval: false,
      },
    });
    await expect(duplicateRequest).resolves.toEqual({
      ok: true,
      invitation: {
        token: INVITATION_TOKEN,
        expiresAt: '2026-09-20T12:10:00.000Z',
        requiresApproval: false,
      },
    });

    await service.createInvitation(GROUP_ID);

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  test('同じ招待コードでも同意内容が異なる処理は共有しない', async () => {
    const { client, rpc } = createClient();
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: databaseError({
          code: 'P0001',
          message: 'consent_required',
        }),
      })
      .mockResolvedValueOnce({
        data: [
          {
            outcome: 'joined',
            group_id: GROUP_ID,
            join_request_id: null,
          },
        ],
        error: null,
      });
    const service = createGroupInvitationService(client as never);

    const withoutConsent = service.redeemInvitation(INVITATION_TOKEN, false);
    const withConsent = service.redeemInvitation(INVITATION_TOKEN, true);

    expect(rpc).toHaveBeenCalledTimes(2);
    await expect(withoutConsent).resolves.toEqual({
      ok: false,
      error: {
        type: 'consent-required',
        message: '共有範囲への同意が必要です。',
      },
    });
    await expect(withConsent).resolves.toEqual({
      ok: true,
      result: { status: 'joined', groupId: GROUP_ID },
    });
  });

  test('同じ申請でも承認と拒否は異なる処理として扱う', async () => {
    const { client, rpc } = createClient();
    rpc
      .mockResolvedValueOnce({ data: 'approved', error: null })
      .mockResolvedValueOnce({ data: 'rejected', error: null });
    const service = createGroupInvitationService(client as never);

    const approval = service.resolveJoinRequest(REQUEST_ID, true);
    const rejection = service.resolveJoinRequest(REQUEST_ID, false);

    expect(rpc).toHaveBeenCalledTimes(2);
    await expect(approval).resolves.toEqual({
      ok: true,
      status: 'approved',
    });
    await expect(rejection).resolves.toEqual({
      ok: true,
      status: 'rejected',
    });
  });
});
