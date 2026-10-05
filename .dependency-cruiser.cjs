/**
 * オニオンアーキテクチャの依存方向を機械的に強制する。
 * ルールの意図は docs/developer/development.md と ADR 0001 を参照。
 */
const TEST_FILE = "\\.test\\.ts$";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "循環依存を禁止する",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment:
        "domain は同一パッケージの domain と shared-kernel 以外に依存しない（npm パッケージ・Node 組み込みモジュールも禁止）",
      from: { path: "^packages/([^/]+)/src/domain/", pathNot: TEST_FILE },
      to: { pathNot: ["^packages/$1/src/domain/", "^packages/shared-kernel/src/"] },
    },
    {
      name: "application-depends-only-inward",
      severity: "error",
      comment:
        "application は同一パッケージの domain / application、shared-kernel、他コンテキストの公開 API（infrastructure-* を除く）以外に依存しない",
      from: { path: "^packages/([^/]+)/src/application/", pathNot: TEST_FILE },
      to: {
        pathNot: [
          "^packages/$1/src/(domain|application)/",
          "^packages/shared-kernel/src/",
          "^packages/(?!infrastructure-)[^/]+/src/index\\.ts$",
        ],
      },
    },
    {
      name: "shared-kernel-is-pure",
      severity: "error",
      comment: "shared-kernel は外部に依存しない",
      from: { path: "^packages/shared-kernel/src/", pathNot: TEST_FILE },
      to: { pathNot: "^packages/shared-kernel/src/" },
    },
    {
      name: "cross-package-via-public-api",
      severity: "error",
      comment: "他パッケージは公開 API（src/index.ts）経由でのみ参照する",
      from: { path: "^(packages|apps)/([^/]+)/" },
      to: {
        path: "^packages/[^/]+/src/",
        pathNot: ["^packages/$2/", "^packages/[^/]+/src/index\\.ts$"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["node_modules", "\\.turbo"] },
    tsConfig: { fileName: "tsconfig.base.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
    },
  },
};
