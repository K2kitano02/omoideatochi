import { getSupabaseClient } from '../../lib/supabase';
import {
  createGroupLifecycleService,
  type GroupLifecycleService,
} from './groupLifecycleService';

let sharedGroupLifecycleService: GroupLifecycleService | undefined;

export const getGroupLifecycleService = (): GroupLifecycleService => {
  sharedGroupLifecycleService ??=
    createGroupLifecycleService(getSupabaseClient());

  return sharedGroupLifecycleService;
};
