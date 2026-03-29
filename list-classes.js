import fs from "fs";
import path from "path";

const ROOT = path.resolve("src");
const IGNORE_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", "coverage"]);
const INCLUDE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".json"]);

const files = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(full);
      continue;
    }

    const ext = path.extname(e.name);
    if (INCLUDE_EXT.has(ext)) {
      files.push(path.relative(process.cwd(), full).replaceAll("\\", "/"));
    }
  }
}

walk(ROOT);

files.sort((a, b) => a.localeCompare(b, "en"));

const md = [
  `Total: ${files.length}`,
  ``,
  ...files.map((f) => `-  \`${f}\``),
  ``,
].join("\n");

fs.writeFileSync("FILES.md", md, "utf8");
console.log(`Generado FILES.md con ${files.length} archivos.`);
