import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/index.ts",
    popup: "src/popup/index.tsx",
  },
  bundle: true,
  outdir: "dist",
  entryNames: "[name]",
  format: "iife",
  target: "chrome120",
  minify: false,
  sourcemap: true,
});

await Promise.all([
  cp("manifest.json", "dist/manifest.json"),
  cp("src/popup/index.html", "dist/popup.html"),
]);
