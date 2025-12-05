import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export interface RepoConfig {
  url: string;
  ref?: string; // Git branch/tag/commit
  paths?: string[]; // Only include these paths
  include?: string[]; // Glob patterns to include
  exclude?: string[];
}

export interface OutputConfig {
  format: "markdown" | "xml";
  maxTokens: number;
  includeTests: boolean;
}

export interface Config {
  repos: RepoConfig[];
  output: OutputConfig;
}

const CONFIG_FILE = ".breach.json";

export const DEFAULT_CONFIG: Config = {
  repos: [],
  output: {
    format: "markdown",
    maxTokens: 100_000,
    includeTests: true,
  },
};

export async function loadConfig(dir: string = process.cwd()): Promise<Config> {
  const configPath = join(dir, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const content = await readFile(configPath, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
}

export async function saveConfig(config: Config, dir: string = process.cwd()) {
  const configPath = join(dir, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

// Only GitHub for MVP...
export function parseRepoUrl(input: string) {
  let cleaned = input
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "");

  const parts = cleaned.split("/");
  if (parts.length < 2) {
    throw new Error(`Invalid repository URL: ${input}. Use owner/repo format.`);
  }

  const owner = parts[0];
  const repo = parts[1];

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}.git`,
  };
}
