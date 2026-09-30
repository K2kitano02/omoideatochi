import { createFriendService, normalizeFriendCode } from './friendService';

const FRIEND_CODE = 'AB12CD34EF56AB78';
const REQUEST_ID = '29000000-0000-0000-0000-000000000001';
const RELATIONSHIP_ID = '29000000-0000-0000-0000-000000000002';

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
  hint: 'select * from private.friend_relationships',
  ...overrides,
});

const createClient = () => {
  const rpc = jest.fn();

  return {
    client: { rpc },
    rpc,
  };
};

const successResponse = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
});

describe('normalizeFriendCode', () => {
  test('前後の空白を除去して英字を大文字へ統一する', () => {
    expect(normalizeFriendCode('  ab12cd34ef56ab78  ')).toBe(
      'AB12CD34EF56AB78',
    );
  });

  test('内部の空白や記号は入力ミスとして保持する', () => {
    expect(normalizeFriendCode('ab12 cd34-ef56')).toBe('AB12 CD34-EF56');
  });
});

describe('createFriendService', () => {
  test('自分のフレンドコードを取得する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(FRIEND_CODE));
    const service = createFriendService(client as never);

    const result = await service.getMyFriendCode();

    expect(rpc).toHaveBeenCalledWith('get_my_friend_code');
    expect(result).toEqual({ ok: true, code: FRIEND_CODE });
  });

  test('自分のフレンドコードを再発行する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(FRIEND_CODE));
    const service = createFriendService(client as never);

    const result = await service.regenerateMyFriendCode();

    expect(rpc).toHaveBeenCalledWith('regenerate_my_friend_code');
    expect(result).toEqual({ ok: true, code: FRIEND_CODE });
  });

  test('正規化したコードで申請先の表示名を確認する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse([{ display_name: '山田太郎' }]));
    const service = createFriendService(client as never);

    const result = await service.previewFriendCode('  ab12cd34ef56ab78  ');

    expect(rpc).toHaveBeenCalledWith('preview_friend_code', {
      p_code: FRIEND_CODE,
    });
    expect(result).toEqual({
      ok: true,
      user: { displayName: '山田太郎' },
    });
  });

  test('正規化したコードでフレンド申請を送信する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(REQUEST_ID));
    const service = createFriendService(client as never);

    const result = await service.createFriendRequest('  ab12cd34ef56ab78  ');

    expect(rpc).toHaveBeenCalledWith('create_friend_request', {
      p_code: FRIEND_CODE,
    });
    expect(result).toEqual({ ok: true, requestId: REQUEST_ID });
  });

  test('受信申請を画面用の共通ユーザー形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          request_id: REQUEST_ID,
          requester_display_name: '申請した人',
          created_at: '2026-09-30T01:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listReceivedFriendRequests();

    expect(rpc).toHaveBeenCalledWith('list_received_friend_requests');
    expect(result).toEqual({
      ok: true,
      requests: [
        {
          requestId: REQUEST_ID,
          user: { displayName: '申請した人' },
          createdAt: '2026-09-30T01:00:00.000Z',
        },
      ],
    });
  });

  test('送信申請を画面用の共通ユーザー形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          request_id: REQUEST_ID,
          recipient_display_name: '受け取る人',
          created_at: '2026-09-30T02:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listSentFriendRequests();

    expect(rpc).toHaveBeenCalledWith('list_sent_friend_requests');
    expect(result).toEqual({
      ok: true,
      requests: [
        {
          requestId: REQUEST_ID,
          user: { displayName: '受け取る人' },
          createdAt: '2026-09-30T02:00:00.000Z',
        },
      ],
    });
  });

  test.each([
    { accept: true, status: 'accepted' },
    { accept: false, status: 'rejected' },
  ] as const)('受信申請を$statusへ変更する', async ({ accept, status }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(status));
    const service = createFriendService(client as never);

    const result = await service.resolveFriendRequest(REQUEST_ID, accept);

    expect(rpc).toHaveBeenCalledWith('resolve_friend_request', {
      p_request_id: REQUEST_ID,
      p_accept: accept,
    });
    expect(result).toEqual({ ok: true, status });
  });

  test('成立済みフレンドを画面用の共通ユーザー形式へ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          relationship_id: RELATIONSHIP_ID,
          display_name: 'フレンド',
          accepted_at: '2026-09-30T03:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listFriends();

    expect(rpc).toHaveBeenCalledWith('list_friends');
    expect(result).toEqual({
      ok: true,
      friends: [
        {
          relationshipId: RELATIONSHIP_ID,
          user: { displayName: 'フレンド' },
          acceptedAt: '2026-09-30T03:00:00.000Z',
        },
      ],
    });
  });

  test('関係IDを使ってフレンドを解除する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(null));
    const service = createFriendService(client as never);

    const result = await service.removeFriend(RELATIONSHIP_ID);

    expect(rpc).toHaveBeenCalledWith('remove_friend', {
      p_relationship_id: RELATIONSHIP_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  test.each([
    {
      name: '未認証',
      operation: 'create',
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
      name: '存在しないコード',
      operation: 'preview',
      error: databaseError({
        code: 'P0001',
        message: 'friend_code_not_found',
      }),
      expected: {
        type: 'friend-code-not-found',
        message: 'フレンドコードが見つかりません。入力内容を確認してください。',
      },
    },
    {
      name: '自分自身への申請',
      operation: 'create',
      error: databaseError({
        code: 'P0001',
        message: 'cannot_friend_self',
      }),
      expected: {
        type: 'cannot-friend-self',
        message: '自分自身へフレンド申請は送れません。',
      },
    },
    {
      name: '重複申請',
      operation: 'create',
      error: databaseError({
        code: 'P0001',
        message: 'friend_request_already_pending',
      }),
      expected: {
        type: 'request-already-pending',
        message: 'このユーザーへのフレンド申請はすでに処理待ちです。',
      },
    },
    {
      name: '成立済みフレンド',
      operation: 'create',
      error: databaseError({
        code: 'P0001',
        message: 'already_friends',
      }),
      expected: {
        type: 'already-friends',
        message: 'このユーザーとはすでにフレンドです。',
      },
    },
    {
      name: '処理済み申請',
      operation: 'resolve',
      error: databaseError({
        code: 'P0001',
        message: 'request_not_pending',
      }),
      expected: {
        type: 'request-not-pending',
        message: 'このフレンド申請はすでに処理されています。',
      },
    },
    {
      name: '権限不足',
      operation: 'remove',
      error: databaseError({
        code: '42501',
        message: 'permission_denied',
      }),
      expected: {
        type: 'permission-denied',
        message: 'このフレンド情報を操作する権限がありません。',
      },
    },
    {
      name: '入力不正',
      operation: 'resolve',
      error: databaseError({
        code: '22023',
        message: 'invalid_argument',
      }),
      expected: {
        type: 'invalid-argument',
        message: '入力内容が正しくありません。',
      },
    },
  ])(
    '$nameを安全な画面用エラーへ変換する',
    async ({ operation, error, expected }) => {
      const { client, rpc } = createClient();
      rpc.mockResolvedValue({
        data: null,
        error,
        count: null,
        status: 400,
        statusText: 'Bad Request',
      });
      const service = createFriendService(client as never);

      const result =
        operation === 'preview'
          ? await service.previewFriendCode(FRIEND_CODE)
          : operation === 'resolve'
            ? await service.resolveFriendRequest(REQUEST_ID, true)
            : operation === 'remove'
              ? await service.removeFriend(RELATIONSHIP_ID)
              : await service.createFriendRequest(FRIEND_CODE);

      expect(result).toEqual({ ok: false, error: expected });
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(JSON.stringify(result)).not.toContain('select *');
    },
  );

  test('通信例外を画面用の通信エラーへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockRejectedValue(new TypeError('Network request failed'));
    const service = createFriendService(client as never);

    const result = await service.listFriends();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });

  test('RPCがerrorとして返した通信失敗も画面用の通信エラーへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '',
        message: 'TypeError: Failed to fetch',
        details: 'TypeError: Network request failed',
        hint: '',
      },
      count: null,
      status: 0,
      statusText: '',
    });
    const service = createFriendService(client as never);

    const result = await service.listFriends();

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
    rpc.mockResolvedValue({
      data: null,
      error: databaseError(),
      count: null,
      status: 500,
      statusText: 'Internal Server Error',
    });
    const service = createFriendService(client as never);

    const result = await service.getMyFriendCode();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'フレンド情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test('不正なDB応答と内部ユーザーUUIDを画面へ渡さない', async () => {
    const internalUserId = '00000000-0000-0000-0000-000000009999';
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          request_id: REQUEST_ID,
          requester_display_name: null,
          requester_id: internalUserId,
          created_at: '2026-09-30T01:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listReceivedFriendRequests();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'フレンド情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain(internalUserId);
  });

  test.each([
    {
      name: '不正なフレンドコード',
      data: 'not-a-friend-code',
      run: (service: ReturnType<typeof createFriendService>) =>
        service.getMyFriendCode(),
    },
    {
      name: '不正な申請ID',
      data: 'not-a-request-id',
      run: (service: ReturnType<typeof createFriendService>) =>
        service.createFriendRequest(FRIEND_CODE),
    },
    {
      name: '不正な申請状態',
      data: 'pending',
      run: (service: ReturnType<typeof createFriendService>) =>
        service.resolveFriendRequest(REQUEST_ID, true),
    },
    {
      name: '解除RPCの不正な戻り値',
      data: 'deleted',
      run: (service: ReturnType<typeof createFriendService>) =>
        service.removeFriend(RELATIONSHIP_ID),
    },
  ])('$nameを成功扱いにしない', async ({ data, run }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse(data));
    const service = createFriendService(client as never);

    const result = await run(service);

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'フレンド情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
  });

  test('一覧内の不正な申請IDを成功扱いにしない', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          request_id: 'not-a-request-id',
          requester_display_name: '申請した人',
          created_at: '2026-09-30T01:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listReceivedFriendRequests();

    expect(result).toMatchObject({
      ok: false,
      error: { type: 'unexpected' },
    });
  });

  test('一覧内の不正な関係IDを成功扱いにしない', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(
      successResponse([
        {
          relationship_id: 'not-a-relationship-id',
          display_name: 'フレンド',
          accepted_at: '2026-09-30T03:00:00.000Z',
        },
      ]),
    );
    const service = createFriendService(client as never);

    const result = await service.listFriends();

    expect(result).toMatchObject({
      ok: false,
      error: { type: 'unexpected' },
    });
  });

  test('申請とフレンドの一覧が空なら正常な空配列を返す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue(successResponse([]));
    const service = createFriendService(client as never);

    await expect(service.listReceivedFriendRequests()).resolves.toEqual({
      ok: true,
      requests: [],
    });
    await expect(service.listFriends()).resolves.toEqual({
      ok: true,
      friends: [],
    });
  });

  test('同じフレンド申請の処理中はRPCを二重送信せず完了後は再実行できる', async () => {
    const { client, rpc } = createClient();
    const response = successResponse(REQUEST_ID);
    let resolveFirstRequest!: (value: typeof response) => void;
    rpc
      .mockReturnValueOnce(
        new Promise<typeof response>((resolve) => {
          resolveFirstRequest = resolve;
        }),
      )
      .mockResolvedValueOnce(response);
    const service = createFriendService(client as never);

    const firstRequest = service.createFriendRequest(FRIEND_CODE);
    const duplicateRequest = service.createFriendRequest(
      `  ${FRIEND_CODE.toLowerCase()}  `,
    );

    expect(rpc).toHaveBeenCalledTimes(1);

    resolveFirstRequest(response);
    await expect(firstRequest).resolves.toEqual({
      ok: true,
      requestId: REQUEST_ID,
    });
    await expect(duplicateRequest).resolves.toEqual({
      ok: true,
      requestId: REQUEST_ID,
    });

    await service.createFriendRequest(FRIEND_CODE);

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  test('同じ申請でも承認と拒否は別の変更処理として送信する', async () => {
    const { client, rpc } = createClient();
    rpc
      .mockResolvedValueOnce(successResponse('accepted'))
      .mockResolvedValueOnce(successResponse('rejected'));
    const service = createFriendService(client as never);

    const approval = service.resolveFriendRequest(REQUEST_ID, true);
    const rejection = service.resolveFriendRequest(REQUEST_ID, false);

    expect(rpc).toHaveBeenCalledTimes(2);
    await expect(approval).resolves.toEqual({
      ok: true,
      status: 'accepted',
    });
    await expect(rejection).resolves.toEqual({
      ok: true,
      status: 'rejected',
    });
  });
});
