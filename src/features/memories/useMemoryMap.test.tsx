import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createMemoryReadScope } from './memoryReadScope';
import {
  memoryFailure,
  type MemoryMapPost,
  type MemoryPage,
  type MemoryReadResult,
} from './memoryTypes';
import { useMemoryMap } from './useMemoryMap';

const GROUP = '35000000-0000-0000-0000-000000000001';
const groups = [
  {
    id: GROUP,
    name: '旅の思い出',
    createdBy: 'fixture',
    createdAt: '2026-10-10T00:00:00Z',
  },
];
const post = (id: string, groupId: string | null = null): MemoryMapPost => ({
  id,
  latitude: 0,
  longitude: 0,
  createdAt: '2026-10-10T00:00:00Z',
  ...(groupId
    ? { kind: 'group', groupId }
    : { kind: 'personal', groupId: null }),
});
const success = (
  posts: MemoryMapPost[],
  nextCursor: MemoryPage<MemoryMapPost>['nextCursor'] = null,
): MemoryReadResult<MemoryPage<MemoryMapPost>> => ({
  ok: true,
  data: { posts, nextCursor },
});
const deferred = () => {
  let resolve!: (result: MemoryReadResult<MemoryPage<MemoryMapPost>>) => void;
  const promise = new Promise<MemoryReadResult<MemoryPage<MemoryMapPost>>>(
    (yes) => {
      resolve = yes;
    },
  );
  return { promise, resolve };
};
const setup = async () => {
  const listGroups = jest.fn().mockResolvedValue({ ok: true, groups });
  const listMapPosts = jest
    .fn<
      Promise<MemoryReadResult<MemoryPage<MemoryMapPost>>>,
      [ids?: readonly string[], options?: unknown]
    >()
    .mockResolvedValue(success([post('personal')]));
  const memoryService = {
    createReadScope: () => {
      const scope = createMemoryReadScope();
      return {
        ...scope,
        listMapPosts: (ids?: readonly string[], options?: unknown) =>
          scope.run(() => listMapPosts(ids, options)),
      };
    },
  };
  const groupService = { listGroups };
  const hook = await renderHook<
    ReturnType<typeof useMemoryMap>,
    { focused: boolean }
  >(
    ({ focused }) =>
      useMemoryMap({ isFocused: focused, groupService, memoryService }),
    { initialProps: { focused: true } },
  );
  return { ...hook, listGroups, listMapPosts };
};

test('初期状態では本人投稿だけを取得し、選択したグループを追加する', async () => {
  const view = await setup();
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual(['personal']),
  );
  expect(view.listMapPosts).toHaveBeenLastCalledWith([], undefined);
  view.listMapPosts.mockResolvedValue(
    success([post('personal'), post('group', GROUP)]),
  );
  await act(() => view.result.current.toggleGroup(GROUP));
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual([
      'personal',
      'group',
    ]),
  );
  expect(view.result.current.selectedGroupIds).toEqual([GROUP]);
  expect(view.listMapPosts).toHaveBeenLastCalledWith([GROUP], undefined);
});

test('グループを外すと旧表示を消し、遅い旧応答も混ぜない', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const delay = deferred();
  view.listMapPosts.mockReturnValueOnce(delay.promise);
  await act(() => view.result.current.toggleGroup(GROUP));
  expect(view.result.current.posts).toEqual([]);
  await act(() => view.result.current.toggleGroup(GROUP));
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual(['personal']),
  );
  await act(() => delay.resolve(success([post('old-group', GROUP)])));
  expect(view.result.current.posts.map((p) => p.id)).toEqual(['personal']);
});

test('再取得で退出済みグループの選択と投稿を除去する', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  view.listMapPosts.mockResolvedValueOnce(
    success([post('personal'), post('group', GROUP)]),
  );
  await act(() => view.result.current.toggleGroup(GROUP));
  await waitFor(() => expect(view.result.current.posts).toHaveLength(2));
  view.listGroups.mockResolvedValue({ ok: true, groups: [] });
  await act(() => view.result.current.refresh());
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual(['personal']),
  );
  expect(view.result.current.selectedGroupIds).toEqual([]);
});

test('権限拒否や通信失敗では古い投稿を残さず、再試行できる', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.posts).toHaveLength(1));
  view.listMapPosts.mockResolvedValueOnce(memoryFailure('permission-denied'));
  await act(() => view.result.current.refresh());
  await waitFor(() => expect(view.result.current.error).toBeTruthy());
  expect(view.result.current.posts).toEqual([]);
  await act(() => view.result.current.refresh());
  await waitFor(() => expect(view.result.current.posts).toHaveLength(1));
});

test('続きの投稿を追加し、選択変更後に遅れて届く続きは破棄する', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const cursor = { id: 'first', createdAt: '2026-10-10T00:00:00Z' };
  view.listMapPosts.mockResolvedValueOnce(success([post('first')], cursor));
  await act(() => view.result.current.refresh());
  view.listMapPosts.mockResolvedValueOnce(success([post('second')]));
  await act(() => view.result.current.loadMore());
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual([
      'first',
      'second',
    ]),
  );
  expect(view.listMapPosts).toHaveBeenLastCalledWith([], { cursor });
  view.listMapPosts.mockResolvedValueOnce(success([post('first')], cursor));
  await act(() => view.result.current.refresh());
  const delay = deferred();
  view.listMapPosts.mockReturnValueOnce(delay.promise);
  await act(() => {
    void view.result.current.loadMore();
  });
  await act(() => view.result.current.toggleGroup(GROUP));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(() => delay.resolve(success([post('old-page')])));
  expect(view.result.current.posts.some((p) => p.id === 'old-page')).toBe(
    false,
  );
});

test('離れた画面には旧応答を反映せず、復帰時に再取得する', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const delay = deferred();
  view.listMapPosts.mockReturnValueOnce(delay.promise);
  await act(() => {
    void view.result.current.refresh();
  });
  await view.rerender({ focused: false });
  await act(() => delay.resolve(success([post('old')])));
  expect(view.result.current.posts).toEqual([]);
  await view.rerender({ focused: true });
  await waitFor(() =>
    expect(view.result.current.posts.map((p) => p.id)).toEqual(['personal']),
  );
});

test('続きの通信失敗は取得済み投稿を保持し、同じカーソルで再試行する', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const cursor = { id: 'first', createdAt: '2026-10-10T00:00:00Z' };
  view.listMapPosts.mockResolvedValueOnce(success([post('first')], cursor));
  await act(() => view.result.current.refresh());
  view.listMapPosts.mockResolvedValueOnce(memoryFailure('network'));
  await act(() => view.result.current.loadMore());
  expect(view.result.current.posts.map((p) => p.id)).toEqual(['first']);
  expect(view.result.current.nextCursor).toEqual(cursor);
  expect(view.result.current.moreError).toBeTruthy();
  expect(view.result.current.loadingMore).toBe(false);
  view.listMapPosts.mockResolvedValueOnce(success([post('second')]));
  await act(() => view.result.current.loadMore());
  expect(view.listMapPosts).toHaveBeenLastCalledWith([], { cursor });
  expect(view.result.current.posts.map((p) => p.id)).toEqual([
    'first',
    'second',
  ]);
  expect(view.result.current.moreError).toBeNull();
});

test('続きの権限拒否では取得済み投稿とカーソルも消す', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const cursor = { id: 'first', createdAt: '2026-10-10T00:00:00Z' };
  view.listMapPosts.mockResolvedValueOnce(success([post('first')], cursor));
  await act(() => view.result.current.refresh());
  view.listMapPosts.mockResolvedValueOnce(memoryFailure('permission-denied'));
  await act(() => view.result.current.loadMore());
  expect(view.result.current.posts).toEqual([]);
  expect(view.result.current.nextCursor).toBeNull();
  expect(view.result.current.error).toBeTruthy();
});

test('所属グループ確認中のチェック操作で退出確認を取り消さない', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(() => view.result.current.toggleGroup(GROUP));
  let finish!: (value: { ok: true; groups: typeof groups }) => void;
  view.listGroups.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await act(() => {
    void view.result.current.refresh();
  });
  await act(() => view.result.current.toggleGroup(GROUP));
  await act(() => finish({ ok: true, groups: [] }));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.groups).toEqual([]);
  expect(view.result.current.selectedGroupIds).toEqual([]);
});
