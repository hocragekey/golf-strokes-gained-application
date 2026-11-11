import type { ConverseCommand, ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import { bedrockCardReader, CARD_SCAN_INSTRUCTIONS } from './card-reader.js';

describe('bedrockCardReader', () => {
  it('sends the photo with the marking instructions and returns the tool input', async () => {
    const sent: ConverseCommand[] = [];
    const answer = { courseName: 'Pebble Creek', tees: 'Blue', holes: [] };
    const reader = bedrockCardReader('us.example.model-v1:0', {
      send: (command) => {
        sent.push(command);
        return Promise.resolve({
          output: {
            message: {
              role: 'assistant',
              content: [{ toolUse: { toolUseId: '1', name: 'record_scorecard', input: answer } }],
            },
          },
        } as unknown as ConverseCommandOutput);
      },
    });
    const image = new Uint8Array([1, 2, 3]);
    await expect(reader.read(image, 'image/jpeg')).resolves.toEqual(answer);
    const input = sent[0]?.input;
    expect(input?.modelId).toBe('us.example.model-v1:0');
    expect(input?.system).toEqual([{ text: CARD_SCAN_INSTRUCTIONS }]);
    expect(input?.messages?.[0]?.content?.[0]).toEqual({
      image: { format: 'jpeg', source: { bytes: image } },
    });
    expect(input?.toolConfig?.toolChoice).toEqual({ tool: { name: 'record_scorecard' } });
  });

  it('returns undefined when the model does not use the tool', async () => {
    const reader = bedrockCardReader('m', {
      send: () =>
        Promise.resolve({
          output: { message: { role: 'assistant', content: [{ text: 'no' }] } },
        } as unknown as ConverseCommandOutput),
    });
    await expect(reader.read(new Uint8Array([1]), 'image/png')).resolves.toBeUndefined();
  });
});
