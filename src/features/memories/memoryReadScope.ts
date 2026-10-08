import { memoryFailure, type MemoryReadResult } from './memoryTypes';

export const createMemoryReadScope = () => {
  let version = 0;
  let disposed = false;

  return {
    run: async <T>(
      operation: () => Promise<MemoryReadResult<T>>,
    ): Promise<MemoryReadResult<T>> => {
      if (disposed) return memoryFailure('stale');
      const request = ++version;
      let result: MemoryReadResult<T>;
      try {
        result = await operation();
      } catch {
        result = memoryFailure('unexpected');
      }
      return disposed || request !== version ? memoryFailure('stale') : result;
    },
    invalidate: () => {
      version += 1;
    },
    dispose: () => {
      disposed = true;
      version += 1;
    },
  };
};

export type MemoryReadScope = ReturnType<typeof createMemoryReadScope>;
