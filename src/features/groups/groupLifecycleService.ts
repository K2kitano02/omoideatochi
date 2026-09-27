import type { SupabaseClient } from '@supabase/supabase-js';

export type GroupLifecycleFailureReason =
  | 'unauthenticated'
  | 'permission-denied'
  | 'owner-cannot-leave'
  | 'owner-cannot-be-removed'
  | 'group-not-found'
  | 'already-left'
  | 'member-not-found'
  | 'group-dissolved'
  | 'network'
  | 'unexpected';

export type GroupLifecycleSuccess =
  | { action: 'left'; groupId: string }
  | { action: 'member-removed'; groupId: string; userId: string }
  | { action: 'dissolved'; groupId: string };

export type GroupLifecycleResult =
  | { ok: true; result: GroupLifecycleSuccess }
  | { ok: false; reason: GroupLifecycleFailureReason };

type GroupLifecycleOperation = 'leave' | 'remove-member' | 'dissolve';

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

const toFailureReason = (
  error: unknown,
  operation: GroupLifecycleOperation,
): GroupLifecycleFailureReason => {
  if (isNetworkFailure(error)) {
    return 'network';
  }

  if (!isRecord(error)) {
    return 'unexpected';
  }

  const code = readString(error, 'code');
  const message = readString(error, 'message');

  if (
    code === '28000' ||
    code === 'PGRST301' ||
    message === 'authentication_required'
  ) {
    return 'unauthenticated';
  }

  if (code === '42501' || message === 'permission_denied') {
    return 'permission-denied';
  }

  switch (message) {
    case 'owner_cannot_leave':
      return 'owner-cannot-leave';
    case 'owner_cannot_be_removed':
      return 'owner-cannot-be-removed';
    case 'group_not_found':
      return 'group-not-found';
    case 'member_not_found':
      return operation === 'leave' ? 'already-left' : 'member-not-found';
    case 'group_dissolved':
      return 'group-dissolved';
    default:
      return 'unexpected';
  }
};

export class GroupLifecycleService {
  private readonly inFlightMutations = new Map<
    string,
    Promise<GroupLifecycleResult>
  >();

  constructor(private readonly client: SupabaseClient) {}

  leaveGroup(groupId: string): Promise<GroupLifecycleResult> {
    return this.runMutationOnce(`leave:${groupId}`, async () => {
      const response = await this.callRpc(
        'leave_group',
        { p_group_id: groupId },
        'leave',
      );

      return (
        response ?? {
          ok: true,
          result: { action: 'left', groupId },
        }
      );
    });
  }

  removeGroupMember(
    groupId: string,
    userId: string,
  ): Promise<GroupLifecycleResult> {
    return this.runMutationOnce(
      `remove-member:${groupId}:${userId}`,
      async () => {
        const response = await this.callRpc(
          'remove_group_member',
          { p_group_id: groupId, p_user_id: userId },
          'remove-member',
        );

        return (
          response ?? {
            ok: true,
            result: { action: 'member-removed', groupId, userId },
          }
        );
      },
    );
  }

  dissolveGroup(groupId: string): Promise<GroupLifecycleResult> {
    return this.runMutationOnce(`dissolve:${groupId}`, async () => {
      const response = await this.callRpc(
        'dissolve_group',
        { p_group_id: groupId },
        'dissolve',
      );

      return (
        response ?? {
          ok: true,
          result: { action: 'dissolved', groupId },
        }
      );
    });
  }

  private async callRpc(
    name: string,
    args: Record<string, string>,
    operation: GroupLifecycleOperation,
  ): Promise<GroupLifecycleResult | null> {
    try {
      const { data, error } = await this.client.rpc(name, args);

      if (error) {
        return { ok: false, reason: toFailureReason(error, operation) };
      }

      if (data !== null) {
        return { ok: false, reason: 'unexpected' };
      }

      return null;
    } catch (error) {
      return { ok: false, reason: toFailureReason(error, operation) };
    }
  }

  private runMutationOnce(
    key: string,
    mutation: () => Promise<GroupLifecycleResult>,
  ): Promise<GroupLifecycleResult> {
    const existing = this.inFlightMutations.get(key);

    if (existing) {
      return existing;
    }

    const request = mutation();
    const trackedRequest = request.finally(() => {
      if (this.inFlightMutations.get(key) === trackedRequest) {
        this.inFlightMutations.delete(key);
      }
    });

    this.inFlightMutations.set(key, trackedRequest);
    return trackedRequest;
  }
}

export const createGroupLifecycleService = (
  client: SupabaseClient,
): GroupLifecycleService => new GroupLifecycleService(client);
