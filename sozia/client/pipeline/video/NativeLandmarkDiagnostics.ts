export interface NativeLandmarkCounters {
  dispatched: number;
  normalized: number;
  polled: number;
  sent: number;
}

type Listener = (counters: NativeLandmarkCounters) => void;

const EMPTY: NativeLandmarkCounters = {
  dispatched: 0,
  normalized: 0,
  polled: 0,
  sent: 0,
};

let counters: NativeLandmarkCounters = EMPTY;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l(counters);
}

export const NativeLandmarkDiagnostics = {
  inc(field: keyof NativeLandmarkCounters): void {
    counters = { ...counters, [field]: counters[field] + 1 };
    notify();
  },
  reset(): void {
    counters = EMPTY;
    notify();
  },
  get(): NativeLandmarkCounters {
    return counters;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
