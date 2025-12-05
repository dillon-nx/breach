import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import { loadConfig, parseRepoUrl } from "../config.js";
import { cloneOrUpdate } from "../core/repo.js";
import { getFiles, FileInfo } from "../core/filter.js";
import { formatMarkdown, RepoSection } from "../core/output.js";
import { logger } from "../utils/logger.js";

export interface AskOptions {
  // Pre-built context file
  context?: string;

  // Toke budget for request
  budget?: string;

  // MVP: Just Claude models to use
  model?: string;

  // Additional system prompt
  system?: string;

  // Local file to use as context
  local?: string;

  // Output file to write response to
  output?: string;
}

async function buildContextFromConfig(budget: number) {
  const config = await loadConfig();

  if (config.repos.length === 0) {
    return "";
  }

  const sections: RepoSection[] = [];
  let totalTokensAvailable = budget;

  for (const repoConfig of config.repos) {
    const { owner, repo } = parseRepoUrl(repoConfig.url);

    logger.info(`Loading ${owner}/${repo}...`);

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
      includeTests: config.output.includeTests,
    });

    const repoBudget = totalTokensAvailable / config.repos.length;
    const selectedFiles: FileInfo[] = [];
    let repoTokens = 0;

    for (const file of allFiles) {
      if (repoTokens + file.tokens > repoBudget) break;
      selectedFiles.push(file);
      repoTokens += file.tokens;
    }

    totalTokensAvailable -= repoTokens;

    sections.push({
      owner,
      repo,
      ref: repoConfig.ref,
      files: selectedFiles,
      totalTokens: repoTokens,
    });
  }

  return formatMarkdown(sections, budget);
}

async function buildContextFromLocal(localPath: string, budget: number) {
  logger.info(`Loading local: ${localPath}...`);

  const allFiles = await getFiles(localPath, { includeTests: true });

  const selectedFiles: FileInfo[] = [];
  let totalTokens = 0;

  for (const file of allFiles) {
    if (totalTokens + file.tokens > budget) break;
    selectedFiles.push(file);
    totalTokens += file.tokens;
  }

  const section: RepoSection = {
    owner: "local",
    repo: basename(localPath),
    files: selectedFiles,
    totalTokens,
  };

  return formatMarkdown([section], budget);
}

export async function askCommand(question: string, options: AskOptions) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.error("ANTHROPIC_API_KEY environment variable is required");
    logger.info("Get your key at: https://console.anthropic.com/");
    logger.info("Then run: export ANTHROPIC_API_KEY=your-key-here");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const model = options.model || "claude-sonnet-4-20250514";
  const budget = options.budget ? parseInt(options.budget, 10) : 50000;

  let context = "";

  if (options.context) {
    if (!existsSync(options.context)) {
      logger.error(`Context file not found: ${options.context}`);
      process.exit(1);
    }
    logger.start(`Loading context from ${options.context}...`);
    context = await readFile(options.context, "utf-8");
  } else if (options.local) {
    logger.start("Building context from local directory...");
    context = await buildContextFromLocal(options.local, budget);
  } else {
    logger.start("Building context from configured repos...");
    context = await buildContextFromConfig(budget);
  }

  const systemParts = [
    "You are an expert software developer assistant.",
    "You have access to the following codebase context which contains types, exports, tests, and documentation from relevant libraries.",
    "Use this context to provide accurate, working code examples that match the actual APIs.",
    "When writing code, prefer patterns you see in the tests and examples.",
    "If you're unsure about an API, say so rather than guessing.",
  ];

  if (options.system) {
    systemParts.push("", "Additional instructions:", options.system);
  }

  if (context) {
    systemParts.push(
      "",
      "---",
      "",
      "<codebase_context>",
      context,
      "</codebase_context>",
    );
  }

  const systemPrompt = systemParts.join("\n");

  logger.start(`Asking Claude (${model})...`);

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    let fullResponse = "";

    process.stdout.write("\r\x1b[K"); // Clear current line

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        process.stdout.write(event.delta.text);
        fullResponse += event.delta.text;
      }
    }

    console.log("\n");

    if (options.output) {
      await writeFile(options.output, fullResponse);
      logger.success(`Saved to ${options.output}`);
    }
  } catch (error: any) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
