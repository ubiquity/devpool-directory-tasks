/**
 * scrape-developer.ts — Scrape a developer's GitHub history and build a profile.
 *
 * Fetches closed issues across all repos the user has contributed to, extracts
 * languages / frameworks / complexity signals, and returns a structured
 * `DeveloperProfile`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeveloperProfile {
  username: string;
  languages: Record<string, number>;       // language → approximate line-count weight
  frameworks: string[];
  topics: string[];                         // repo topics the user works in
  complexityBuckets: { low: number; medium: number; high: number };
  recentIssueTitles: string[];              // last 20 titles (used for embeddings)
  totalClosedIssues: number;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  language: string | null;
  topics: string[];
}

interface GitHubIssue {
  title: string;
  body: string | null;
  labels: { name: string }[];
  closed_at: string | null;
  repository_url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

async function githubFetch(path: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json();
}

/** Paginate through GitHub issues (closed). Returns all pages. */
async function fetchClosedIssues(
  username: string,
  token?: string,
  maxPages = 10,
): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data: GitHubIssue[] = await githubFetch(
      `/search/issues?q=author:${username}+is:issue+is:closed&per_page=100&page=${page}`,
      token,
    );
    // search API returns { total_count, items }
    const items = Array.isArray(data) ? data : (data as any).items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

/** Fetch all public repos for a user. */
async function fetchUserRepos(
  username: string,
  token?: string,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const data = await githubFetch(
      `/users/${username}/repos?per_page=100&page=${page}&type=all`,
      token,
    );
    if (!Array.isArray(data) || data.length === 0) break;
    repos.push(...data);
    if (data.length < 100) break;
  }
  return repos;
}

// ---------------------------------------------------------------------------
// Framework / complexity heuristics
// ---------------------------------------------------------------------------

const FRAMEWORK_HINTS: Record<string, string> = {
  react: "React",
  next: "Next.js",
  vue: "Vue",
  angular: "Angular",
  svelte: "Svelte",
  express: "Express",
  fastify: "Fastify",
  django: "Django",
  flask: "Flask",
  rails: "Ruby on Rails",
  spring: "Spring",
  tailwind: "Tailwind CSS",
  prisma: "Prisma",
  hardhat: "Hardhat",
  foundry: "Foundry",
  ethers: "Ethers.js",
};

function extractFrameworks(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const [hint, name] of Object.entries(FRAMEWORK_HINTS)) {
      if (lower.includes(hint)) found.add(name);
    }
  }
  return [...found];
}

function estimateComplexity(title: string, body: string | null): "low" | "medium" | "high" {
  const text = `${title} ${body ?? ""}`.toLowerCase();
  const highSignals = ["architect", "refactor", "migrate", "redesign", "rewrite", "overhaul"];
  const medSignals = ["implement", "feature", "integrate", "build", "create", "develop"];
  if (highSignals.some((s) => text.includes(s))) return "high";
  if (medSignals.some((s) => text.includes(s))) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Main scrape function
// ---------------------------------------------------------------------------

export async function scrapeDeveloper(
  username: string,
  githubToken?: string,
): Promise<DeveloperProfile> {
  const [issues, repos] = await Promise.all([
    fetchClosedIssues(username, githubToken),
    fetchUserRepos(username, githubToken),
  ]);

  // Languages from repos
  const languages: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.language) {
      languages[repo.language] = (languages[repo.language] ?? 0) + 1;
    }
  }

  // Topics from repos
  const topicSet = new Set<string>();
  for (const repo of repos) {
    for (const t of repo.topics ?? []) topicSet.add(t);
  }

  // Complexity buckets
  const buckets = { low: 0, medium: 0, high: 0 };
  const allTexts: string[] = [];
  for (const issue of issues) {
    const c = estimateComplexity(issue.title, issue.body);
    buckets[c]++;
    allTexts.push(issue.title);
    if (issue.body) allTexts.push(issue.body);
  }

  // Frameworks from issue titles + bodies
  const frameworks = extractFrameworks(allTexts);

  return {
    username,
    languages,
    frameworks,
    topics: [...topicSet],
    complexityBuckets: buckets,
    recentIssueTitles: issues.slice(0, 20).map((i) => i.title),
    totalClosedIssues: issues.length,
  };
}
