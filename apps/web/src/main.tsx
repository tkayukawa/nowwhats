import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("#root not found");
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// オフラインでも画面を開けるようにする（本番ビルドのみ。開発サーバーの HMR と干渉させない）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e: unknown) => {
      console.warn("service worker registration failed", e);
    });
  });
}
