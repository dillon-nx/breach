import { writeFile } from "fs/promises";
import { loadConfig, parseRepoUrl } from "../config.js";
import { cloneOrUpdate } from "../core/repo.js";
import { getFiles, FileInfo } from "../core/filter.js";
import { formatMarkdown, formatXML, RepoSection } from "../core/output.js";
import { logger } from "../utils/logger.js";

export interface BuildOptions {
  output?: string;
  budget?: string;
  format?: "markdown" | "xml";
  test?: boolean;
}

export async function buildCommand(options: BuildOptions) {
  const config = await loadConfig();

  if (config.repos.length === 0) {
    logger.error(
      "No repositories configured. Run `breach add <owner/repo> first.",
    );
    return;
  }

  const budget = options.budget
    ? parseInt(options.budget, 10)
    : config.output.maxTokens;
  const format = options.format || config.output.format;
  const includeTests = options.test ?? config.output.includeTests;
  const outputFile =
    options.output || `context.${format === "markdown" ? "md" : "xml"}`;

  logger.start(`Building context (budget: ${budget.toLocaleString()} tokens)`);

  const sections: RepoSection[] = [];
  let totalTokensAvailable = budget;

  for (const repoConfig of config.repos) {
    const { owner, repo } = parseRepoUrl(repoConfig.url);

    logger.info(`Processing ${owner}/${repo}`);

    const repoPath = await cloneOrUpdate({
      url: repoConfig.url,
      owner,
      repo,
      ref: repoConfig.ref,
    });

    const allFiles = await getFiles(repoPath, {
      paths: repoConfig.paths,
      include: repoConfig.include,
      exclude: repoConfig.exclude,
      includeTests,
    });

    const repoBudget = totalTokensAvailable / config.repos.length;
    const selectedFiles: FileInfo[] = [];
    let repoTokens = 0;

    for (const file of allFiles) {
      if (repoTokens + file.tokens > repoBudget) {
        break;
      }
      selectedFiles.push(file);
      repoTokens += file.tokens;
    }

    totalTokensAvailable -= repoTokens;

    logger.success(
      `  ${selectedFiles.length}/${allFiles.length} files (~${repoTokens.toLocaleString()} tokens)`,
    );

    sections.push({
      owner,
      repo,
      ref: repoConfig.ref,
      files: selectedFiles,
      totalTokens: repoTokens,
    });
  }

  const output =
    format === "xml"
      ? formatXML(sections, budget)
      : formatMarkdown(sections, budget);

  await writeFile(outputFile, output);

  const totalTokens = sections.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalFiles = sections.reduce((sum, s) => sum + s.files.length, 0);

  logger.box(`Generated ${outputFile}
  ${totalFiles} files, ~${totalTokens.toLocaleString()} tokens

  Copy to clipboard:
    cat ${outputFile} | pbcopy`);
}
