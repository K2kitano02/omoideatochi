import { getSupabaseClient } from '../../lib/supabase';
import { createMemoryService, type MemoryService } from './memoryService';

let sharedMemoryService: MemoryService | undefined;

export const getMemoryService = (): MemoryService => {
  sharedMemoryService ??= createMemoryService(getSupabaseClient());
  return sharedMemoryService;
};
