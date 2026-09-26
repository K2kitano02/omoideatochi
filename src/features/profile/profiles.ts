import { getSupabaseClient } from '../../lib/supabase';
import { createProfileService, type ProfileService } from './profileService';

let sharedProfileService: ProfileService | undefined;

export const getProfileService = (): ProfileService => {
  sharedProfileService ??= createProfileService(getSupabaseClient());

  return sharedProfileService;
};
