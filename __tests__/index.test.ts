const restoreEnvValue = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
};

jest.mock('expo-sqlite/localStorage/install', () => ({}));

describe('app entry', () => {
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

  test('必須環境変数がない場合はアプリ登録前にエラーを出す', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => {
      jest.isolateModules(() => {
        require('../index');
      });
    }).toThrow(
      'Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  });
});
