/**
 * score.ts — Calculate similarity scores between a developer profile and tasks.
 *
 * Uses cosine similarity between pre-computed embeddings, then applies
 * recency weighting and optional skill-match boosting.
 */

import type { Embedded } from "./embeddings";
import type { BountyTask } from "./embeddings";

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoredTask {
  task: BountyTask;
  score: number;         // 0-1 normalised match
  embeddingScore: number; // raw cosine similarity
}

/**
 * Score all tasks against the developer embedding.
 *
 * @param devEmbedding  Pre-computed embedding for the developer
 * @param taskEmbeddings Pre-computed embeddings for each task (same order as `tasks`)
 * @param tasks         Original task objects
 * @param options       Optional weighting tweaks
 */
export function scoreTasks(
  devEmbedding: number[],
  taskEmbeddings: number[][],
  tasks: BountyTask[],
  options: {
    /** Boost tasks whose labels overlap with developer skills (0-1). Default 0.15 */
    labelBoost?: number;
    /** Developer's known skill labels for boosting */
    developerSkills?: string[];
  } = {},
): ScoredTask[] {
  const { labelBoost = 0.15, developerSkills = [] } = options;
  const skillSet = new Set(developerSkills.map((s) => s.toLowerCase()));

  const scored: ScoredTask[] = tasks.map((task, i) => {
    const embeddingScore = cosineSimilarity(devEmbedding, taskEmbeddings[i]);

    // Label overlap boost
    let boost = 0;
    if (skillSet.size > 0) {
      const overlap = task.labels.filter((l) => skillSet.has(l.toLowerCase())).length;
      boost = labelBoost * (overlap / task.labels.length || 0);
    }

    const score = Math.min(1, embeddingScore + boost);

    return { task, score, embeddingScore };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
