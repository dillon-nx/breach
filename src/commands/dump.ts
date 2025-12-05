import { writeFile } from "fs/promises";
import { basename } from "path";
import { parseRepoUrl } from "../config.js";
import { cloneOrUpdate } from "../core/repo.js";
import { getFiles, FileInfo } from "../core/filter.js";
import { formatMarkdown, formatXML, RepoSection } from "../core/output.js";
import { logger } from "../utils/logger.js";

export interface DumpOptions {
  output?: string;
  budget?: string;
  format?: "markdown" | "xml";
  paths?: string;
  tests?: boolean;
  local?: boolean;
}

/**
 * Quick dump of a single repo - no config needed
 */
export async function dumpCommand(
  repoInput: string,
  options: DumpOptions,
): Promise<void> {
  let owner: string;
  let repo: string;
  let url: string;

  if (options.local) {
    owner = "local";
    repo = basename(repoInput); // Use folder name as repo name
    url = repoInput;
  } else {
    const parsed = parseRepoUrl(repoInput);
    owner = parsed.owner;
    repo = parsed.repo;
    url = parsed.url;
  }

  const budget = options.budget ? parseInt(options.budget, 10) : 50000;
  const format = options.format || "markdown";
  const includeTests = options.tests ?? true;
  const outputFile =
    options.output || `${repo}-context.${format === "xml" ? "xml" : "md"}`;
  const paths = options.paths?.split(",").map((p) => p.trim());

  logger.start(
    `Dumping ${owner}/${repo} (budget: ${budget.toLocaleString()} tokens)`,
  );

  const repoPath = await cloneOrUpdate({
    url,
    owner,
    repo,
    local: options.local,
  });

  logger.info("Scanning files...");
  const allFiles = await getFiles(repoPath, {
    paths,
    includeTests,
  });

  // Select files within budget
  const selectedFiles: FileInfo[] = [];
  let totalTokens = 0;

  for (const file of allFiles) {
    if (totalTokens + file.tokens > budget) {
      break;
    }
    selectedFiles.push(file);
    totalTokens += file.tokens;
  }

  logger.success(
    `Selected ${selectedFiles.length}/${allFiles.length} files (~${totalTokens.toLocaleString()} tokens)`,
  );

  const section: RepoSection = {
    owner,
    repo,
    files: selectedFiles,
    totalTokens,
  };

  const output =
    format === "xml"
      ? formatXML([section], budget)
      : formatMarkdown([section], budget);

  await writeFile(outputFile, output);

  const byCategory = new Map<string, number>();
  for (const f of selectedFiles) {
    byCategory.set(f.category, (byCategory.get(f.category) || 0) + 1);
  }

  const breakdown = Array.from(byCategory.entries())
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(" | ");

  logger.box(`Generated ${outputFile}
${selectedFiles.length} files, ~${totalTokens.toLocaleString()} tokens

${breakdown}`);
}
