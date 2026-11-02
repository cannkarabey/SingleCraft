import { fetchSources } from "./fetch-sources";
import { processItemsFn } from "./process-items";
import { nicheEmbed, radarAngle } from "./radar";
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
  nicheEmbed,
  radarAngle,
];
