import type { SupabaseClient } from '@supabase/supabase-js';

export type FriendUser = {
  displayName: string;
};

export type FriendRequest = {
  requestId: string;
  user: FriendUser;
  createdAt: string;
};

export type Friend = {
  relationshipId: string;
  user: FriendUser;
  acceptedAt: string;
};

export type FriendFailure = {
  type:
    | 'unauthenticated'
    | 'friend-code-not-found'
    | 'cannot-friend-self'
    | 'request-already-pending'
    | 'already-friends'
    | 'request-not-pending'
    | 'permission-denied'
    | 'invalid-argument'
    | 'network'
    | 'unexpected';
  message: string;
};

export type FriendCodeResult =
  { ok: true; code: string } | { ok: false; error: FriendFailure };

export type FriendCodePreviewResult =
  { ok: true; user: FriendUser } | { ok: false; error: FriendFailure };

export type CreateFriendRequestResult =
  { ok: true; requestId: string } | { ok: false; error: FriendFailure };

export type ListFriendRequestsResult =
  { ok: true; requests: FriendRequest[] } | { ok: false; error: FriendFailure };

export type ResolveFriendRequestResult =
  | { ok: true; status: 'accepted' | 'rejected' }
  | { ok: false; error: FriendFailure };

export type ListFriendsResult =
  { ok: true; friends: Friend[] } | { ok: false; error: FriendFailure };

export type RemoveFriendResult =
  { ok: true } | { ok: false; error: FriendFailure };

export const normalizeFriendCode = (code: string): string =>
  code.trim().toUpperCase();

const unexpectedFailure = (): FriendFailure => ({
  type: 'unexpected',
  message: 'フレンド情報の処理に失敗しました。時間をおいて再度お試しください。',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFriendCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9A-F]{16}$/.test(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | undefined =>
  typeof value[key] === 'string' ? value[key] : undefined;

const isNetworkFailure = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : isRecord(error)
        ? readString(error, 'message')
        : undefined;

  return message ? /fetch|network|timed?\s*out|timeout/i.test(message) : false;
};

const toFriendFailure = (error: unknown): FriendFailure => {
  if (isNetworkFailure(error)) {
    return {
      type: 'network',
      message: '通信に失敗しました。接続を確認して再度お試しください。',
    };
  }

  if (!isRecord(error)) {
    return unexpectedFailure();
  }

  const code = readString(error, 'code');
  const message = readString(error, 'message');

  if (
    code === '28000' ||
    code === 'PGRST301' ||
    message === 'authentication_required'
  ) {
    return {
      type: 'unauthenticated',
      message: 'ログインが必要です。再度ログインしてください。',
    };
  }

  if (code === '42501' || message === 'permission_denied') {
    return {
      type: 'permission-denied',
      message: 'このフレンド情報を操作する権限がありません。',
    };
  }

  switch (message) {
    case 'friend_code_not_found':
      return {
        type: 'friend-code-not-found',
        message: 'フレンドコードが見つかりません。入力内容を確認してください。',
      };
    case 'cannot_friend_self':
      return {
        type: 'cannot-friend-self',
        message: '自分自身へフレンド申請は送れません。',
      };
    case 'friend_request_already_pending':
      return {
        type: 'request-already-pending',
        message: 'このユーザーへのフレンド申請はすでに処理待ちです。',
      };
    case 'already_friends':
      return {
        type: 'already-friends',
        message: 'このユーザーとはすでにフレンドです。',
      };
    case 'request_not_pending':
      return {
        type: 'request-not-pending',
        message: 'このフレンド申請はすでに処理されています。',
      };
    case 'invalid_argument':
      return {
        type: 'invalid-argument',
        message: '入力内容が正しくありません。',
      };
    default:
      return unexpectedFailure();
  }
};

const isReceivedRequestRow = (
  value: unknown,
): value is {
  request_id: string;
  requester_display_name: string;
  created_at: string;
} =>
  isRecord(value) &&
  isUuid(value.request_id) &&
  typeof value.requester_display_name === 'string' &&
  typeof value.created_at === 'string';

const isSentRequestRow = (
  value: unknown,
): value is {
  request_id: string;
  recipient_display_name: string;
  created_at: string;
} =>
  isRecord(value) &&
  isUuid(value.request_id) &&
  typeof value.recipient_display_name === 'string' &&
  typeof value.created_at === 'string';

const isFriendRow = (
  value: unknown,
): value is {
  relationship_id: string;
  display_name: string;
  accepted_at: string;
} =>
  isRecord(value) &&
  isUuid(value.relationship_id) &&
  typeof value.display_name === 'string' &&
  typeof value.accepted_at === 'string';

export const createFriendService = (client: SupabaseClient) => {
  const inFlightMutations = new Map<string, Promise<unknown>>();

  const callRpc = async (
    name: string,
    args?: Record<string, string | boolean>,
  ): Promise<
    { ok: true; data: unknown } | { ok: false; error: FriendFailure }
  > => {
    try {
      const { data, error } = args
        ? await client.rpc(name, args)
        : await client.rpc(name);

      return error
        ? { ok: false, error: toFriendFailure(error) }
        : { ok: true, data };
    } catch (error) {
      return { ok: false, error: toFriendFailure(error) };
    }
  };

  const runMutationOnce = <T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const current = inFlightMutations.get(key) as Promise<T> | undefined;

    if (current) {
      return current;
    }

    const request = operation().finally(() => {
      if (inFlightMutations.get(key) === request) {
        inFlightMutations.delete(key);
      }
    });

    inFlightMutations.set(key, request);
    return request;
  };

  return {
    getMyFriendCode: async (): Promise<FriendCodeResult> => {
      const response = await callRpc('get_my_friend_code');

      if (!response.ok) {
        return response;
      }

      return isFriendCode(response.data)
        ? { ok: true, code: response.data }
        : { ok: false, error: unexpectedFailure() };
    },

    regenerateMyFriendCode: (): Promise<FriendCodeResult> =>
      runMutationOnce('regenerate-friend-code', async () => {
        const response = await callRpc('regenerate_my_friend_code');

        if (!response.ok) {
          return response;
        }

        return isFriendCode(response.data)
          ? { ok: true, code: response.data }
          : { ok: false, error: unexpectedFailure() };
      }),

    previewFriendCode: async (
      code: string,
    ): Promise<FriendCodePreviewResult> => {
      const response = await callRpc('preview_friend_code', {
        p_code: normalizeFriendCode(code),
      });

      if (!response.ok) {
        return response;
      }

      const row = Array.isArray(response.data) ? response.data[0] : undefined;

      return Array.isArray(response.data) &&
        response.data.length === 1 &&
        isRecord(row) &&
        typeof row.display_name === 'string'
        ? { ok: true, user: { displayName: row.display_name } }
        : { ok: false, error: unexpectedFailure() };
    },

    createFriendRequest: (code: string): Promise<CreateFriendRequestResult> => {
      const normalizedCode = normalizeFriendCode(code);

      return runMutationOnce(
        `create-friend-request:${normalizedCode}`,
        async () => {
          const response = await callRpc('create_friend_request', {
            p_code: normalizedCode,
          });

          if (!response.ok) {
            return response;
          }

          return isUuid(response.data)
            ? { ok: true, requestId: response.data }
            : { ok: false, error: unexpectedFailure() };
        },
      );
    },

    listReceivedFriendRequests: async (): Promise<ListFriendRequestsResult> => {
      const response = await callRpc('list_received_friend_requests');

      if (!response.ok) {
        return response;
      }

      if (
        !Array.isArray(response.data) ||
        !response.data.every(isReceivedRequestRow)
      ) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        requests: response.data.map((request) => ({
          requestId: request.request_id,
          user: { displayName: request.requester_display_name },
          createdAt: request.created_at,
        })),
      };
    },

    listSentFriendRequests: async (): Promise<ListFriendRequestsResult> => {
      const response = await callRpc('list_sent_friend_requests');

      if (!response.ok) {
        return response;
      }

      if (
        !Array.isArray(response.data) ||
        !response.data.every(isSentRequestRow)
      ) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        requests: response.data.map((request) => ({
          requestId: request.request_id,
          user: { displayName: request.recipient_display_name },
          createdAt: request.created_at,
        })),
      };
    },

    resolveFriendRequest: (
      requestId: string,
      accept: boolean,
    ): Promise<ResolveFriendRequestResult> =>
      runMutationOnce(
        `resolve-friend-request:${requestId}:${accept}`,
        async () => {
          const response = await callRpc('resolve_friend_request', {
            p_request_id: requestId,
            p_accept: accept,
          });

          if (!response.ok) {
            return response;
          }

          return response.data === 'accepted' || response.data === 'rejected'
            ? { ok: true, status: response.data }
            : { ok: false, error: unexpectedFailure() };
        },
      ),

    listFriends: async (): Promise<ListFriendsResult> => {
      const response = await callRpc('list_friends');

      if (!response.ok) {
        return response;
      }

      if (!Array.isArray(response.data) || !response.data.every(isFriendRow)) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        friends: response.data.map((friend) => ({
          relationshipId: friend.relationship_id,
          user: { displayName: friend.display_name },
          acceptedAt: friend.accepted_at,
        })),
      };
    },

    removeFriend: (relationshipId: string): Promise<RemoveFriendResult> =>
      runMutationOnce(`remove-friend:${relationshipId}`, async () => {
        const response = await callRpc('remove_friend', {
          p_relationship_id: relationshipId,
        });

        if (!response.ok) {
          return response;
        }

        return response.data === null
          ? { ok: true }
          : { ok: false, error: unexpectedFailure() };
      }),
  };
};

export type FriendService = ReturnType<typeof createFriendService>;
