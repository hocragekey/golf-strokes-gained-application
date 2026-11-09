import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    expect(loadConfig({})).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3000,
    });
  });

  it('coerces values from strings', () => {
    expect(loadConfig({ PORT: '8080' })).toMatchObject({ PORT: 8080 });
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ PORT: 'nope' })).toThrow(/Invalid configuration: PORT/);
  });
});
