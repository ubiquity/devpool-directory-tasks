/**
 * embeddings.ts — Generate embeddings for developer profiles and bounty tasks.
 *
 * Supports any OpenAI-compatible embeddings endpoint. Falls back to a simple
 * TF-IDF-style bag-of-words vector when no API key is configured.
 */

import type { DeveloperProfile } from "./scrape-developer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Embeddable {
  id: string;
  text: string;
}

export interface Embedded extends Embeddable {
  embedding: number[];
}

// ---------------------------------------------------------------------------
// OpenAI embeddings (remote)
// ---------------------------------------------------------------------------

async function openAIEmbed(
  items: Embeddable[],
  apiKey: string,
  model = "text-embedding-3-small",
  batchSize = 20,
): Promise<Embedded[]> {
  const results: Embedded[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: batch.map((b) => b.text.slice(0, 2000)),
      }),
    });
    if (!res.ok) throw new Error(`Embeddings API ${res.status}`);
    const json = await res.json();
    for (let j = 0; j < batch.length; j++) {
      results.push({
        ...batch[j],
        embedding: json.data[j].embedding as number[],
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Simple fallback: bag-of-words embedding (dimensionality = 256 via hash)
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function bowEmbed(text: string, dims = 256): number[] {
  const vec = new Float64Array(dims);
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const w of words) {
    const idx = Math.abs(hashStr(w)) % dims;
    vec[idx] += 1;
  }
  // normalise
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return Array.from(vec, (v) => v / norm);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed a list of items. Uses OpenAI if `apiKey` is provided; otherwise
 * falls back to a local bag-of-words vectoriser.
 */
export async function embedItems(
  items: Embeddable[],
  apiKey?: string,
): Promise<Embedded[]> {
  if (apiKey) return openAIEmbed(items, apiKey);
  return items.map((item) => ({
    ...item,
    embedding: bowEmbed(item.text),
  }));
}

/** Convert a DeveloperProfile into a single embeddable text blob. */
export function developerToEmbeddable(profile: DeveloperProfile): Embeddable {
  const parts: string[] = [
    `Developer ${profile.username}`,
    `Languages: ${Object.entries(profile.languages)
      .sort(([, a], [, b]) => b - a)
      .map(([l]) => l)
      .join(", ")}`,
    `Frameworks: ${profile.frameworks.join(", ")}`,
    `Topics: ${profile.topics.join(", ")}`,
    `Recent issues: ${profile.recentIssueTitles.join("; ")}`,
  ];
  return { id: `dev-${profile.username}`, text: parts.join(". ") };
}

/** Convert a bounty task into an embeddable. */
export interface BountyTask {
  id: string;
  title: string;
  body: string;
  labels: string[];
  reward?: number;
  timeEstimate?: string;
}

export function taskToEmbeddable(task: BountyTask): Embeddable {
  return {
    id: task.id,
    text: `${task.title}. ${task.body ?? ""} Labels: ${task.labels.join(", ")}`,
  };
}
