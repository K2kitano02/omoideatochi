import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import {
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from '@supabase/supabase-js';

import { getEnv } from '../config/env';

type SupabaseEnv = ReturnType<typeof getEnv>;

let sharedClient: SupabaseClient | undefined;

export const createSupabaseClient = (
  env: SupabaseEnv,
  storage: SupportedStorage,
): SupabaseClient =>
  createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

export const getSupabaseClient = (): SupabaseClient => {
  sharedClient ??= createSupabaseClient(getEnv(), globalThis.localStorage);

  return sharedClient;
};
