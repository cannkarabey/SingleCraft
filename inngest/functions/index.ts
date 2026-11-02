import { fetchSources } from "./fetch-sources";
import { processItemsFn } from "./process-items";
import { refreshMetrics } from "./refresh-metrics";

export const functions = [fetchSources, processItemsFn, refreshMetrics];
