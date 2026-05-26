import nextPlugin from "@next/eslint-plugin-next/dist/index.js";

const eslintConfig = [
  {
    ignores: [".next/**", ".next*/**", "node_modules/**", "convex/_generated/**"]
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        Blob: "readonly",
        console: "readonly",
        document: "readonly",
        navigator: "readonly",
        process: "readonly",
        React: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        window: "readonly"
      }
    },
    plugins: {
      "@next/next": nextPlugin
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-unused-vars": "off",
      "no-undef": "error"
    }
  }
];

export default eslintConfig;
