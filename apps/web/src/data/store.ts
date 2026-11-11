import {
  computeStats,
  getBaseline,
  roundInputSchema,
  roundIssues,
  summarizeRound,
  type EntryIssue,
  type Round,
  type RoundDetail,
  type RoundInput,
  type RoundSummary,
  type Stats,
} from '@golf-sg/shared';
import { changeKey, type SyncKind } from '@golf-sg/shared';
import type { ZodType } from 'zod';
import { GolfDb } from './db';

export class StoreError extends Error {
  constructor(
    message: string,
    readonly issues: EntryIssue[] = [],
  ) {
    super(issues.length > 0 ? `${message}: ${issues.map((i) => i.message).join('; ')}` : message);
    this.name = 'StoreError';
  }
}

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new StoreError(
    'Invalid data',
    result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

const now = (): string => new Date().toISOString();

const newestFirst = (a: Round, b: Round): number =>
  b.playedOn.localeCompare(a.playedOn) || b.createdAt.localeCompare(a.createdAt);

/** A round is usable once every played hole has a par and yardage. */
const isComplete = (r: Round): boolean => r.layout.length === r.holes.length;

/**
 * Local-first data access. Everything (validation, strokes gained, stats) runs on the device,
 * so the app works without a network connection.
 */
export class LocalStore {
  constructor(readonly db: GolfDb = new GolfDb()) {}

  /** Records a local change in the sync outbox (pushed when signed in and online). */
  private async track(kind: SyncKind, id: string, updatedAt: string, deleted = false) {
    await this.db.pending.put({ key: changeKey(kind, id), kind, id, updatedAt, deleted });
  }

  private async rounds(limit?: number): Promise<Round[]> {
    return (await this.db.rounds.toArray()).filter(isComplete).sort(newestFirst).slice(0, limit);
  }

  async listRounds(baselineId?: string): Promise<RoundSummary[]> {
    const baseline = getBaseline(baselineId);
    return (await this.rounds()).map((round) => {
      const { holeSg: _holeSg, ...summary } = summarizeRound(round, baseline);
      return summary;
    });
  }

  async getRound(id: string, baselineId?: string): Promise<RoundDetail> {
    const round = await this.db.rounds.get(id);
    if (!round || !isComplete(round)) throw new StoreError('Round not found');
    const { holeSg, ...summary } = summarizeRound(round, getBaseline(baselineId));
    return { round, summary, holes: holeSg };
  }

  /** Saves the round with the par and yardage copied from the card. */
  async saveRound(input: RoundInput, id?: string): Promise<RoundDetail> {
    const data = parse(roundInputSchema, input);
    const issues = roundIssues(data.holes, data.layout);
    if (issues.length > 0) throw new StoreError('Scorecard has errors', issues);

    const tables = [this.db.rounds, this.db.pending];
    const roundId = await this.db.transaction('rw', tables, async () => {
      const existing = id === undefined ? undefined : await this.db.rounds.get(id);
      if (id !== undefined && !existing) throw new StoreError('Round not found');
      const round: Round = {
        id: existing?.id ?? crypto.randomUUID(),
        ...data,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await this.db.rounds.put(round);
      await this.track('round', round.id, round.updatedAt);
      return round.id;
    });
    return this.getRound(roundId);
  }

  async deleteRound(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.rounds, this.db.pending, async () => {
      await this.db.rounds.delete(id);
      await this.track('round', id, now(), true);
    });
  }

  async getStats(limit?: number, baselineId?: string): Promise<Stats> {
    return computeStats(await this.rounds(limit), getBaseline(baselineId));
  }
}
