import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");

await fs.access(server);
await fs.mkdir(path.join(standalone, ".next"), { recursive: true });
await fs.cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
try {
  await fs.cp(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

process.chdir(standalone);
await import(pathToFileURL(server).href);
