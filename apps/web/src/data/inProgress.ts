import { useMemo, useSyncExternalStore } from 'react';
import type { HoleDraft, LayoutDraft } from '../components/scorecard';

const KEY = 'golf-sg.round-in-progress';
const CHANGE_EVENT = 'golf-sg:in-progress';

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
  /** Holes filled from a photo that the golfer should still check (FR-CARD-06). */
  check?: number[];
}

function parse(raw: string | null): RoundInProgress | null {
  try {
    const value = JSON.parse(raw ?? 'null') as RoundInProgress | null;
    return value && Array.isArray(value.drafts) && Array.isArray(value.layout) ? value : null;
  } catch {
    return null;
  }
}

export const loadInProgress = (): RoundInProgress | null => parse(localStorage.getItem(KEY));

export function saveInProgress(round: RoundInProgress): void {
  localStorage.setItem(KEY, JSON.stringify(round));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearInProgress(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The round in progress, re-rendering when it changes (e.g. a photo read in the background). */
export function useInProgress(): RoundInProgress | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY),
    () => null,
  );
  return useMemo(() => parse(raw), [raw]);
}

/** Holes filled so far, counted from hole 1. */
export const holesPlayed = (round: RoundInProgress): number =>
  round.drafts.slice(0, round.holeCount).filter((d) => d.score.trim() !== '').length;
