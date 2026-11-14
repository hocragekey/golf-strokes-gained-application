import type { ConverseCommand, ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import {
  bedrockCardReader,
  CARD_LAYOUT_INSTRUCTIONS,
  CARD_SCAN_INSTRUCTIONS,
} from './card-reader.js';

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
    expect(input?.toolConfig?.toolChoice).toEqual({ any: {} });
  });

  it('reads a blank card with the layout instructions and tool', async () => {
    const sent: ConverseCommand[] = [];
    const layout = {
      courseName: 'Pebble Creek',
      pars: [4],
      tees: [{ name: 'Blue', yardages: [410] }],
    };
    const reader = bedrockCardReader('m', {
      send: (command) => {
        sent.push(command);
        return Promise.resolve({
          output: {
            message: {
              role: 'assistant',
              content: [{ toolUse: { toolUseId: '1', name: 'record_card_layout', input: layout } }],
            },
          },
        } as unknown as ConverseCommandOutput);
      },
    });
    await expect(reader.read(new Uint8Array([1]), 'image/jpeg', 'layout')).resolves.toEqual(layout);
    expect(sent[0]?.input.system).toEqual([{ text: CARD_LAYOUT_INSTRUCTIONS }]);
  });

  it('reads the JSON from a model that answers in text', async () => {
    const reader = bedrockCardReader('m', {
      send: () =>
        Promise.resolve({
          output: {
            message: {
              role: 'assistant',
              content: [{ text: 'Here it is: {"courseName": "X", "pars": [3], "tees": []} done' }],
            },
          },
        } as unknown as ConverseCommandOutput),
    });
    await expect(reader.read(new Uint8Array([1]), 'image/png', 'layout')).resolves.toEqual({
      courseName: 'X',
      pars: [3],
      tees: [],
    });
  });

  it('asks for plain JSON when the model rejects tool use', async () => {
    const sent: ConverseCommand[] = [];
    const reader = bedrockCardReader('m', {
      send: (command) => {
        sent.push(command);
        if (sent.length === 1) {
          return Promise.reject(
            Object.assign(new Error('tools unsupported'), { name: 'ValidationException' }),
          );
        }
        return Promise.resolve({
          output: {
            message: {
              role: 'assistant',
              content: [{ text: '{"courseName": "X", "pars": [4], "tees": []}' }],
            },
          },
        } as unknown as ConverseCommandOutput);
      },
    });
    await expect(reader.read(new Uint8Array([1]), 'image/png', 'layout')).resolves.toEqual({
      courseName: 'X',
      pars: [4],
      tees: [],
    });
    expect(sent[1]?.input.toolConfig).toBeUndefined();
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
