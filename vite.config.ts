import { defineConfig, loadEnv } from "vite";
import { defineConfig as defineTestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
// Include only public app assets. Never cache Supabase responses or auth tokens.
function offlineShell() {
  return {
    name: "eggpro-installable-shell",
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const assets = Object.keys(bundle)
        .filter((p) => !p.endsWith(".map"))
        .map((p) => "/" + p);
      const version = createHash("sha256")
        .update(JSON.stringify(assets))
        .digest("hex")
        .slice(0, 12);
      const paths = [
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/icon.svg",
        "/fonts.css",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/sql-wasm.wasm",
        ...assets,
      ];
      const source = `const CACHE='eggpro-shell-${version}';const ASSETS=${JSON.stringify(paths)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eggpro-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
if(req.mode==='navigate'){event.respondWith(caches.match('/index.html').then(hit=>hit||fetch(req)));return;}
if(url.search||!ASSETS.includes(url.pathname))return;event.respondWith(caches.match(req,{ignoreVary:true}).then(hit=>hit||fetch(req)));});`;
      (this as unknown as { emitFile(f: unknown): void }).emitFile({
        type: "asset",
        fileName: "sw.js",
        source,
      });
    },
  };
}
export default defineTestConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  let origin = "";
  if (env.VITE_SUPABASE_URL) origin = new URL(env.VITE_SUPABASE_URL).origin;
  if (env.VITE_API_URL) origin += " " + new URL(env.VITE_API_URL).origin;
  const csp = `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${origin}; object-src 'none'; base-uri 'self'; form-action 'self'`;
  return {
    plugins: [
      react(),
      {
        name: "eggpro-csp",
        transformIndexHtml(html, context) {
          return html.replace(
            "<!-- CSP -->",
            context.server
              ? ""
              : `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
        },
      },
      offlineShell(),
    ],
    server: { proxy: { "/api": "http://127.0.0.1:3000" } },
    optimizeDeps: { entries: ["index.html"] },
    test: { include: ["tests/**/*.test.ts"] },
    build: { chunkSizeWarningLimit: 800 },
  };
});
