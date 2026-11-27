import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
export const shopSrc = resolve(here, "../../src");
export const sharedRoot = resolve(here, "../../../../packages/shared");

const aliases = {
  "@/": `${shopSrc}/`,
  "@polivalko/shared/": `${sharedRoot}/`,
};

function resolveTsFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  if (existsSync(`${base}.ts`)) return `${base}.ts`;
  if (existsSync(`${base}.tsx`)) return `${base}.tsx`;
  if (existsSync(`${base}/index.ts`)) return `${base}/index.ts`;
  throw new Error(`Cannot resolve TypeScript module at ${base}`);
}

/** Loads a TypeScript/TSX storefront module with path aliases resolved in-process for Node unit tests. */
export function loadTs(file, seen = new Map()) {
  const resolved = resolveTsFile(file);
  if (seen.has(resolved)) return seen.get(resolved).exports;
  const loaded = { exports: {} };
  seen.set(resolved, loaded);
  const js = ts.transpileModule(readFileSync(resolved, "utf8"), {
    fileName: resolved,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const require = (name) => {
    if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: Symbol("Fragment") };
    const alias = Object.keys(aliases).find((prefix) => name.startsWith(prefix));
    const base = alias
      ? aliases[alias] + name.slice(alias.length)
      : name.startsWith(".")
        ? resolve(dirname(resolved), name)
        : null;
    if (!base) throw new Error(`Unexpected runtime import "${name}" in ${resolved}`);
    return loadTs(base, seen);
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, require);
  return loaded.exports;
}

export const loadShop = (relPath) => loadTs(resolve(shopSrc, relPath));
export const loadShared = (relPath) => loadTs(resolve(sharedRoot, relPath));
