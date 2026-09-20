import { getSupabaseClient } from '../../lib/supabase';
import {
  createGroupInvitationService,
  type GroupInvitationService,
} from './groupInvitationService';

let sharedGroupInvitationService: GroupInvitationService | undefined;

export const getGroupInvitationService = (): GroupInvitationService => {
  sharedGroupInvitationService ??=
    createGroupInvitationService(getSupabaseClient());

  return sharedGroupInvitationService;
};
