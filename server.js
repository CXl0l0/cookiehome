// Tiny static file server (no dependencies). Run: npm start -> http://localhost:3000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "text/plain" }).end(body);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(3000, () => console.log("Cookie Homes running at http://localhost:3000"));
