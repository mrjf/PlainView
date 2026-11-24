import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectDialect, renderPlainView } from "../src/index.js";

describe("PlainView", () => {
  it("detects PlainType, PlainData, PlainState, and plain dialects", () => {
    assert.equal(detectDialect("***plaintype***\n- :A:\n"), "plaintype");
    assert.equal(detectDialect("***plaindata***\n- :A: - 1\n"), "plaindata");
    assert.equal(detectDialect("***plainstate***\n- Starts in :Idle:.\n"), "plainstate");
    assert.equal(detectDialect("***plain***\n- :App: Desc\n"), "plain");
  });

  it("strips frontmatter, headers, and concept colons in PlainType", () => {
    const src = `---
description: "Settings"
---

***plaintype***

***definitions***

> Shared across clients.
- :DisplaySettings: How the app is displayed.
  - theme - The color theme - one of "light" or "dark".
`;
    const res = renderPlainView(src);
    assert.equal(res.dialect, "plaintype");
    assert.doesNotMatch(res.html, /\*\*\*plaintype\*\*\*/);
    assert.doesNotMatch(res.html, /description:/);
    assert.match(res.html, /<strong class="pv-name">DisplaySettings<\/strong>/);
    assert.match(res.html, /pv-comment/);
    assert.match(res.html, /pv-attr">theme</);
  });

  it("renders PlainData array indices and scalars cleanly", () => {
    const src = `***plaindata***
- :Order:
  - id - "ord_1"
  - items
    - #1 - "coffee"
    - #2 - 42
`;
    const res = renderPlainView(src);
    assert.equal(res.dialect, "plaindata");
    assert.match(res.html, /pv-index">#1</);
    assert.match(res.html, /pv-number">42</);
  });

  it("renders PlainState transitions and inline state references", () => {
    const src = `***plainstate***

- Starts in :Idle:.
- Unhandled events leave state unchanged and emit nothing.

- :Idle: Waiting.
  - On begin, when interactive, go to :Pressed:.
    - Present press.
`;
    const res = renderPlainView(src);
    assert.equal(res.dialect, "plainstate");
    assert.match(res.html, /pv-event">begin</);
    assert.match(res.html, /<strong class="pv-ref">Pressed<\/strong>/);
  });
});
