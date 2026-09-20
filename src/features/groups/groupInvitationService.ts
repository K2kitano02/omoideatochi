import type { SupabaseClient } from '@supabase/supabase-js';

export type GroupInvitationFailure = {
  type:
    | 'unauthenticated'
    | 'permission-denied'
    | 'invitation-not-found'
    | 'invitation-expired'
    | 'invitation-used'
    | 'consent-required'
    | 'already-member'
    | 'request-already-pending'
    | 'request-not-pending'
    | 'group-full'
    | 'invalid-argument'
    | 'network'
    | 'unexpected';
  message: string;
};

export type GroupInvitation = {
  token: string;
  expiresAt: string;
  requiresApproval: boolean;
};

export type GroupInvitationPreview = {
  groupId: string;
  groupName: string;
  requiresApproval: boolean;
  expiresAt: string;
};

export type RedeemInvitationOutcome =
  | { status: 'joined'; groupId: string }
  | {
      status: 'pending';
      groupId: string;
      requestId: string;
    };

export type GroupJoinRequest = {
  requestId: string;
  applicantId: string;
  createdAt: string;
};

export type GroupJoinRequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled';

export type MyGroupJoinRequest = {
  requestId: string;
  groupId: string;
  groupName: string;
  status: GroupJoinRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type CreateInvitationResult =
  | { ok: true; invitation: GroupInvitation }
  | { ok: false; error: GroupInvitationFailure };

export type PreviewInvitationResult =
  | { ok: true; preview: GroupInvitationPreview }
  | { ok: false; error: GroupInvitationFailure };

export type RedeemInvitationResult =
  | { ok: true; result: RedeemInvitationOutcome }
  | { ok: false; error: GroupInvitationFailure };

export type ListJoinRequestsResult =
  | { ok: true; requests: GroupJoinRequest[] }
  | { ok: false; error: GroupInvitationFailure };

export type ListMyJoinRequestsResult =
  | { ok: true; requests: MyGroupJoinRequest[] }
  | { ok: false; error: GroupInvitationFailure };

export type UpdateJoinRequestResult =
  { ok: true } | { ok: false; error: GroupInvitationFailure };

export type ResolveJoinRequestResult =
  | { ok: true; status: 'approved' | 'rejected' }
  | { ok: false; error: GroupInvitationFailure };

const unexpectedFailure = (): GroupInvitationFailure => ({
  type: 'unexpected',
  message: '招待情報の処理に失敗しました。時間をおいて再度お試しください。',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

const toGroupInvitationFailure = (error: unknown): GroupInvitationFailure => {
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
      message: 'この招待または参加申請を操作する権限がありません。',
    };
  }

  switch (message) {
    case 'invitation_not_found':
      return {
        type: 'invitation-not-found',
        message: '招待コードが見つかりません。入力内容を確認してください。',
      };
    case 'invitation_expired':
      return {
        type: 'invitation-expired',
        message: 'この招待コードの有効期限が切れています。',
      };
    case 'invitation_used':
      return {
        type: 'invitation-used',
        message: 'この招待コードはすでに使用されています。',
      };
    case 'consent_required':
      return {
        type: 'consent-required',
        message: '共有範囲への同意が必要です。',
      };
    case 'already_member':
      return {
        type: 'already-member',
        message: 'このグループにはすでに参加しています。',
      };
    case 'request_already_pending':
      return {
        type: 'request-already-pending',
        message: 'このグループへの参加申請はすでに送信済みです。',
      };
    case 'request_not_pending':
      return {
        type: 'request-not-pending',
        message: 'この参加申請はすでに処理されています。',
      };
    case 'group_full':
      return {
        type: 'group-full',
        message: 'このグループは参加人数の上限に達しています。',
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

const isInvitationRow = (
  value: unknown,
): value is {
  invitation_token: string;
  expires_at: string;
  requires_approval: boolean;
} =>
  isRecord(value) &&
  typeof value.invitation_token === 'string' &&
  typeof value.expires_at === 'string' &&
  typeof value.requires_approval === 'boolean';

const isPreviewRow = (
  value: unknown,
): value is {
  group_id: string;
  group_name: string;
  requires_approval: boolean;
  expires_at: string;
} =>
  isRecord(value) &&
  typeof value.group_id === 'string' &&
  typeof value.group_name === 'string' &&
  typeof value.requires_approval === 'boolean' &&
  typeof value.expires_at === 'string';

const isRedeemRow = (
  value: unknown,
): value is
  | {
      outcome: 'joined';
      group_id: string;
      join_request_id: null;
    }
  | {
      outcome: 'pending';
      group_id: string;
      join_request_id: string;
    } =>
  isRecord(value) &&
  (value.outcome === 'joined' || value.outcome === 'pending') &&
  typeof value.group_id === 'string' &&
  (typeof value.join_request_id === 'string' ||
    value.join_request_id === null) &&
  (value.outcome === 'pending'
    ? typeof value.join_request_id === 'string'
    : value.join_request_id === null);

const isGroupJoinRequestRow = (
  value: unknown,
): value is {
  request_id: string;
  applicant_id: string;
  created_at: string;
} =>
  isRecord(value) &&
  typeof value.request_id === 'string' &&
  typeof value.applicant_id === 'string' &&
  typeof value.created_at === 'string';

const isGroupJoinRequestStatus = (
  value: unknown,
): value is GroupJoinRequestStatus =>
  value === 'pending' ||
  value === 'approved' ||
  value === 'rejected' ||
  value === 'cancelled';

const isMyGroupJoinRequestRow = (
  value: unknown,
): value is {
  request_id: string;
  group_id: string;
  group_name: string;
  status: GroupJoinRequestStatus;
  created_at: string;
  resolved_at: string | null;
} =>
  isRecord(value) &&
  typeof value.request_id === 'string' &&
  typeof value.group_id === 'string' &&
  typeof value.group_name === 'string' &&
  isGroupJoinRequestStatus(value.status) &&
  typeof value.created_at === 'string' &&
  (typeof value.resolved_at === 'string' || value.resolved_at === null);

const callSafely = async <T>(
  operation: () => PromiseLike<T>,
): Promise<
  { ok: true; value: T } | { ok: false; error: GroupInvitationFailure }
> => {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: toGroupInvitationFailure(error) };
  }
};

export const createGroupInvitationService = (client: SupabaseClient) => {
  const inFlightMutations = new Map<string, Promise<unknown>>();

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
    createInvitation: (groupId: string): Promise<CreateInvitationResult> =>
      runMutationOnce(`create-invitation:${groupId}`, async () => {
        const response = await callSafely(() =>
          client.rpc('create_group_invitation', { p_group_id: groupId }),
        );

        if (!response.ok) {
          return response;
        }

        const { data, error } = response.value;

        const row = Array.isArray(data) ? data[0] : undefined;

        if (error) {
          return { ok: false, error: toGroupInvitationFailure(error) };
        }

        if (!isInvitationRow(row)) {
          return { ok: false, error: unexpectedFailure() };
        }

        return {
          ok: true,
          invitation: {
            token: row.invitation_token,
            expiresAt: row.expires_at,
            requiresApproval: row.requires_approval,
          },
        };
      }),

    previewInvitation: async (
      token: string,
    ): Promise<PreviewInvitationResult> => {
      const response = await callSafely(() =>
        client.rpc('preview_group_invitation', { p_token: token }),
      );

      if (!response.ok) {
        return response;
      }

      const { data, error } = response.value;
      const row = Array.isArray(data) ? data[0] : undefined;

      if (error) {
        return { ok: false, error: toGroupInvitationFailure(error) };
      }

      if (!isPreviewRow(row)) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        preview: {
          groupId: row.group_id,
          groupName: row.group_name,
          requiresApproval: row.requires_approval,
          expiresAt: row.expires_at,
        },
      };
    },

    redeemInvitation: (
      token: string,
      consent: boolean,
    ): Promise<RedeemInvitationResult> =>
      runMutationOnce(`redeem-invitation:${token}:${consent}`, async () => {
        const response = await callSafely(() =>
          client.rpc('redeem_group_invitation', {
            p_token: token,
            p_consent: consent,
          }),
        );

        if (!response.ok) {
          return response;
        }

        const { data, error } = response.value;
        const row = Array.isArray(data) ? data[0] : undefined;

        if (error) {
          return { ok: false, error: toGroupInvitationFailure(error) };
        }

        if (!isRedeemRow(row)) {
          return { ok: false, error: unexpectedFailure() };
        }

        return row.outcome === 'joined'
          ? {
              ok: true,
              result: { status: 'joined', groupId: row.group_id },
            }
          : {
              ok: true,
              result: {
                status: 'pending',
                groupId: row.group_id,
                requestId: row.join_request_id,
              },
            };
      }),

    listJoinRequests: async (
      groupId: string,
    ): Promise<ListJoinRequestsResult> => {
      const response = await callSafely(() =>
        client.rpc('list_group_join_requests', { p_group_id: groupId }),
      );

      if (!response.ok) {
        return response;
      }

      const { data, error } = response.value;

      if (error) {
        return { ok: false, error: toGroupInvitationFailure(error) };
      }

      if (!Array.isArray(data) || !data.every(isGroupJoinRequestRow)) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        requests: data.map((request) => ({
          requestId: request.request_id,
          applicantId: request.applicant_id,
          createdAt: request.created_at,
        })),
      };
    },

    listMyJoinRequests: async (): Promise<ListMyJoinRequestsResult> => {
      const response = await callSafely(() =>
        client.rpc('get_my_group_join_requests'),
      );

      if (!response.ok) {
        return response;
      }

      const { data, error } = response.value;

      if (error) {
        return { ok: false, error: toGroupInvitationFailure(error) };
      }

      if (!Array.isArray(data) || !data.every(isMyGroupJoinRequestRow)) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        requests: data.map((request) => ({
          requestId: request.request_id,
          groupId: request.group_id,
          groupName: request.group_name,
          status: request.status,
          createdAt: request.created_at,
          resolvedAt: request.resolved_at,
        })),
      };
    },

    cancelJoinRequest: (requestId: string): Promise<UpdateJoinRequestResult> =>
      runMutationOnce(`cancel-join-request:${requestId}`, async () => {
        const response = await callSafely(() =>
          client.rpc('cancel_group_join_request', {
            p_request_id: requestId,
          }),
        );

        if (!response.ok) {
          return response;
        }

        const { error } = response.value;

        return error
          ? { ok: false, error: toGroupInvitationFailure(error) }
          : { ok: true };
      }),

    resolveJoinRequest: (
      requestId: string,
      approve: boolean,
    ): Promise<ResolveJoinRequestResult> =>
      runMutationOnce(
        `resolve-join-request:${requestId}:${approve}`,
        async () => {
          const response = await callSafely(() =>
            client.rpc('resolve_group_join_request', {
              p_request_id: requestId,
              p_approve: approve,
            }),
          );

          if (!response.ok) {
            return response;
          }

          const { data, error } = response.value;

          if (error) {
            return { ok: false, error: toGroupInvitationFailure(error) };
          }

          if (data !== 'approved' && data !== 'rejected') {
            return { ok: false, error: unexpectedFailure() };
          }

          return { ok: true, status: data };
        },
      ),
  };
};

export type GroupInvitationService = ReturnType<
  typeof createGroupInvitationService
>;
