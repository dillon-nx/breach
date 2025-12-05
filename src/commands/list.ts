import { loadConfig, parseRepoUrl } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * List all configured repositories
 */
export async function listCommand(): Promise<void> {
  const config = await loadConfig();

  if (config.repos.length === 0) {
    logger.info("No repos configured.");
    logger.info("Run `breach add <owner/repo>` to add one.");
    return;
  }

  logger.info(`Configured repositories (${config.repos.length}):\n`);

  for (const repo of config.repos) {
    const { owner, repo: repoName } = parseRepoUrl(repo.url);
    logger.log(`  • ${owner}/${repoName}`);

    // Show optional config if present
    if (repo.ref) {
      logger.log(`      ref: ${repo.ref}`);
    }
    if (repo.paths && repo.paths.length > 0) {
      logger.log(`      paths: ${repo.paths.join(", ")}`);
    }
    if (repo.include && repo.include.length > 0) {
      logger.log(`      include: ${repo.include.join(", ")}`);
    }
    if (repo.exclude && repo.exclude.length > 0) {
      logger.log(`      exclude: ${repo.exclude.join(", ")}`);
    }
  }

  logger.log("");
  logger.info(
    `Output: ${config.output.format} | Budget: ${config.output.maxTokens.toLocaleString()} tokens | Tests: ${config.output.includeTests ? "yes" : "no"}`,
  );
}
