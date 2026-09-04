import { createClient } from '@supabase/supabase-js';

import { createSupabaseClient } from './supabase';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));
jest.mock('expo-sqlite/localStorage/install', () => ({}));

describe('createSupabaseClient', () => {
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
});
