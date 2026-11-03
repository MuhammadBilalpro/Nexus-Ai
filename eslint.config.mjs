import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // UI layers may never reach the database, secrets or server-only auth internals.
    // They talk to the server through Server Actions in features/**/actions and typed read models.
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          // Types are erased at build time; only runtime imports leak server code.
          patterns: [
            { group: ["@/server/*", "@/server/**"], message: "UI code must not import server modules. Use a Server Action or pass data as props.", allowTypeImports: true },
            { group: ["@/lib/env"], message: "Environment variables are server-only.", allowTypeImports: true },
            { group: ["@/generated/prisma/client"], message: "Import enums from @/generated/prisma/enums; never the client in UI code.", allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ["prisma/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "coverage/**"]),
]);

export default eslintConfig;
