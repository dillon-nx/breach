#!/usr/bin/env node

import { program } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { buildCommand } from "./commands/build.js";
import { dumpCommand } from "./commands/dump.js";
import { askCommand } from "./commands/ask.js";
import { chatCommand } from "./commands/chat.js";

program
  .name("breach")
  .description("Context bridge CLI - feed GitHub repos into LLMs")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize a new .breach.json config file")
  .action(initCommand);

program
  .command("add <repo>")
  .description("Add a repository to your context")
  .option(
    "-p, --paths <paths>",
    "Comma-separated paths to include (e.g., src,lib)",
  )
  .option("-r, --ref <ref>", "Git ref (branch, tag, commit)")
  .option("-i, --include <patterns>", "Glob patterns to include")
  .option("-e, --exclude <patterns>", "Glob patterns to exclude")
  .action(addCommand);

program
  .command("list")
  .alias("ls")
  .description("List configured repositories")
  .action(listCommand);

program
  .command("build")
  .description("Build combined context from all configured repos")
  .option("-o, --output <file>", "Output filename")
  .option("-b, --budget <tokens>", "Token budget (default: from config)")
  .option("-f, --format <format>", "Output format: markdown or xml")
  .option("--no-tests", "Exclude test files")
  .action(buildCommand);

program
  .command("dump <repo>")
  .description("Quick dump of a single repo (no config needed)")
  .option("-o, --output <file>", "Output filename")
  .option("-b, --budget <tokens>", "Token budget (default: 50000)")
  .option("-f, --format <format>", "Output format: markdown or xml")
  .option("-p, --paths <paths>", "Comma-separated paths to include")
  .option("--no-tests", "Exclude test files")
  .option("-l, --local", "Treat input as local path instead of GitHub repo")
  .action(dumpCommand);

program
  .command("ask <question>")
  .description("Ask a one-off question with repo context")
  .option("-c, --context <file>", "Pre-built context file to use")
  .option("-l, --local <path>", "Local directory to use as context")
  .option("-b, --budget <tokens>", "Token budget for context (default: 50000)")
  .option(
    "-m, --model <model>",
    "Claude model (default: claude-sonnet-4-20250514)",
  )
  .option("-s, --system <prompt>", "Additional system prompt instructions")
  .option("-o, --output <file>", "Save response to file")
  .action(askCommand);

program
  .command("chat")
  .description("Interactive chat with Claude using repo context")
  .option("-c, --context <file>", "Pre-built context file to use")
  .option("-l, --local <path>", "Local directory to use as context")
  .option("-b, --budget <tokens>", "Token budget for context (default: 50000)")
  .option(
    "-m, --model <model>",
    "Claude model (default: claude-sonnet-4-20250514)",
  )
  .option("-s, --system <prompt>", "Additional system prompt instructions")
  .action(chatCommand);

program.parse();
