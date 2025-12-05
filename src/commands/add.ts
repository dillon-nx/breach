import { loadConfig, saveConfig, parseRepoUrl, RepoConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export interface AddOptions {
  paths?: string;
  ref?: string;
  include?: string;
  exclude?: string;
}

export async function addCommand(repoInput: string, options: AddOptions) {
  const config = await loadConfig();
  const { owner, repo, url } = parseRepoUrl(repoInput);

  const existing = config.repos.find((r) => r.url === url);
  if (existing) {
    logger.warn(`${owner}/${repo} is already in your config`);
    logger.info("Edit .breach.json directly to modify it");
    return;
  }

  const repoConfig: RepoConfig = { url };

  if (options.ref) {
    repoConfig.ref = options.ref;
  }

  if (options.paths) {
    repoConfig.paths = options.paths.split(",").map((p) => p.trim());
  }

  if (options.include) {
    repoConfig.include = options.include.split(",").map((p) => p.trim());
  }

  if (options.exclude) {
    repoConfig.exclude = options.exclude.split(",").map((p) => p.trim());
  }

  config.repos.push(repoConfig);
  await saveConfig(config);

  logger.success(`Added ${owner}/${repo}`);

  if (repoConfig.paths) {
    logger.info(`Paths: ${repoConfig.paths.join(", ")}`);
  }

  logger.info("Run `breach build` to generate context");
}
