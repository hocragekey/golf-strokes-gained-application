import { BASELINES, DEFAULT_BASELINE } from '@golf-sg/shared';
import { useSyncExternalStore } from 'react';

const BASELINE_KEY = 'golf-sg.baseline';
const CHANGE_EVENT = 'golf-sg:preferences';

function readBaselineId(): string {
  const stored = localStorage.getItem(BASELINE_KEY);
  return stored !== null && stored in BASELINES ? stored : DEFAULT_BASELINE.id;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setBaselineId(id: string): void {
  localStorage.setItem(BASELINE_KEY, id);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The baseline the golfer compares against; a per-device preference, not synced data. */
export function useBaselineId(): string {
  return useSyncExternalStore(subscribe, readBaselineId, () => DEFAULT_BASELINE.id);
}
