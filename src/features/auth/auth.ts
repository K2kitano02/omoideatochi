import { getSupabaseClient } from '../../lib/supabase';
import { createAuthService, type AuthService } from './authService';

let sharedAuthService: AuthService | undefined;

export const getAuthService = (): AuthService => {
  sharedAuthService ??= createAuthService(getSupabaseClient().auth);

  return sharedAuthService;
};
