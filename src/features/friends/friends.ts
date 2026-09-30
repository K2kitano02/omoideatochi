import { getSupabaseClient } from '../../lib/supabase';
import { createFriendService, type FriendService } from './friendService';

let sharedFriendService: FriendService | undefined;

export const getFriendService = (): FriendService => {
  sharedFriendService ??= createFriendService(getSupabaseClient());

  return sharedFriendService;
};
