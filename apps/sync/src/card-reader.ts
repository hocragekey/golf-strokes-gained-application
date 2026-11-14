import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { CardScanMediaType } from '@golf-sg/shared';

/** Reads the marks off a scorecard photo; returns unvalidated output for the handler to check. */
export interface CardReader {
  read(image: Uint8Array, mediaType: CardScanMediaType): Promise<unknown>;
}

const TOOL = 'record_scorecard';

export const CARD_SCAN_INSTRUCTIONS = `You read golf scorecards that the golfer marked like this:
- The golfer's own row: the score in the middle of each hole's box. Top-left corner (par 4 and 5
  only): a drive arrow: up = fairway (F), left arrow = L, right arrow = R, down = short (S), a cross
  = penalty (X). Bottom-right corner: a small number = putts. Circles or squares around a score
  are birdie/bogey decorations: ignore them. A dot on one side of the box is a missed-green side:
  ignore it.
- The row underneath (spare row): "approach yards / chip / first putt feet", e.g. "175 / s15 / 8",
  "140 / 30", "190 / r25" or, on a par 3, "s10 / 5". Copy it exactly as written, with " / "
  between items and lowercase lie letters.
Also read the printed course name, the tees of the yardage row the golfer most likely played
(say which in "tees"), and each hole's printed par and yardage.
Return every hole the golfer wrote a score for, in order. Use null for anything blank. Set
"unsure" on a hole when any of its marks is hard to read. Never guess a number you cannot see.`;

const hole = {
  type: 'object',
  required: ['number', 'par', 'yardage', 'score', 'drive', 'putts', 'stats', 'unsure'],
  properties: {
    number: { type: 'integer', minimum: 1, maximum: 18 },
    par: { type: ['integer', 'null'], minimum: 3, maximum: 6 },
    yardage: { type: ['integer', 'null'], minimum: 50, maximum: 800 },
    score: { type: ['integer', 'null'], minimum: 1, maximum: 20 },
    drive: { type: ['string', 'null'], enum: ['F', 'L', 'R', 'S', 'X', null] },
    putts: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
    stats: { type: 'string', maxLength: 40 },
    unsure: { type: 'boolean' },
  },
};

export const CARD_SCAN_TOOL_SCHEMA = {
  type: 'object',
  required: ['courseName', 'tees', 'holes'],
  properties: {
    courseName: { type: 'string', maxLength: 100 },
    tees: { type: 'string', maxLength: 40 },
    holes: { type: 'array', maxItems: 18, items: hole },
  },
};

interface Sender {
  send(command: ConverseCommand): Promise<ConverseCommandOutput>;
}

/** Amazon Bedrock vision model, forced to answer through one tool so the output is structured. */
export function bedrockCardReader(
  modelId: string,
  client: Sender = new BedrockRuntimeClient({}),
): CardReader {
  return {
    async read(image, mediaType) {
      const format = mediaType.slice('image/'.length) as 'jpeg' | 'png' | 'webp';
      const res = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: CARD_SCAN_INSTRUCTIONS }],
          messages: [
            {
              role: 'user',
              content: [
                { image: { format, source: { bytes: image } } },
                { text: 'Read this card.' },
              ],
            },
          ],
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: TOOL,
                  description: 'Record what is written on the scorecard',
                  inputSchema: { json: CARD_SCAN_TOOL_SCHEMA },
                },
              },
            ],
            toolChoice: { tool: { name: TOOL } },
          },
          inferenceConfig: { maxTokens: 4000, temperature: 0 },
        }),
      );
      return res.output?.message?.content?.find((c) => c.toolUse?.name === TOOL)?.toolUse?.input;
    },
  };
}
