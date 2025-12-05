# Breach

<div align="center">
  <img src="./media/breach_logo_sm.png" alt="Breach" />
</div>

Feed GitHub repos into LLMs as distilled context, then chat with Claude about them.

## The Problem

LLMs hallucinate library APIs. When you ask "Create an Nx generator that uses SvelteKit", it invents APIs that don't exist because its training data is outdated or incomplete.

## The Solution

**breach** clones repos and extracts the *skeleton* — types, exports, tests, and configs — filtering out implementation noise. This gives the LLM ground truth about how to actually use a library.

## Installation
```bash
git clone <your-repo>
cd breach
npm install
npm run build
npm link  # Makes 'breach' available globally
```

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Quick Start

### One-off dump
```bash
# Dump a GitHub repo
breach dump supermacro/neverthrow --budget 20000

# Dump a local project
breach dump . --local

# Ask a question with context
breach ask "How do I chain Result types?" --context neverthrow-context.md
```

### Multi-repo workflow
```bash
# Initialize config
breach init

# Add repos you want to learn about
breach add nrwl/nx --paths "packages/devkit/src"
breach add sveltejs/kit --paths "packages/kit/src"

# See what's configured
breach list

# Build combined context
breach build --budget 50000

# Chat with Claude about all of them
breach chat
```

## Commands

| Command | Description |
|---------|-------------|
| `breach init` | Create `.breach.json` config file |
| `breach add <repo>` | Add a repo to your config |
| `breach list` | Show configured repos |
| `breach build` | Generate context from all configured repos |
| `breach dump <repo>` | Quick one-off context dump |
| `breach ask <question>` | Ask Claude a question with context |
| `breach chat` | Interactive chat session with context |

### Common Options
```bash
# Limit which paths to include
breach add nrwl/nx --paths "packages/devkit/src,packages/nx/src"

# Set token budget (default: 50k for dump, 100k for build)
breach dump some/repo --budget 30000

# Use local directory instead of GitHub
breach dump ./my-project --local

# Output as XML instead of Markdown
breach build --format xml

# Exclude test files
breach build --no-tests

# Use a pre-built context file
breach ask "Explain this" --context my-context.md

# Add custom instructions
breach chat --system "Focus on TypeScript patterns"
```

## How It Works

### File Scoring

Not all files are equal. breach scores files by usefulness:

| Score | Category | Examples |
|-------|----------|----------|
| 100 | Types | `*.d.ts`, `types.ts` |
| 95 | Exports | `index.ts`, `mod.ts` |
| 92 | Tests | `*.spec.ts`, `*.test.ts` |
| 90 | Config | `package.json` |
| 85 | Docs | `README.md` |
| 80 | Schemas | `schema.json` |
| 50 | Source | Files with exports |
| 40 | Source | Internal files |

Files are sorted by score, then included until the token budget is exhausted.

### What Gets Excluded

- `node_modules/`, `dist/`, `build/`
- Lock files, source maps
- Binary files (images, fonts)
- Files over 100KB
- Internal implementation directories

## Example: Creating an Nx Generator
```bash
# Set up context for Nx + SvelteKit
breach init
breach add nrwl/nx --paths "packages/devkit/src,packages/nx/src/generators"
breach add sveltejs/kit --paths "packages/kit/src"
breach build --budget 60000 -o nx-kit-context.md

# Ask Claude to create a generator
breach ask "Create an Nx generator that scaffolds a SvelteKit route with +page.svelte and +page.ts" \
  --context nx-kit-context.md \
  --output generator.md
```

Because Claude has the actual `@nx/devkit` types and SvelteKit conventions in context, it generates working code instead of hallucinated APIs.

## Project Structure
```
src/
├── cli.ts                 # Entry point, command definitions
├── config.ts              # Config file loading/saving
├── commands/
│   ├── init.ts            # breach init
│   ├── add.ts             # breach add
│   ├── list.ts            # breach list
│   ├── build.ts           # breach build
│   ├── dump.ts            # breach dump
│   ├── ask.ts             # breach ask
│   └── chat.ts            # breach chat
├── core/
│   ├── repo.ts            # Git clone/update operations
│   ├── filter.ts          # File scoring and filtering
│   └── output.ts          # Markdown/XML formatting
└── utils/
    └── logger.ts          # Consola logger instance
```

## License

MIT
