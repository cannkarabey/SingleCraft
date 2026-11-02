import { fetchSources } from "./fetch-sources";
import { processItemsFn } from "./process-items";
import { refreshMetrics } from "./refresh-metrics";
import {
  archiveStoriesFn,
  buildStoriesFn,
  clusterItemsFn,
  scoreStoriesFn,
} from "./story-pipeline";

export const functions = [
  fetchSources,
  processItemsFn,
  refreshMetrics,
  clusterItemsFn,
  scoreStoriesFn,
  buildStoriesFn,
  archiveStoriesFn,
];
