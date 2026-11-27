import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyTokens, extractTokens, renderPlainView } from "../src/index.js";

const DIR = resolve(import.meta.dirname, "../../examples/checkbox");

const TOKENS: Record<string, string> = {
  labelMaxLength: "80",
  defaultChecked: "false",
  guard: "interactive",
  pressCue: "press",
  toggleCue: "toggle",
  cancelCue: "cancel",
  commitEvent: "changed",
  accentColor: "#2c56c9",
  radiusPx: "4",
};

describe("Complete Checkbox component bundle", () => {
  const files = [
    ["tokens.plaindata", "plaindata"],
    ["contract.plaintype", "plaintype"],
    ["behavior.plainstate", "plainstate"],
    ["fixtures.plaindata", "plaindata"],
    ["component.plain", "plain"],
  ] as const;

  for (const [name, expectedDialect] of files) {
    it(`resolves all tokens and renders ${name} as ${expectedDialect}`, () => {
      const source = readFileSync(resolve(DIR, name), "utf8");
      const applied = applyTokens(source, TOKENS);
      assert.deepEqual(applied.missing, [], `${name} has unresolved tokens`);
      assert.equal(extractTokens(applied.text).length, 0);

      const rendered = renderPlainView(applied.text, { spans: applied.spans });
      assert.equal(rendered.dialect, expectedDialect);
      assert.ok(rendered.rowCount > 0);
      assert.doesNotMatch(rendered.html, /\*\*\*/);
      if (applied.spans.length > 0) {
        assert.match(rendered.html, /pv-token-resolved/);
      }
    });
  }
});
