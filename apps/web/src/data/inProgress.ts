import type { HoleDraft, LayoutDraft } from '../components/scorecard';

const KEY = 'golf-sg.round-in-progress';

/** A new round being entered hole by hole, kept on the device until it is saved or discarded. */
export interface RoundInProgress {
  courseName: string;
  tees: string;
  playedOn: string;
  notes: string;
  holeCount: number;
  layout: LayoutDraft[];
  drafts: HoleDraft[];
  /** The hole on screen when the round was last saved (0-based). */
  hole?: number;
}

export function loadInProgress(): RoundInProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RoundInProgress | null;
    return value && Array.isArray(value.drafts) && Array.isArray(value.layout) ? value : null;
  } catch {
    return null;
  }
}

export function saveInProgress(round: RoundInProgress): void {
  localStorage.setItem(KEY, JSON.stringify(round));
}

export function clearInProgress(): void {
  localStorage.removeItem(KEY);
}

/** Holes filled so far, counted from hole 1. */
export const holesPlayed = (round: RoundInProgress): number =>
  round.drafts.slice(0, round.holeCount).filter((d) => d.score.trim() !== '').length;
