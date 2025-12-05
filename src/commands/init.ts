import { existsSync } from "fs";
import { join } from "path";
import { saveConfig, DEFAULT_CONFIG } from "../config.js";
import { logger } from "../utils/logger.js";

// Init a new .breach.json config file
export async function initCommand() {
  const configPath = join(process.cwd(), ".breach.json");

  if (existsSync(configPath)) {
    logger.warn("Config file .breach.json already exists");
    return;
  }

  await saveConfig(DEFAULT_CONFIG);
  logger.success("Created .breach.json");
  logger.box(`Next steps: \n
    breach add  <owner/repo>  Add a repository
    breach build              Generate context file`);
}
