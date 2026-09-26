import type { SupabaseClient } from '@supabase/supabase-js';

export type Profile = {
  userId: string;
  displayName: string;
};

export type ProfileFailure = {
  type: 'unauthenticated' | 'invalid-name' | 'network' | 'unexpected';
  message: string;
};

export type GetProfileResult =
  { ok: true; profile: Profile | null } | { ok: false; error: ProfileFailure };

export type SaveProfileResult =
  { ok: true; profile: Profile } | { ok: false; error: ProfileFailure };

const invalidNameFailure = (): ProfileFailure => ({
  type: 'invalid-name',
  message: '表示名は前後に空白を入れず、1〜15文字で入力してください。',
});

const unauthenticatedFailure = (): ProfileFailure => ({
  type: 'unauthenticated',
  message: 'ログインが必要です。再度ログインしてください。',
});

const unexpectedFailure = (): ProfileFailure => ({
  type: 'unexpected',
  message: 'プロフィールの処理に失敗しました。時間をおいて再度お試しください。',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNetworkFailure = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : '';

  return /fetch|network|timed?\s*out|timeout/i.test(message);
};

const toProfileFailure = (error: unknown): ProfileFailure => {
  if (isNetworkFailure(error)) {
    return {
      type: 'network',
      message: '通信に失敗しました。接続を確認して再度お試しください。',
    };
  }

  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : undefined;

    if (code === '28000' || code === 'PGRST301') {
      return unauthenticatedFailure();
    }

    if (code === '23514') {
      return invalidNameFailure();
    }
  }

  return unexpectedFailure();
};

const isValidDisplayName = (displayName: string): boolean =>
  displayName.length >= 1 &&
  displayName.length <= 15 &&
  displayName === displayName.trim();

const isProfileRow = (
  value: unknown,
): value is { user_id: string; display_name: string } =>
  isRecord(value) &&
  typeof value.user_id === 'string' &&
  typeof value.display_name === 'string';

export const createProfileService = (client: SupabaseClient) => {
  const getCurrentUserId = async (): Promise<
    { ok: true; userId: string } | { ok: false; error: ProfileFailure }
  > => {
    const { data, error } = await client.auth.getSession();

    if (error) {
      return { ok: false, error: toProfileFailure(error) };
    }

    if (!data.session) {
      return { ok: false, error: unauthenticatedFailure() };
    }

    return { ok: true, userId: data.session.user.id };
  };

  return {
    getMyProfile: async (): Promise<GetProfileResult> => {
      try {
        const userResult = await getCurrentUserId();
        if (!userResult.ok) {
          return userResult;
        }

        const { data, error } = await client
          .from('profiles')
          .select('user_id, display_name')
          .eq('user_id', userResult.userId)
          .maybeSingle();

        if (error) {
          return { ok: false, error: toProfileFailure(error) };
        }

        if (data === null) {
          return { ok: true, profile: null };
        }

        if (!isProfileRow(data)) {
          return { ok: false, error: unexpectedFailure() };
        }

        return {
          ok: true,
          profile: { userId: data.user_id, displayName: data.display_name },
        };
      } catch (error) {
        return { ok: false, error: toProfileFailure(error) };
      }
    },

    saveDisplayName: async (
      displayName: string,
    ): Promise<SaveProfileResult> => {
      if (!isValidDisplayName(displayName)) {
        return { ok: false, error: invalidNameFailure() };
      }

      try {
        const userResult = await getCurrentUserId();
        if (!userResult.ok) {
          return userResult;
        }

        const { error } = await client.from('profiles').upsert(
          {
            user_id: userResult.userId,
            display_name: displayName,
          },
          { onConflict: 'user_id' },
        );

        if (error) {
          return { ok: false, error: toProfileFailure(error) };
        }

        return {
          ok: true,
          profile: { userId: userResult.userId, displayName },
        };
      } catch (error) {
        return { ok: false, error: toProfileFailure(error) };
      }
    },
  };
};

export type ProfileService = ReturnType<typeof createProfileService>;
