// Server statis untuk dist/ yang meniru Vercel: header dan rewrite dibaca dari vercel.json.
// Dipakai untuk menguji header keamanan (CSP, Permissions-Policy) dan cache sebelum deploy.
// Pola sumber yang didukung hanya bentuk sederhana yang dipakai vercel.json proyek ini:
// "/awalan/(.*)" dan "/((?!api/).*)".
// Pemakaian: node scripts/uji/server-vercel-lokal.mjs [--port 4177]
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { bacaArgumen, PROYEK } from "./cdp.mjs";

const JENIS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".wasm": "application/wasm", ".task": "application/octet-stream", ".mp4": "video/mp4", ".webm": "video/webm",
};

const konfig = JSON.parse(readFileSync(join(PROYEK, "vercel.json"), "utf8"));
const keRegex = (sumber) => new RegExp(`^${sumber.replace(/\(\.\*\)/g, "(.*)")}$`);
const aturanHeader = (konfig.headers ?? []).map((a) => ({ pola: keRegex(a.source), headers: a.headers }));
const aturanRewrite = (konfig.rewrites ?? []).map((a) => ({ pola: keRegex(a.source), tujuan: a.destination }));

export function buatServer() {
  const dist = join(PROYEK, "dist");
  return createServer((req, res) => {
    const jalur = decodeURIComponent(new URL(req.url, "http://lokal").pathname);
    for (const a of aturanHeader) if (a.pola.test(jalur)) for (const h of a.headers) res.setHeader(h.key, h.value);
    let berkas = normalize(join(dist, jalur));
    if (!berkas.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (!existsSync(berkas) || statSync(berkas).isDirectory()) {
      const rewrite = aturanRewrite.find((a) => a.pola.test(jalur));
      berkas = join(dist, rewrite ? rewrite.tujuan : "index.html");
      if (!existsSync(berkas)) { res.writeHead(404).end(); return; }
    }
    res.setHeader("Content-Type", JENIS[extname(berkas)] ?? "application/octet-stream");
    res.writeHead(200);
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(berkas).pipe(res);
  });
}

if (process.argv[1] && process.argv[1].endsWith("server-vercel-lokal.mjs")) {
  const port = Number(bacaArgumen().port ?? 4177);
  buatServer().listen(port, () => console.log(`dist/ dengan header vercel.json: http://localhost:${port}`));
}
