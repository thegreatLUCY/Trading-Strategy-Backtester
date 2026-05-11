// Web Worker entrypoint. Receives RunInput, posts back RunResult.
import { runStrategy, type RunInput, type RunResult } from './strategy-runner';

self.onmessage = (e: MessageEvent<RunInput>) => {
  let result: RunResult;
  try {
    result = runStrategy(e.data);
  } catch (err) {
    result = { ok: false, error: (err as Error).message, params: [] };
  }
  (self as unknown as Worker).postMessage(result);
};
