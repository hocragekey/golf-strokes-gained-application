import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: { conditions: ['@golf-sg/source'] },
  ssr: { resolve: { conditions: ['@golf-sg/source'] } },
  test: { name: 'api', environment: 'node', include: ['src/**/*.test.ts', 'test/**/*.test.ts'] },
});
