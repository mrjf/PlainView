import { applyTokens, extractTokens, renderPlainView } from "../../src/index.js";

const DEFAULT_TOKENS: Record<string, string> = {
  currency: '"USD"',
  coffeePrice: "18.50",
  filterPrice: "7.00",
};

const EXAMPLES: Record<string, string> = {
  plaintype: `---
description: "Per-user display settings"
---

***plaintype***

***definitions***

> Shared by the web and desktop clients.
- :DisplaySettings: How the app is displayed for one user.
  - theme - The color theme - one of "light", "dark", or "system". Defaults to "system".
  - fontSize - The body font size in points - an integer between 8 and 72. Defaults to 14.
  - displayName (optional) - The name shown in the header - a string between 1 and 40 characters.
`,
  plaindata: `***plaindata***
- :Order:
  - id - "ord_2026_0042"
  - paid - true
  - currency - {{currency}}
  - items
    - #1
      - sku - "COFFEE-250G"
      - qty - 2
      - unitPrice - {{coffeePrice}}
    - #2
      - sku - "FILTER-100"
      - qty - 1
      - unitPrice - {{filterPrice}}
  - notes - []
`,
  plainstate: `***plainstate***

- Starts in :Idle:.
- Unhandled events leave state unchanged and emit nothing.

- :Idle: No gesture is in progress.
  - On begin, when interactive, go to :Pressed:.
    - Present press.
  - On activate, when interactive, stay.
    - Emit activated with an empty payload.
    - Present activation.
- :Pressed: One gesture is in progress.
  - On release, when interactive, go to :Idle:.
    - Emit activated with an empty payload.
    - Present activation.
  - On cancel, go to :Idle:.
    - Present cancel.
`,
  plain: `***plain***

***component***

> A themed checkbox that binds to a single Boolean field.
- :Checkbox: A toggleable control with an explicit label.
  - Data uses :BooleanValue:.
  - UI state uses :CheckboxState:.
  - Initial value is false.
`,
};

const sourceInput = document.getElementById("source-input") as HTMLTextAreaElement;
const readerView = document.getElementById("reader-view") as HTMLDivElement;
const tokensBar = document.getElementById("tokens-bar") as HTMLDivElement;
const dialectBadge = document.getElementById("dialect-badge") as HTMLSpanElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const statusMeta = document.getElementById("status-meta") as HTMLSpanElement;
const exampleSelect = document.getElementById("example-select") as HTMLSelectElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const copyHtmlBtn = document.getElementById("copy-html") as HTMLButtonElement;

let lastHtml = "";
const tokenValues: Record<string, string> = { ...DEFAULT_TOKENS };

function renderTokensBar(tokens: string[]): void {
  tokensBar.hidden = tokens.length === 0;
  const existing = Array.from(tokensBar.querySelectorAll<HTMLInputElement>("input[data-token]")).map(
    (el) => el.dataset.token!,
  );
  if (existing.join(",") === tokens.join(",")) return;
  tokensBar.innerHTML = "";
  for (const token of tokens) {
    const label = document.createElement("label");
    label.className = "token-field";
    const span = document.createElement("span");
    span.textContent = `{{${token}}}`;
    const input = document.createElement("input");
    input.dataset.token = token;
    input.value = tokenValues[token] ?? "";
    input.placeholder = "value";
    input.addEventListener("input", () => {
      if (input.value === "") delete tokenValues[token];
      else tokenValues[token] = input.value;
      render();
    });
    label.append(span, input);
    tokensBar.appendChild(label);
  }
}

function render(): void {
  const tokens = extractTokens(sourceInput.value);
  renderTokensBar(tokens);
  const applied = applyTokens(sourceInput.value, tokenValues);
  const res = renderPlainView(applied.text, { spans: applied.spans });
  lastHtml = res.html;
  readerView.innerHTML = res.html;
  dialectBadge.textContent = res.dialect;
  statusText.textContent = "Rendered";
  const tokenNote = tokens.length ? ` · ${tokens.length} tokens` : "";
  statusMeta.textContent = `${res.dialect} · ${res.rowCount} rows${tokenNote}`;
}

function loadExample(id: string): void {
  sourceInput.value = EXAMPLES[id] ?? EXAMPLES.plaintype!;
  render();
}

sourceInput.addEventListener("input", render);
exampleSelect.addEventListener("change", () => loadExample(exampleSelect.value));
resetBtn.addEventListener("click", () => loadExample(exampleSelect.value));
copyHtmlBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastHtml);
    copyHtmlBtn.textContent = "Copied";
    setTimeout(() => { copyHtmlBtn.textContent = "Copy HTML"; }, 1200);
  } catch {
    copyHtmlBtn.textContent = "Failed";
  }
});

loadExample("plaintype");
