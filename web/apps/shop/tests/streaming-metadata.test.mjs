import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../src/shared/lib/streaming-metadata.ts");
const loaded = { exports: {} };
new Function("exports", "module", ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(loaded.exports, loaded);
const { BLOCKING_METADATA_AGENTS, STREAMING_METADATA_MARK } = loaded.exports;

// Next.js compiles the pattern from its source, case-insensitive, and waits for metadata when it matches.
const waits = (agent) => new RegExp(BLOCKING_METADATA_AGENTS.source, "i").test(agent);

test("every reader waits for the metadata unless the proxy marked the request", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  for (const agent of [chrome, "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "TelegramBot (like TwitterBot)", "facebookexternalhit/1.1"]) {
    assert.equal(waits(agent), true, agent);
  }
  assert.equal(waits(`${chrome} ${STREAMING_METADATA_MARK}`), false);
  assert.equal(waits(`${chrome} ${STREAMING_METADATA_MARK.toLowerCase()}`), false);
});
