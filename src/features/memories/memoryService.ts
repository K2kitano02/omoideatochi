import type { SupabaseClient } from '@supabase/supabase-js';
import { createMemoryReadScope, type MemoryReadScope } from './memoryReadScope';
import {
  getMemoryTimestampMicros,
  isMemoryRecord,
  isMemoryUuid,
  memoryFailure,
  normalizeMemoryGroupIds,
  parseMemoryMapPost,
  parseMemoryPageOptions,
  parseMemoryPost,
  type MemoryCursor,
  type MemoryMapPost,
  type MemoryPage,
  type MemoryPageOptions,
  type MemoryPost,
  type MemoryReadResult,
  type NormalizedMemoryPageOptions,
} from './memoryTypes';

const toFailure = (error: unknown) => {
  const code = isMemoryRecord(error) ? error.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : isMemoryRecord(error) && typeof error.message === 'string'
        ? error.message
        : '';
  if (
    code === '28000' ||
    code === 'PGRST301' ||
    message === 'authentication_required'
  )
    return memoryFailure('unauthenticated');
  if (code === '42501' || message === 'permission_denied')
    return memoryFailure('permission-denied');
  if (
    code === '22023' ||
    message === 'invalid_pagination' ||
    message === 'invalid_group_selection'
  )
    return memoryFailure('invalid-argument');
  if ((code === 'P0001' || !code) && message === 'memory_not_found')
    return memoryFailure('not-found');
  return memoryFailure(
    /fetch|network|timed?\s*out|timeout/i.test(message)
      ? 'network'
      : 'unexpected',
  );
};

const compareCursors = (first: MemoryCursor, second: MemoryCursor): number => {
  const a = getMemoryTimestampMicros(first.createdAt);
  const b = getMemoryTimestampMicros(second.createdAt);
  if (a === null || b === null) return NaN;
  if (a !== b) return a > b ? 1 : -1;
  return first.id === second.id ? 0 : first.id > second.id ? 1 : -1;
};

const pageArgs = (
  page: NormalizedMemoryPageOptions,
): Record<string, unknown> => ({
  p_limit: page.limit,
  ...(page.cursor
    ? {
        p_before_created_at: page.cursor.createdAt,
        p_before_id: page.cursor.id,
      }
    : {}),
});

const readPage = <T extends { id: string; createdAt: string }>(
  data: unknown,
  page: NormalizedMemoryPageOptions,
  parse: (row: unknown) => T | null,
  matches: (post: T) => boolean,
): MemoryReadResult<MemoryPage<T>> => {
  if (!Array.isArray(data) || data.length > page.limit)
    return memoryFailure('invalid-response');
  const posts: T[] = [];
  const ids = new Set<string>();
  let previous = page.cursor;
  for (const row of data) {
    const post = parse(row);
    if (
      !post ||
      !matches(post) ||
      ids.has(post.id) ||
      (previous && !(compareCursors(post, previous) < 0))
    )
      return memoryFailure('invalid-response');
    posts.push(post);
    ids.add(post.id);
    previous = post;
  }
  const last = posts[posts.length - 1];
  return {
    ok: true,
    data: {
      posts,
      nextCursor:
        posts.length === page.limit && last
          ? { id: last.id, createdAt: last.createdAt }
          : null,
    },
  };
};

export const createMemoryService = (client: SupabaseClient) => {
  let authVersion = 0;
  let knownUser: string | null | undefined;
  let disposed = false;
  const scopes = new Set<MemoryReadScope>();
  const observeUser = (id: string | null, signedOut = false) => {
    if (signedOut || (knownUser !== undefined && knownUser !== id)) {
      authVersion += 1;
      scopes.forEach((scope) => scope.invalidate());
    }
    knownUser = id;
  };
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    if (!disposed)
      observeUser(
        session?.user.id.toLowerCase() ?? null,
        event === 'SIGNED_OUT',
      );
  });

  const readSession = async (): Promise<MemoryReadResult<string | null>> => {
    try {
      const response: unknown = await client.auth.getSession();
      if (!isMemoryRecord(response)) return memoryFailure('invalid-response');
      if (response.error) return toFailure(response.error);
      if (!isMemoryRecord(response.data))
        return memoryFailure('invalid-response');
      const session = response.data.session;
      if (session === null) return { ok: true, data: null };
      if (
        !isMemoryRecord(session) ||
        !isMemoryRecord(session.user) ||
        !isMemoryUuid(session.user.id)
      )
        return memoryFailure('invalid-response');
      return { ok: true, data: session.user.id.toLowerCase() };
    } catch (error) {
      return toFailure(error);
    }
  };

  const request = async <T>(
    name: string,
    args: Record<string, unknown>,
    read: (data: unknown, userId: string) => MemoryReadResult<T>,
  ): Promise<MemoryReadResult<T>> => {
    const initialVersion = authVersion;
    if (disposed) return memoryFailure('stale');
    const before = await readSession();
    if (disposed || initialVersion !== authVersion)
      return memoryFailure('stale');
    if (!before.ok) return before;
    observeUser(before.data);
    if (before.data === null) return memoryFailure('unauthenticated');
    const version = authVersion;
    let rpcResponse: unknown;
    let thrown: ReturnType<typeof toFailure> | undefined;
    try {
      rpcResponse = await client.rpc(name, args);
    } catch (error) {
      thrown = toFailure(error);
    }
    if (disposed || version !== authVersion) return memoryFailure('stale');
    const after = await readSession();
    if (disposed || version !== authVersion) return memoryFailure('stale');
    if (!after.ok)
      return after.error.type === 'unauthenticated'
        ? memoryFailure('stale')
        : after;
    if (after.data !== before.data) {
      observeUser(after.data);
      return memoryFailure('stale');
    }
    if (thrown) return thrown;
    if (!isMemoryRecord(rpcResponse)) return memoryFailure('invalid-response');
    if (rpcResponse.error) return toFailure(rpcResponse.error);
    return read(rpcResponse.data, before.data);
  };

  return {
    createReadScope: () => {
      const scope = createMemoryReadScope();
      if (disposed) scope.dispose();
      else scopes.add(scope);
      return {
        listPersonalPosts: (
          options?: MemoryPageOptions,
        ): Promise<MemoryReadResult<MemoryPage<MemoryPost>>> =>
          scope.run(async () => {
            if (disposed) return memoryFailure('stale');
            const page = parseMemoryPageOptions(options);
            if (!page) return memoryFailure('invalid-argument');
            return request(
              'get_personal_memory_posts',
              pageArgs(page),
              (data, userId) =>
                readPage(
                  data,
                  page,
                  parseMemoryPost,
                  (post) =>
                    post.kind === 'personal' && post.authorId === userId,
                ),
            );
          }),
        listGroupPosts: (
          groupId: string,
          options?: MemoryPageOptions,
        ): Promise<MemoryReadResult<MemoryPage<MemoryPost>>> =>
          scope.run(async () => {
            if (disposed) return memoryFailure('stale');
            const page = parseMemoryPageOptions(options);
            if (!page || !isMemoryUuid(groupId))
              return memoryFailure('invalid-argument');
            const target = groupId.toLowerCase();
            return request(
              'get_group_memory_posts',
              { ...pageArgs(page), p_group_id: target },
              (data) =>
                readPage(
                  data,
                  page,
                  parseMemoryPost,
                  (post) => post.kind === 'group' && post.groupId === target,
                ),
            );
          }),
        getPost: (postId: string): Promise<MemoryReadResult<MemoryPost>> =>
          scope.run(async () => {
            if (disposed) return memoryFailure('stale');
            if (!isMemoryUuid(postId)) return memoryFailure('invalid-argument');
            const target = postId.toLowerCase();
            return request(
              'get_memory_post',
              { p_post_id: target },
              (data, userId) => {
                const post =
                  Array.isArray(data) && data.length === 1
                    ? parseMemoryPost(data[0])
                    : null;
                return post &&
                  post.id === target &&
                  (post.kind === 'group' || post.authorId === userId)
                  ? { ok: true, data: post }
                  : memoryFailure('invalid-response');
              },
            );
          }),
        listMapPosts: (
          groupIds?: readonly string[],
          options?: MemoryPageOptions,
        ): Promise<MemoryReadResult<MemoryPage<MemoryMapPost>>> =>
          scope.run(async () => {
            if (disposed) return memoryFailure('stale');
            const ids = normalizeMemoryGroupIds(groupIds);
            const page = parseMemoryPageOptions(options);
            if (!ids || !page) return memoryFailure('invalid-argument');
            return request(
              'get_memory_map_posts',
              { ...pageArgs(page), p_group_ids: [...ids] },
              (data) =>
                readPage(
                  data,
                  page,
                  parseMemoryMapPost,
                  (post) =>
                    post.kind === 'personal' || ids.includes(post.groupId),
                ),
            );
          }),
        invalidate: scope.invalidate,
        dispose: () => {
          scope.dispose();
          scopes.delete(scope);
        },
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      authVersion += 1;
      scopes.forEach((scope) => scope.dispose());
      scopes.clear();
      subscription.unsubscribe();
    },
  };
};

export type MemoryService = ReturnType<typeof createMemoryService>;
export type MemoryReader = ReturnType<MemoryService['createReadScope']>;
