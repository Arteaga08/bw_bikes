import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["playwright-report/**", "test-results/**", ".auth/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
