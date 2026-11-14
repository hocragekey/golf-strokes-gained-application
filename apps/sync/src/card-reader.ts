import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { CardScanKind, CardScanMediaType } from '@golf-sg/shared';

/** Reads the marks off a scorecard photo; returns unvalidated output for the handler to check. */
export interface CardReader {
  read(image: Uint8Array, mediaType: CardScanMediaType, kind?: CardScanKind): Promise<unknown>;
}

const TOOL = 'record_scorecard';

export const CARD_SCAN_INSTRUCTIONS = `You read golf scorecards that the golfer marked like this:
- The golfer's own row: the score in the middle of each hole's box. Top-left corner (par 4 and 5
  only): a drive arrow: up = fairway (F), left arrow = L, right arrow = R, down = short (S), one
  cross = penalty drop (X), two crosses = out of bounds re-tee (XX). Bottom-right corner: a small number = putts. Circles or squares around a score
  are birdie/bogey decorations: ignore them. A dot on one side of the box is a missed-green side:
  ignore it.
- The row underneath (spare row): "[yards left after drive /] approach yards / chip / first putt
  feet", e.g. "175 / s15 / 8", "140 / 30", "190 / r25", on a par 5 "250 / 110 / 25" or, on a par
  3, "s10 / 5". Copy it exactly as written, with " / "
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
    drive: { type: ['string', 'null'], enum: ['F', 'L', 'R', 'S', 'X', 'XX', null] },
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

export const CARD_LAYOUT_INSTRUCTIONS = `You read the printed layout of a golf scorecard before the round.
Return the course name, each hole's printed par in hole order (hole 1 first) in "pars", and one
entry in "tees" for every yardage row printed on the card, named as printed (e.g. "Blue",
"White", "Gold"), with that row's yardage for each hole in hole order. Ignore totals (Out, In,
Total), handicap/stroke-index rows and anything handwritten. Use null for anything you cannot
read. Never guess a number you cannot see.`;

const yardageRow = {
  type: 'array',
  maxItems: 18,
  items: { type: ['integer', 'null'], minimum: 50, maximum: 800 },
};

export const CARD_LAYOUT_TOOL_SCHEMA = {
  type: 'object',
  required: ['courseName', 'pars', 'tees'],
  properties: {
    courseName: { type: 'string', maxLength: 100 },
    pars: {
      type: 'array',
      maxItems: 18,
      items: { type: ['integer', 'null'], minimum: 3, maximum: 6 },
    },
    tees: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: ['name', 'yardages'],
        properties: { name: { type: 'string', maxLength: 40 }, yardages: yardageRow },
      },
    },
  },
};

const PROMPTS = {
  marks: {
    system: CARD_SCAN_INSTRUCTIONS,
    tool: TOOL,
    description: 'Record what is written on the scorecard',
    schema: CARD_SCAN_TOOL_SCHEMA,
  },
  layout: {
    system: CARD_LAYOUT_INSTRUCTIONS,
    tool: 'record_card_layout',
    description: 'Record the printed course layout',
    schema: CARD_LAYOUT_TOOL_SCHEMA,
  },
} as const;

/** The JSON object in a text answer, for models that reply in text instead of calling the tool. */
function jsonIn(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

interface Sender {
  send(command: ConverseCommand): Promise<ConverseCommandOutput>;
}

/**
 * A vision model on Amazon Bedrock, asked to answer through one tool so the output is structured.
 * Open-weight models that answer in text instead are read from the JSON in their reply.
 */
export function bedrockCardReader(
  modelId: string,
  client: Sender = new BedrockRuntimeClient({}),
): CardReader {
  return {
    async read(image, mediaType, kind = 'marks') {
      const prompt = PROMPTS[kind];
      const format = mediaType.slice('image/'.length) as 'jpeg' | 'png' | 'webp';
      const res = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: prompt.system }],
          messages: [
            {
              role: 'user',
              content: [
                { image: { format, source: { bytes: image } } },
                { text: `Read this card and answer by calling ${prompt.tool}.` },
              ],
            },
          ],
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: prompt.tool,
                  description: prompt.description,
                  inputSchema: { json: prompt.schema },
                },
              },
            ],
            toolChoice: { any: {} },
          },
          inferenceConfig: { maxTokens: 4000, temperature: 0 },
        }),
      );
      const content = res.output?.message?.content ?? [];
      const call = content.find((c) => c.toolUse?.name === prompt.tool)?.toolUse?.input;
      return call ?? jsonIn(content.map((c) => c.text ?? '').join(''));
    },
  };
}
