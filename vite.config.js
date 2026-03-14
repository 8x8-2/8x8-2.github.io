import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";

function collectHtmlEntries(startDir) {
  const entries = {};
  const ignoredDirectories = new Set([".git", "dist", "node_modules"]);

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    fs.readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) return;
        walk(fullPath);
        return;
      }

      if (!entry.isFile() || !entry.name.endsWith(".html")) return;

      const relativeName = path
        .relative(process.cwd(), fullPath)
        .replace(/\\/g, "/")
        .replace(/\/index\.html$/, "")
        .replace(/\.html$/, "");

      entries[relativeName || "index"] = fullPath;
    });
  }

  walk(startDir);
  return entries;
}

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/8x8-2",
  build: {
    rollupOptions: {
      input: collectHtmlEntries(process.cwd()),
    },
  },
}));
