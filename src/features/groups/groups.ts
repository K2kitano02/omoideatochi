import { getSupabaseClient } from '../../lib/supabase';
import { createGroupService, type GroupService } from './groupService';

let sharedGroupService: GroupService | undefined;

export const getGroupService = (): GroupService => {
  sharedGroupService ??= createGroupService(getSupabaseClient());

  return sharedGroupService;
};
