import { createHash } from "node:crypto";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const PRECACHE_MANIFEST = "precache-manifest.json";

/**
 * ビルド成果物の一覧を precache-manifest.json として出力する。
 * Service Worker（public/sw.js）がインストール時に読み、オフライン用にまとめてキャッシュする。
 * Worker や .wasm も初回表示の時点でキャッシュできるよう、実行時ではなくビルド時に一覧を作る。
 */
const precacheManifest = (): Plugin => ({
  name: "nowwhats-precache-manifest",
  apply: "build",
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle)
      .filter((f) => f !== "index.html" && f !== PRECACHE_MANIFEST && !f.endsWith(".map"))
      .sort();
    // ファイル名にはハッシュが含まれるため、一覧のハッシュがそのまま版になる
    const version = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
    this.emitFile({
      type: "asset",
      fileName: PRECACHE_MANIFEST,
      source: JSON.stringify({ version, files: ["/", ...files.map((f) => `/${f}`)] }, null, 2),
    });
  },
});

// 開発時・プレビュー時は /api を API サーバー（apps/api）へ中継する。同一オリジンになるため CORS 設定は不要
const proxy = { "/api": "http://127.0.0.1:8787" };

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheManifest()],
  server: { proxy },
  preview: { proxy },
  // sqlite-wasm は .wasm を相対 URL で読み込むため、事前バンドルの対象から外す（パッケージの README の指示）
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  worker: {
    format: "es",
  },
});
