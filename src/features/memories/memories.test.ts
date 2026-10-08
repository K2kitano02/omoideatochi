import { getSupabaseClient } from '../../lib/supabase';
import { createMemoryService } from './memoryService';
import { getMemoryService } from './memories';

jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({ test: 'client' })),
}));
jest.mock('./memoryService', () => ({
  createMemoryService: jest.fn(() => ({ test: 'service' })),
}));

test('共通サービスを初回だけ生成して監視登録の重複を防ぐ', () => {
  const first = getMemoryService();
  expect(getMemoryService()).toBe(first);
  expect(createMemoryService).toHaveBeenCalledTimes(1);
  expect(createMemoryService).toHaveBeenCalledWith({ test: 'client' });
  expect(getSupabaseClient).toHaveBeenCalledTimes(1);
});
