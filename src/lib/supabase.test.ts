import { createClient } from '@supabase/supabase-js';

import { createSupabaseClient, getSupabaseClient } from './supabase';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));
jest.mock('expo-sqlite/localStorage/install', () => ({}));

describe('createSupabaseClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('検証済みの接続情報とモバイル向け認証設定でクライアントを作る', () => {
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const expectedClient = { auth: {} };

    jest.mocked(createClient).mockReturnValue(expectedClient as never);

    const client = createSupabaseClient(
      {
        supabaseUrl: 'http://127.0.0.1:54321',
        supabasePublishableKey: 'publishable-key',
      },
      storage,
    );

    expect(client).toBe(expectedClient);
    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'publishable-key',
      {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
    );
  });

  test('共有クライアントを複数回取得しても同じインスタンスを返す', () => {
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const expectedClient = { auth: {} };
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
    jest.mocked(createClient).mockReturnValue(expectedClient as never);

    const firstClient = getSupabaseClient();
    const secondClient = getSupabaseClient();

    expect(secondClient).toBe(firstClient);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
