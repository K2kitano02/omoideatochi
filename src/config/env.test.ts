import { createEnv, getEnv } from './env';

const validValues = {
  supabaseUrl: 'https://example.supabase.co',
  supabasePublishableKey: 'sb_publishable_example',
};

const restoreEnvValue = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
};

describe('createEnv', () => {
  test('必須値が揃っている場合は設定を返す', () => {
    expect(createEnv(validValues)).toEqual(validValues);
  });

  test('必須値が1つ不足している場合は変数名を含むエラーを出す', () => {
    expect(() =>
      createEnv({
        ...validValues,
        supabaseUrl: undefined,
      }),
    ).toThrow(
      'Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL',
    );
  });

  test('複数の必須値が空の場合は不足している変数名をすべて示す', () => {
    expect(() =>
      createEnv({
        supabaseUrl: '',
        supabasePublishableKey: '   ',
      }),
    ).toThrow(
      'Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  });
});

describe('getEnv', () => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabasePublishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    restoreEnvValue('EXPO_PUBLIC_SUPABASE_URL', originalSupabaseUrl);
    restoreEnvValue(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      originalSupabasePublishableKey,
    );
  });

  test('Expoの公開環境変数を設定へ変換する', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = validValues.supabaseUrl;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      validValues.supabasePublishableKey;

    expect(getEnv()).toEqual(validValues);
  });
});
