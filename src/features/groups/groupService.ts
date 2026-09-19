import type { SupabaseClient } from '@supabase/supabase-js';

export type Group = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type GroupFailure = {
  type:
    | 'unauthenticated'
    | 'invalid-name'
    | 'group-limit'
    | 'permission-denied'
    | 'network'
    | 'unexpected';
  message: string;
};

export type CreateGroupResult =
  { ok: true; groupId: string } | { ok: false; error: GroupFailure };

export type ListGroupsResult =
  { ok: true; groups: Group[] } | { ok: false; error: GroupFailure };

type ErrorContext = 'create' | 'list';

const unexpectedFailure = (): GroupFailure => ({
  type: 'unexpected',
  message: 'グループ情報の処理に失敗しました。時間をおいて再度お試しください。',
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

const toGroupFailure = (
  error: unknown,
  context: ErrorContext,
): GroupFailure => {
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

  if (code === '28000' || code === 'PGRST301') {
    return {
      type: 'unauthenticated',
      message: 'ログインが必要です。再度ログインしてください。',
    };
  }

  if (code === '42501') {
    return {
      type: 'permission-denied',
      message: 'グループを操作する権限がありません。',
    };
  }

  if (context === 'create' && code === '22023') {
    if (message === 'group creation limit reached') {
      return {
        type: 'group-limit',
        message: '作成できるグループは5件までです。',
      };
    }

    return {
      type: 'invalid-name',
      message: 'グループ名は前後に空白を入れず、1〜100文字で入力してください。',
    };
  }

  return unexpectedFailure();
};

const isGroupRow = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.created_by === 'string' &&
  typeof value.created_at === 'string';

export const createGroupService = (client: SupabaseClient) => ({
  createGroup: async (name: string): Promise<CreateGroupResult> => {
    try {
      const { data, error } = await client.rpc('create_group', {
        p_name: name,
      });

      if (error) {
        return { ok: false, error: toGroupFailure(error, 'create') };
      }

      if (typeof data !== 'string') {
        return { ok: false, error: unexpectedFailure() };
      }

      return { ok: true, groupId: data };
    } catch (error) {
      return { ok: false, error: toGroupFailure(error, 'create') };
    }
  },

  listGroups: async (): Promise<ListGroupsResult> => {
    try {
      const { data, error } = await client
        .from('groups')
        .select('id, name, created_by, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return { ok: false, error: toGroupFailure(error, 'list') };
      }

      if (!Array.isArray(data) || !data.every(isGroupRow)) {
        return { ok: false, error: unexpectedFailure() };
      }

      return {
        ok: true,
        groups: data.map((group) => ({
          id: group.id,
          name: group.name,
          createdBy: group.created_by,
          createdAt: group.created_at,
        })),
      };
    } catch (error) {
      return { ok: false, error: toGroupFailure(error, 'list') };
    }
  },
});

export type GroupService = ReturnType<typeof createGroupService>;
