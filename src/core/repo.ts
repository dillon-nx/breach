import { simpleGit, SimpleGit } from "simple-git";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { logger } from "../utils/logger.js";

// For MVP..
// Idk how people do local caches
const CACHE_DIR = join(homedir(), ".breach-cache");

export async function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }

  return CACHE_DIR;
}

// Generate a cache path like ~/.breach-cache/<owner>--<repo>
export function getRepoCachePath(owner: string, repo: string) {
  return join(CACHE_DIR, `${owner}--${repo}`);
}

export interface CloneOptions {
  url: string;
  owner: string;
  repo: string;
  ref?: string;
  sparse?: string[]; // Only checkout these paths (for larger repos)
  local?: boolean; // If true, url is a local path not a Git URL.
}

export async function cloneOrUpdate(options: CloneOptions) {
  // Local Mode:
  if (options.local) {
    if (!existsSync(options.url)) {
      throw new Error(`Local path does not exist: ${options.url}`);
    }
    logger.info(`Using local path: ${options.url}`);
    return options.url;
  }

  await ensureCacheDir();

  const repoPath = getRepoCachePath(options.owner, options.repo);
  const git: SimpleGit = simpleGit();

  if (existsSync(repoPath)) {
    // Repo already cached, try to update it:
    const repoGit = simpleGit(repoPath);

    try {
      logger.info(`Updating ${options.owner}/${options.repo}...`);
      await repoGit.fetch(["--all"]);

      if (options.ref) {
        await repoGit.checkout(options.ref);
        await repoGit
          .pull("origin", options.ref, { "--rebase": "true" })
          .catch();
      }
    } catch (err: unknown) {
      logger.error("Could not update, using cached version");
    }
  } else {
    logger.info(`Cloning ${options.owner}/${options.repo}...`);

    await git.clone(options.url, repoPath, ["--depth=1"]);

    if (options.ref) {
      const repoGit = simpleGit(repoPath);
      await repoGit.fetch(["origin", options.ref, "--depth=1"]);
      await repoGit.checkout(options.ref);
    }
  }

  return repoPath;
}
