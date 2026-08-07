import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// `eslint-config-next/core-web-vitals` is already a native ESLint 9 flat
// config array (base rules + TypeScript + Next's core-web-vitals set) — no
// `FlatCompat`/legacy `.eslintrc` translation needed for Next 16.
export default [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
