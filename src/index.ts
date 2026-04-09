/**
 * index.ts — Entry point for the DevPool Directory Matchmaking UI.
 *
 * Demonstrates the full pipeline:
 *   1. Scrape developer history → profile
 *   2. Generate embeddings (OpenAI or fallback)
 *   3. Score tasks against profile
 *   4. Stream results (simulated via async generator)
 *   5. Render UI
 *
 * Run: npx ts-node src/index.ts <github-username>
 */

import { scrapeDeveloper, developerToEmbeddable } from "./matchmaking/scrape-developer";
import {
  embedItems,
  taskToEmbeddable,
  BountyTask,
} from "./matchmaking/embeddings";
import { scoreTasks, ScoredTask } from "./matchmaking/score";

// ---------------------------------------------------------------------------
// Sample bounty tasks (in production these come from the DevPool API)
// ---------------------------------------------------------------------------

const SAMPLE_TASKS: BountyTask[] = [
  {
    id: "issue-101",
    title: "Implement real-time notification system with WebSockets",
    body: "Build a WebSocket-based notification layer that broadcasts bounty updates to connected clients. Must handle reconnection and message ordering.",
    labels: ["typescript", "websockets", "backend"],
    reward: 500,
    timeEstimate: "< 1 week",
  },
  {
    id: "issue-102",
    title: "Add dark mode to React dashboard",
    body: "Implement a theme toggle using CSS variables. Persist preference in localStorage. Ensure all chart components respect the theme.",
    labels: ["react", "css", "frontend"],
    reward: 200,
    timeEstimate: "< 1 day",
  },
  {
    id: "issue-103",
    title: "Migrate database schema from PostgreSQL to Prisma ORM",
    body: "Refactor all raw SQL queries to use Prisma. Create migration scripts. Ensure zero-downtime deployment.",
    labels: ["prisma", "postgresql", "backend"],
    reward: 900,
    timeEstimate: "< 1 week",
  },
  {
    id: "issue-104",
    title: "Build Ethereum smart contract for escrow payments",
    body: "Write a Solidity escrow contract that holds bounty funds until work is approved. Include timeout and dispute resolution.",
    labels: ["solidity", "ethereum", "smart-contracts"],
    reward: 1200,
    timeEstimate: "< 1 week",
  },
  {
    id: "issue-105",
    title: "Optimize image loading with lazy-load and blur-up",
    body: "Add progressive image loading to the task listing page. Generate low-res placeholders at build time.",
    labels: ["react", "performance", "frontend"],
    reward: 150,
    timeEstimate: "< 1 hour",
  },
];

// ---------------------------------------------------------------------------
// Streaming helper — yields scored tasks one by one
// ---------------------------------------------------------------------------

async function* streamScoredTasks(
  devEmbedding: number[],
  tasks: BountyTask[],
  apiKey?: string,
  skills?: string[],
): AsyncGenerator<ScoredTask> {
  // Embed tasks one at a time for streaming effect
  for (const task of tasks) {
    const embeddable = taskToEmbeddable(task);
    const [embedded] = await embedItems([embeddable], apiKey);

    const [scored] = scoreTasks(
      devEmbedding,
      [embedded.embedding],
      [task],
      { developerSkills: skills },
    );

    yield scored;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const username = process.argv[2];
  const apiKey = process.env.OPENAI_API_KEY;

  if (!username) {
    console.error("Usage: npx ts-node src/index.ts <github-username>");
    console.error("       Set OPENAI_API_KEY for OpenAI embeddings (optional).");
    process.exit(1);
  }

  console.log(`\n🔍 Scraping GitHub profile for @${username}…\n`);

  // 1. Scrape developer profile
  const profile = await scrapeDeveloper(username, process.env.GITHUB_TOKEN);
  console.log(`   ✓ Found ${profile.totalClosedIssues} closed issues`);
  console.log(`   ✓ Languages: ${Object.keys(profile.languages).join(", ")}`);
  console.log(`   ✓ Frameworks: ${profile.frameworks.join(", ") || "none detected"}`);
  console.log(`   ✓ Topics: ${profile.topics.slice(0, 10).join(", ")}\n`);

  // 2. Embed developer profile
  console.log("🧮 Generating embeddings…\n");
  const devEmbeddable = developerToEmbeddable(profile);
  const [devEmbedded] = await embedItems([devEmbeddable], apiKey);

  // 3 & 4. Stream scored tasks
  console.log("🎯 Matching tasks (streaming)…\n");
  console.log("─".repeat(72));

  const skills = [
    ...Object.keys(profile.languages),
    ...profile.frameworks,
    ...profile.topics,
  ];

  const allScored: ScoredTask[] = [];

  for await (const scored of streamScoredTasks(
    devEmbedded.embedding,
    SAMPLE_TASKS,
    apiKey,
    skills,
  )) {
    allScored.push(scored);
    const pct = Math.round(scored.score * 100);
    const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
    console.log(
      `  ${pct}%  ${bar}  ${scored.task.title}`,
    );
    if (scored.task.reward) {
      console.log(`        💰 $${scored.task.reward}  ⏱ ${scored.task.timeEstimate ?? "?"}`);
    }
    console.log();
  }

  console.log("─".repeat(72));
  console.log(`\n✅ Done — matched ${allScored.length} tasks for @${username}\n`);

  // 5. Render hint — in production the React component would render these
  //    results via a streaming endpoint (SSE / WebSocket).
  console.log("💡 In the web UI, these results would stream into <MatchmakingUI />.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
