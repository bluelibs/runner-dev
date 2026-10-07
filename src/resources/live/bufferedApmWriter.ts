import type { RunRecord } from "./types";
import { bufferedPersistenceWriter } from "./bufferedPersistenceWriter";

export function bufferedApmWriter<T = RunRecord>(
  write: (samples: T[]) => Promise<void> | void,
  options?: Parameters<typeof bufferedPersistenceWriter<T>>[1]
) {
  return bufferedPersistenceWriter(write, options);
}
