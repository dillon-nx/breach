import fg from "fast-glob";
import { readFile, stat } from "fs/promises";
import { join, extname, basename, dirname } from "path";

export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  tokens: number; // Est. token count
  score: number; // Priority score (higher = more important)
  category: "types" | "exports" | "tests" | "examples" | "config" | "source";
}

// Totally accurate, source: trust me bro
export function estimateTokens(content: string) {
  return Math.ceil(content.length / 3.5);
}

export function scoreFile(
  relativePath: string,
  content: string,
): { score: number; category: FileInfo["category"] } {
  const filename = basename(relativePath);
  const ext = extname(relativePath);
  const dir = dirname(relativePath);

  // S Tier: Types & Definitions
  if (
    ext == ".d.ts" ||
    filename.includes("types") ||
    filename.includes("interface")
  ) {
    return { score: 100, category: "types" };
  }

  // A+ Tier: Public export / entry points
  if (
    filename === "index.ts" ||
    filename === "index.js" ||
    filename === "mod.ts"
  ) {
    return { score: 95, category: "exports" };
  }

  // A Tier: Tests (Actual usage patterns!)
  if (
    relativePath.includes(".spec.") ||
    relativePath.includes(".test.") ||
    dir.includes("__tests__")
  ) {
    return { score: 92, category: "tests" };
  }

  // A- Tier: package.json (for exports field + dependencies)
  if (filename === "package.json") {
    return { score: 90, category: "config" };
  }

  // B Tier
  if (filename.toLowerCase() === "readme.md") {
    return { score: 85, category: "examples" };
  }

  if (filename === "schema.json" || filename === "schema.d.ts") {
    return { score: 80, category: "types" };
  }

  if (dir.includes("example") || dir.includes("demo")) {
    return { score: 75, category: "examples" };
  }

  // Regular source files (Prob a better way of doing this)
  if (
    [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".vue",
      ".svelte",
      ".ripple",
      ".html",
    ].includes(ext)
  ) {
    if (content.includes("export ")) {
      return { score: 50, category: "source" };
    }

    return { score: 40, category: "source" };
  }

  if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) {
    return { score: 30, category: "config" };
  }

  return { score: 10, category: "source" };
}

const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/.next/**",
  "**/.svelte-kit/**",
  "**/coverage/**",
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/*.min.js",
  "**/*.map",
  "**/*.d.ts.map",
  "**/CHANGELOG.md",
  "**/LICENSE*",
  "**/.DS_Store",
  "**/.idea/**",
  "**/.vscode/**",
  "**/internal/**",
  "**/_internal/**",
  "**/__fixtures__/**",
  "**/__mocks__/**",
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".iso",
  ".mp3",
  ".mp4",
  ".wav",
  ".webm",
  ".ogg",
]);

export interface FilterOptions {
  paths?: string[];
  include?: string[];
  exclude?: string[];
  includeTests?: boolean;
}

export async function getFiles(repoPath: string, options: FilterOptions = {}) {
  const { paths, include, exclude, includeTests = true } = options;

  let patterns: string[];

  if (paths && paths.length > 0) {
    patterns = paths.map((p) => `${p}/**/*`);
  } else if (include && include.length > 0) {
    patterns = include;
  } else {
    patterns = [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.svelte",
      "**/*.vue",
      "**/*.json",
      "**/*.md",
    ];
  }

  const allExclude = [
    ...DEFAULT_EXCLUDE,
    ...(exclude || []),
    ...(!includeTests ? ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"] : []),
  ];

  const files = await fg(patterns, {
    cwd: repoPath,
    ignore: allExclude,
    absolute: false,
    onlyFiles: true,
  });

  const fileInfos: FileInfo[] = [];

  for (const relativePath of files) {
    const ext = extname(relativePath);

    if (BINARY_EXTENSIONS.has(ext.toLowerCase())) {
      continue;
    }

    const fullPath = join(repoPath, relativePath);

    try {
      const stats = await stat(fullPath);

      if (stats.size > 100 * 1024) {
        continue;
      }

      const content = await readFile(fullPath, "utf-8");
      const tokens = estimateTokens(content);
      const { score, category } = scoreFile(relativePath, content);

      fileInfos.push({
        path: fullPath,
        relativePath,
        content,
        tokens,
        score,
        category,
      });
    } catch (err: unknown) {
      continue;
    }
  }

  fileInfos.sort((a, b) => b.score - a.score);

  return fileInfos;
}
