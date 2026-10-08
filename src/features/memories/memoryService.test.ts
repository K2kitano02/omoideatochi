import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { createMemoryService } from './memoryService';

const USER = '33000000-0000-0000-0000-000000000001';
const OTHER = '33000000-0000-0000-0000-000000000002';
const GROUP = '33000000-0000-0000-0000-000000000003';
const GROUP_B = '33000000-0000-0000-0000-000000000004';
const POST = '33000000-0000-0000-0000-000000000005';
const POST_B = '33000000-0000-0000-0000-000000000006';
const PHOTO = '33000000-0000-0000-0000-000000000007';
const TIME = '2026-10-08T01:02:03.123456+00:00';
const personal = {
  post_id: POST,
  author_id: USER,
  author_display_name: '山田太郎',
  kind: 'personal',
  group_id: null,
  photo_id: PHOTO,
  latitude: 0,
  longitude: 1,
  captured_at: TIME,
  memo: null,
  discovery_radius_m: 0,
  created_at: TIME,
};
const group = {
  ...personal,
  kind: 'group',
  group_id: GROUP,
  discovery_radius_m: null,
};
const mappedPersonal = {
  id: POST,
  authorId: USER,
  authorDisplayName: '山田太郎',
  kind: 'personal',
  groupId: null,
  photoId: PHOTO,
  latitude: 0,
  longitude: 1,
  capturedAt: TIME,
  memo: null,
  discoveryRadiusM: 0,
  createdAt: TIME,
};
const response = (data: unknown, error: unknown = null) => ({
  data,
  error,
  count: null,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
});
const makeSession = (id = USER): Session => ({
  access_token: 'test-only-access',
  refresh_token: 'test-only-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: TIME,
    email: 'fixture@example.test',
  },
});
const createMockMemoryClient = () => {
  let current: Session | null = makeSession();
  let callback!: (event: AuthChangeEvent, session: Session | null) => void;
  const rpc = jest.fn().mockResolvedValue(response([]));
  const from = jest.fn();
  const unsubscribe = jest.fn();
  const getSession = jest.fn().mockImplementation(async () => ({
    data: { session: current },
    error: null,
  }));
  const onAuthStateChange = jest.fn().mockImplementation((listener) => {
    callback = listener;
    return { data: { subscription: { unsubscribe } } };
  });
  return {
    client: {
      rpc,
      from,
      auth: { getSession, onAuthStateChange },
    } as unknown as SupabaseClient,
    rpc,
    from,
    getSession,
    onAuthStateChange,
    unsubscribe,
    setSession: (session: Session | null) => {
      current = session;
    },
    emitAuth: (event: AuthChangeEvent, session: Session | null) => {
      current = session;
      callback(event, session);
    },
  };
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};
const services: ReturnType<typeof createMemoryService>[] = [];
const setup = () => {
  const mock = createMockMemoryClient();
  const service = createMemoryService(mock.client);
  services.push(service);
  return { ...mock, service, reader: service.createReadScope() };
};
afterEach(() => {
  services.splice(0).forEach((service) => service.dispose());
  jest.restoreAllMocks();
});

test('本人一覧を固定列の画面データへ変換する', async () => {
  const { rpc, reader, from } = setup();
  rpc.mockResolvedValue(
    response([
      {
        ...personal,
        object_key: 'test-only-private',
        signed_url: 'test-only-url',
      },
    ]),
  );
  expect(await reader.listPersonalPosts()).toEqual({
    ok: true,
    data: { posts: [mappedPersonal], nextCursor: null },
  });
  expect(rpc).toHaveBeenCalledWith('get_personal_memory_posts', {
    p_limit: 50,
  });
  expect(from).not.toHaveBeenCalled();
});
test('指定グループの一覧をRPCで取得する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response([group]));
  expect(await reader.listGroupPosts(GROUP)).toMatchObject({
    ok: true,
    data: {
      posts: [{ kind: 'group', groupId: GROUP, discoveryRadiusM: null }],
      nextCursor: null,
    },
  });
  expect(rpc).toHaveBeenCalledWith('get_group_memory_posts', {
    p_group_id: GROUP,
    p_limit: 50,
  });
});
test('指定IDの詳細を1行から取得する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response([personal]));
  expect(await reader.getPost(POST)).toEqual({
    ok: true,
    data: mappedPersonal,
  });
  expect(rpc).toHaveBeenCalledWith('get_memory_post', { p_post_id: POST });
});
test('地図は最小6項目で選択グループだけを取得する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response([group]));
  expect(await reader.listMapPosts([GROUP, GROUP.toUpperCase()])).toEqual({
    ok: true,
    data: {
      posts: [
        {
          id: POST,
          kind: 'group',
          groupId: GROUP,
          latitude: 0,
          longitude: 1,
          createdAt: TIME,
        },
      ],
      nextCursor: null,
    },
  });
  expect(rpc).toHaveBeenCalledWith('get_memory_map_posts', {
    p_group_ids: [GROUP],
    p_limit: 50,
  });
});
test('地図の初期選択は本人だけで空一覧も成功', async () => {
  const { rpc, reader } = setup();
  expect(await reader.listMapPosts()).toEqual({
    ok: true,
    data: { posts: [], nextCursor: null },
  });
  expect(rpc).toHaveBeenCalledWith('get_memory_map_posts', {
    p_group_ids: [],
    p_limit: 50,
  });
  expect(await reader.listPersonalPosts()).toEqual({
    ok: true,
    data: { posts: [], nextCursor: null },
  });
  expect(await reader.listGroupPosts(GROUP)).toEqual({
    ok: true,
    data: { posts: [], nextCursor: null },
  });
});
test('マイクロ秒の順序とカーソルを丸めずに保持する', async () => {
  const { rpc, reader } = setup();
  rpc
    .mockResolvedValueOnce(
      response([
        { ...personal, created_at: '2026-10-08T01:02:03.123457+00:00' },
        { ...personal, post_id: POST_B },
      ]),
    )
    .mockResolvedValueOnce(response([]));
  const first = await reader.listPersonalPosts({ limit: 2 });
  expect(first).toMatchObject({
    ok: true,
    data: { nextCursor: { id: POST_B, createdAt: TIME } },
  });
  if (!first.ok) throw new Error('expected success');
  expect(
    await reader.listPersonalPosts({ limit: 2, cursor: first.data.nextCursor }),
  ).toEqual({
    ok: true,
    data: { posts: [], nextCursor: null },
  });
  expect(rpc).toHaveBeenLastCalledWith('get_personal_memory_posts', {
    p_limit: 2,
    p_before_created_at: TIME,
    p_before_id: POST_B,
  });
});
test('同一UTC時刻ならUUID降順で検証する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(
    response([
      { ...personal, post_id: POST_B },
      { ...personal, created_at: '2026-10-08T02:02:03.123456+01:00' },
    ]),
  );
  expect(await reader.listPersonalPosts({ limit: 2 })).toMatchObject({
    ok: true,
    data: {
      nextCursor: { id: POST, createdAt: '2026-10-08T02:02:03.123456+01:00' },
    },
  });
});
test.each([
  ['personal', [{ ...personal, author_id: OTHER }]],
  ['personal', [group]],
  ['group', [personal]],
  ['group', [{ ...group, group_id: GROUP_B }]],
  ['detail', []],
  ['detail', [personal, personal]],
  ['detail', [{ ...personal, post_id: POST_B }]],
  ['map', [group]],
  ['personal', [{ ...personal, longitude: NaN }]],
  ['personal', null],
  ['personal', [personal, personal]],
  [
    'personal',
    [
      personal,
      { ...personal, post_id: POST_B, created_at: '2026-10-09T00:00:00Z' },
    ],
  ],
] as const)('対象外または不正な%s応答を全体拒否する', async (method, data) => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response(data));
  const result =
    method === 'personal'
      ? await reader.listPersonalPosts()
      : method === 'group'
        ? await reader.listGroupPosts(GROUP)
        : method === 'map'
          ? await reader.listMapPosts()
          : await reader.getPost(POST);
  expect(result).toMatchObject({
    ok: false,
    error: { type: 'invalid-response' },
  });
});
test('指定件数を超える応答を拒否する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response([personal, { ...personal, post_id: POST_B }]));
  expect(await reader.listPersonalPosts({ limit: 1 })).toMatchObject({
    ok: false,
    error: { type: 'invalid-response' },
  });
});
test('カーソルより新しい行を含む次ページを拒否する', async () => {
  const { rpc, reader } = setup();
  rpc.mockResolvedValue(response([personal]));
  expect(
    await reader.listPersonalPosts({ cursor: { id: POST, createdAt: TIME } }),
  ).toMatchObject({
    ok: false,
    error: { type: 'invalid-response' },
  });
});
test('不正入力ではRPCを呼ばない', async () => {
  const { rpc, reader } = setup();
  const results = await Promise.all([
    reader.listPersonalPosts({ limit: 201 }),
    reader.listGroupPosts('bad'),
    reader.getPost('bad'),
    reader.listMapPosts([null] as never),
    reader.listMapPosts([[GROUP]] as never),
  ]);
  expect(results[results.length - 1]).toMatchObject({
    ok: false,
    error: { type: 'invalid-argument' },
  });
  expect(rpc).not.toHaveBeenCalled();
});
test.each([
  ['28000', 'authentication_required', 'unauthenticated'],
  ['PGRST301', 'expired', 'unauthenticated'],
  ['42501', 'permission_denied timeout', 'permission-denied'],
  ['22023', 'invalid_pagination', 'invalid-argument'],
  ['22023', 'invalid_group_selection', 'invalid-argument'],
  ['P0001', 'memory_not_found', 'not-found'],
  ['', 'permission_denied', 'permission-denied'],
  ['', 'authentication_required', 'unauthenticated'],
  ['', 'memory_not_found', 'not-found'],
  ['', 'invalid_group_selection', 'invalid-argument'],
  ['XX000', 'fetch failed', 'network'],
  ['XX000', 'internal test-only-secret', 'unexpected'],
])('エラー%s/%sを%sへ安全に変換する', async (code, message, type) => {
  const { rpc, reader } = setup();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  rpc.mockResolvedValue(
    response(null, {
      code,
      message,
      details: 'test-only-secret',
      hint: 'private SQL',
    }),
  );
  const result = await reader.getPost(POST);
  expect(result).toMatchObject({ ok: false, error: { type } });
  expect(JSON.stringify(result)).not.toContain('test-only-secret');
  expect(log).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
test.each(['Network request failed', 'The request timed out.', 'fetch failed'])(
  '通信例外%sを分類する',
  async (message) => {
    const { rpc, reader } = setup();
    rpc.mockRejectedValue(new Error(message));
    expect(await reader.getPost(POST)).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  },
);
test('ログインなしなら通信せず再ログインを案内する', async () => {
  const { rpc, reader, setSession } = setup();
  setSession(null);
  expect(await reader.getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'unauthenticated' },
  });
  expect(rpc).not.toHaveBeenCalled();
});
test('不正なセッション形を拒否する', async () => {
  const { reader, rpc, getSession } = setup();
  getSession.mockResolvedValue({ data: { session: {} }, error: null });
  expect(await reader.getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'invalid-response' },
  });
  expect(rpc).not.toHaveBeenCalled();
});
test('セッション確認の通信失敗も分類する', async () => {
  const { reader, getSession } = setup();
  getSession.mockRejectedValue(new Error('fetch failed'));
  expect(await reader.getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'network' },
  });
});
test.each(['success', 'permission', 'exception'])(
  '切替後の旧%sを新しい画面へ渡さない',
  async (kind) => {
    const { rpc, reader } = setup();
    const delay = deferred<ReturnType<typeof response>>();
    rpc
      .mockReturnValueOnce(delay.promise)
      .mockResolvedValueOnce(response([{ ...group, group_id: GROUP_B }]));
    const old = reader.listGroupPosts(GROUP);
    await flush();
    reader.invalidate();
    const fresh = await reader.listGroupPosts(GROUP_B);
    expect(fresh).toMatchObject({
      ok: true,
      data: { posts: [{ groupId: GROUP_B }] },
    });
    if (kind === 'exception') delay.reject(new Error('fetch failed'));
    else
      delay.resolve(
        response(
          [group],
          kind === 'permission'
            ? { code: '42501', message: 'permission_denied' }
            : null,
        ),
      );
    expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
  },
);
test('個人からグループへ切り替えると個人の旧応答は捨てる', async () => {
  const { rpc, reader } = setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc
    .mockReturnValueOnce(delay.promise)
    .mockResolvedValueOnce(response([group]));
  const old = reader.listPersonalPosts();
  await flush();
  expect(await reader.listGroupPosts(GROUP)).toMatchObject({ ok: true });
  delay.resolve(response([personal]));
  expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
});
test('地図選択を変更すると旧地図応答は捨てる', async () => {
  const { rpc, reader } = setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc.mockReturnValueOnce(delay.promise).mockResolvedValueOnce(response([]));
  const old = reader.listMapPosts([GROUP]);
  await flush();
  expect(await reader.listMapPosts([GROUP_B])).toMatchObject({ ok: true });
  delay.resolve(response([group]));
  expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
});
test.each(['logout', 'different', 'same'])(
  'RPC待機中の%sは旧応答を無効化する',
  async (kind) => {
    const { rpc, reader, emitAuth } = setup();
    const delay = deferred<ReturnType<typeof response>>();
    rpc.mockReturnValue(delay.promise);
    const old = reader.getPost(POST);
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1);
    if (kind === 'different') emitAuth('SIGNED_IN', makeSession(OTHER));
    else {
      emitAuth('SIGNED_OUT', null);
      if (kind === 'same') emitAuth('SIGNED_IN', makeSession());
    }
    delay.resolve(response([personal]));
    expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
  },
);
test('認証確認中のログアウト・同一人再ログインでも通信しない', async () => {
  const { rpc, reader, getSession, emitAuth } = setup();
  const delay = deferred<{ data: { session: Session }; error: null }>();
  getSession.mockReturnValueOnce(delay.promise);
  const old = reader.getPost(POST);
  emitAuth('SIGNED_OUT', null);
  emitAuth('SIGNED_IN', makeSession());
  delay.resolve({ data: { session: makeSession() }, error: null });
  expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
  expect(rpc).not.toHaveBeenCalled();
});
test('終了時にセッションが変わってもイベントなしで旧応答を拒否する', async () => {
  const { rpc, reader, setSession } = setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc.mockReturnValueOnce(delay.promise);
  const old = reader.getPost(POST);
  await flush();
  setSession(makeSession(OTHER));
  delay.resolve(response([personal]));
  expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
});
test('通常の初期通知・同一人ログイン通知・トークン更新では破棄しない', async () => {
  const { rpc, reader, emitAuth } = setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc.mockReturnValueOnce(delay.promise);
  const old = reader.getPost(POST);
  await flush();
  emitAuth('INITIAL_SESSION', makeSession());
  emitAuth('SIGNED_IN', makeSession());
  emitAuth('TOKEN_REFRESHED', makeSession());
  delay.resolve(response([personal]));
  expect(await old).toEqual({ ok: true, data: mappedPersonal });
});
test('入力配列とカーソルの後からの変更は通信条件に混ぜない', async () => {
  const { rpc, reader } = setup();
  const ids = [GROUP];
  const cursor = { id: POST_B, createdAt: TIME };
  const pending = reader.listMapPosts(ids, { cursor });
  ids[0] = GROUP_B;
  cursor.createdAt = 'bad';
  cursor.id = POST;
  await pending;
  expect(rpc).toHaveBeenCalledWith('get_memory_map_posts', {
    p_group_ids: [GROUP],
    p_limit: 50,
    p_before_created_at: TIME,
    p_before_id: POST_B,
  });
});
test('別readerは独立して取得し、認証監視はサービスに一つだけ', async () => {
  const { rpc, reader, service, onAuthStateChange, getSession, emitAuth } =
    setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc.mockReturnValueOnce(delay.promise).mockResolvedValueOnce(response([]));
  const old = reader.listPersonalPosts();
  await flush();
  expect(await service.createReadScope().listGroupPosts(GROUP)).toMatchObject({
    ok: true,
  });
  delay.resolve(response([personal]));
  expect(await old).toMatchObject({ ok: true });
  expect(onAuthStateChange).toHaveBeenCalledTimes(1);
  const calls = getSession.mock.calls.length;
  emitAuth('TOKEN_REFRESHED', makeSession());
  expect(getSession).toHaveBeenCalledTimes(calls);
});
test('サービス破棄は監視を解除し全readerの要求を止める', async () => {
  const { rpc, reader, service, unsubscribe } = setup();
  const delay = deferred<ReturnType<typeof response>>();
  rpc.mockReturnValueOnce(delay.promise);
  const old = reader.getPost(POST);
  await flush();
  service.dispose();
  service.dispose();
  delay.resolve(response([personal]));
  expect(await old).toMatchObject({ ok: false, error: { type: 'stale' } });
  expect(await service.createReadScope().getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'stale' },
  });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('reader破棄はその要求だけ止める', async () => {
  const { rpc, reader, service, unsubscribe } = setup();
  reader.dispose();
  expect(await reader.getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'stale' },
  });
  expect(rpc).not.toHaveBeenCalled();
  expect(await service.createReadScope().listPersonalPosts()).toMatchObject({
    ok: true,
  });
  expect(unsubscribe).not.toHaveBeenCalled();
});

test('認証確認後でも返却直前のログアウトを無効化する', async () => {
  const { rpc, reader, emitAuth } = setup();
  rpc.mockResolvedValue({
    error: null,
    get data() {
      void Promise.resolve().then(() => emitAuth('SIGNED_OUT', null));
      return [personal];
    },
  });
  expect(await reader.getPost(POST)).toMatchObject({
    ok: false,
    error: { type: 'stale' },
  });
});
