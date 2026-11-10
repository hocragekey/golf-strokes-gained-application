import { describe } from 'vitest';
import { MemoryRepo } from './memory-repo.js';
import { repoContract } from './repo.contract.js';
import { tickingClock } from './test/fixtures.js';

describe('MemoryRepo', () => {
  repoContract((pageSize) => new MemoryRepo(tickingClock(), pageSize));
});
