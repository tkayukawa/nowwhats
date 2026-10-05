import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // 開発時は /api を API サーバー（apps/api）へ中継する。同一オリジンになるため CORS 設定は不要
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  // sqlite-wasm は .wasm を相対 URL で読み込むため、事前バンドルの対象から外す（パッケージの README の指示）
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  worker: {
    format: "es",
  },
});
