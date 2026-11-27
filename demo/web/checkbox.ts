import { applyTokens, renderPlainView } from "../../src/index.js";

const INITIAL_TOKENS: Record<string, string> = {
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

const INITIAL_FILES: Record<string, string> = {
  "component.plain": `***plain***

***component***

> A portable, framework-agnostic Checkbox described purely in Plain formats.
- :Checkbox: A binary toggle control with a visible label and deterministic gesture handling.
  - Tokens use "tokens.plaindata".
  - Contract uses "contract.plaintype".
  - Machine uses "behavior.plainstate".
  - Fixtures use "fixtures.plaindata".

***interaction***

- Pressing Space while focused sends toggle to the machine.
- Pointer down sends press; pointer up inside sends release; pointer cancel or leave sends cancel.
- While disabled, the {{guard}} guard is false and no toggle commits.

***presentation***

- Accent fill uses {{accentColor}} with a {{radiusPx}}px corner radius.
- {{pressCue}} gives immediate tactile feedback without emitting a change.
- {{toggleCue}} commits the checkmark transition on release or Space.
- {{cancelCue}} restores the prior state silently without emitting {{commitEvent}}.
`,
  "contract.plaintype": `---
description: "Data, state, and event contracts for a standalone Checkbox component"
---

***plaintype***

***definitions***

> Public inputs supplied by the host or parent view.
- :CheckboxProps: Configuration for one checkbox instance.
  - label - Visible text label - a string between 1 and {{labelMaxLength}} characters.
  - checked (optional) - Initial or controlled checked state - a boolean. Defaults to {{defaultChecked}}.
  - disabled (optional) - Whether user interaction is blocked - a boolean. Defaults to false.

> Observable state owned by the checkbox state machine.
- :CheckboxState: Current phase and visual state.
  - phase - Active machine state - one of "Unchecked", "PressingToCheck", "Checked", or "PressingToUncheck".
  - checked - Derived Boolean value - a boolean.
  - focused - Whether the control holds keyboard focus - a boolean.
  - hovered - Whether a pointer is currently over the control - a boolean.

> Domain event emitted when a toggle commits.
- :CheckboxChangeEvent: Payload emitted on {{commitEvent}}.
  - checked - The newly committed Boolean value - a boolean.
  - source - How the interaction was triggered - one of "pointer", "keyboard", or "programmatic".
`,
  "behavior.plainstate": `***plainstate***

- Starts in :Unchecked:.
- Unhandled events leave state unchanged and emit nothing.

- :Unchecked: The checkbox is not checked.
  - On press, when {{guard}}, go to :PressingToCheck:.
    - Present {{pressCue}}.
  - On toggle, when {{guard}}, go to :Checked:.
    - Emit {{commitEvent}} with true.
    - Present {{toggleCue}}.
- :PressingToCheck: A pointer or key press began while unchecked.
  - On release, when {{guard}}, go to :Checked:.
    - Emit {{commitEvent}} with true.
    - Present {{toggleCue}}.
  - On release, when not {{guard}}, go to :Unchecked:.
    - Present {{cancelCue}}.
  - On cancel, go to :Unchecked:.
    - Present {{cancelCue}}.
- :Checked: The checkbox is checked.
  - On press, when {{guard}}, go to :PressingToUncheck:.
    - Present {{pressCue}}.
  - On toggle, when {{guard}}, go to :Unchecked:.
    - Emit {{commitEvent}} with false.
    - Present {{toggleCue}}.
- :PressingToUncheck: A pointer or key press began while checked.
  - On release, when {{guard}}, go to :Unchecked:.
    - Emit {{commitEvent}} with false.
    - Present {{toggleCue}}.
  - On release, when not {{guard}}, go to :Checked:.
    - Present {{cancelCue}}.
  - On cancel, go to :Checked:.
    - Present {{cancelCue}}.
`,
  "fixtures.plaindata": `***plaindata***
- :CheckboxFixtures:
  - defaultUnchecked
    - label - "Email notifications"
    - checked - {{defaultChecked}}
    - disabled - false
    - initialPhase - "Unchecked"
  - preChecked
    - label - "Remember this device"
    - checked - true
    - disabled - false
    - initialPhase - "Checked"
  - disabledUnchecked
    - label - "Locked by administrator"
    - checked - false
    - disabled - true
    - initialPhase - "Unchecked"
  - disabledChecked
    - label - "Required terms accepted"
    - checked - true
    - disabled - true
    - initialPhase - "Checked"
`,
  "tokens.plaindata": `***plaindata***
- :CheckboxTokens:
  - labelMaxLength - 80
  - defaultChecked - false
  - guard - "interactive"
  - pressCue - "press"
  - toggleCue - "toggle"
  - cancelCue - "cancel"
  - commitEvent - "changed"
  - accentColor - "#2c56c9"
  - radiusPx - 4
`,
};

type Phase = "Unchecked" | "PressingToCheck" | "Checked" | "PressingToUncheck";
const PHASES: readonly Phase[] = ["Unchecked", "PressingToCheck", "Checked", "PressingToUncheck"];

const FIXTURES: Record<string, { label: string; phase: Phase; disabled: boolean }> = {
  defaultUnchecked: { label: "Email notifications", phase: "Unchecked", disabled: false },
  preChecked: { label: "Remember this device", phase: "Checked", disabled: false },
  disabledUnchecked: { label: "Locked by administrator", phase: "Unchecked", disabled: true },
  disabledChecked: { label: "Required terms accepted", phase: "Checked", disabled: true },
};

const sharedTokensList = document.getElementById("shared-tokens-list") as HTMLDivElement;
const fileTabs = document.getElementById("file-tabs") as HTMLDivElement;
const fileSource = document.getElementById("file-source") as HTMLTextAreaElement;
const fileReader = document.getElementById("file-reader") as HTMLDivElement;
const fileDialect = document.getElementById("file-dialect") as HTMLSpanElement;
const statusMeta = document.getElementById("status-meta") as HTMLSpanElement;
const resetAllBtn = document.getElementById("reset-all") as HTMLButtonElement;
const fixtureSelect = document.getElementById("fixture-select") as HTMLSelectElement;
const liveCheckbox = document.getElementById("live-checkbox") as HTMLButtonElement;
const cbLabel = document.getElementById("cb-label") as HTMLSpanElement;
const cbStates = document.getElementById("cb-states") as HTMLDivElement;
const cbEvents = document.getElementById("cb-events") as HTMLDivElement;
const cbDisabledToggle = document.getElementById("cb-disabled-toggle") as HTMLInputElement;
const guardNameEl = document.getElementById("guard-name") as HTMLElement;
const cbTrace = document.getElementById("cb-trace") as HTMLOListElement;

let tokens: Record<string, string> = { ...INITIAL_TOKENS };
let files: Record<string, string> = { ...INITIAL_FILES };
let activeFile = "component.plain";
let phase: Phase = "Unchecked";
let disabled = false;
let trace: Array<{ text: string; ignored: boolean }> = [];

function formatTokensPlainData(): string {
  const quoteOrRaw = (v: string) =>
    /^(?:true|false|null|-?\d+(?:\.\d+)?)$/.test(v) ? v : JSON.stringify(v);
  return [
    "***plaindata***",
    "- :CheckboxTokens:",
    ...Object.entries(tokens).map(([k, v]) => `  - ${k} - ${quoteOrRaw(v)}`),
    "",
  ].join("\n");
}

function stepCheckbox(ev: "press" | "release" | "cancel" | "toggle"): void {
  const interactive = !disabled;
  const from = phase;
  let to: Phase = phase;
  let note = "";

  if (phase === "Unchecked") {
    if (ev === "press" && interactive) {
      to = "PressingToCheck";
      note = `present ${tokens.pressCue}`;
    } else if (ev === "toggle" && interactive) {
      to = "Checked";
      note = `emit ${tokens.commitEvent}(true), present ${tokens.toggleCue}`;
    }
  } else if (phase === "PressingToCheck") {
    if (ev === "release" && interactive) {
      to = "Checked";
      note = `emit ${tokens.commitEvent}(true), present ${tokens.toggleCue}`;
    } else if (ev === "release" || ev === "cancel") {
      to = "Unchecked";
      note = `present ${tokens.cancelCue}`;
    }
  } else if (phase === "Checked") {
    if (ev === "press" && interactive) {
      to = "PressingToUncheck";
      note = `present ${tokens.pressCue}`;
    } else if (ev === "toggle" && interactive) {
      to = "Unchecked";
      note = `emit ${tokens.commitEvent}(false), present ${tokens.toggleCue}`;
    }
  } else if (phase === "PressingToUncheck") {
    if (ev === "release" && interactive) {
      to = "Unchecked";
      note = `emit ${tokens.commitEvent}(false), present ${tokens.toggleCue}`;
    } else if (ev === "release" || ev === "cancel") {
      to = "Checked";
      note = `present ${tokens.cancelCue}`;
    }
  }

  phase = to;
  if (note) {
    trace.unshift({ text: `${from} --(${ev})--> ${to} [${note}]`, ignored: false });
  } else {
    trace.unshift({ text: `${from} --(${ev})--> ignored (${tokens.guard}=false)`, ignored: true });
  }
  trace = trace.slice(0, 10);
  renderPreview();
}

function renderSharedTokens(): void {
  sharedTokensList.innerHTML = "";
  for (const [key, val] of Object.entries(tokens)) {
    const label = document.createElement("label");
    label.className = "token-field";
    const span = document.createElement("span");
    span.textContent = `{{${key}}}`;
    const input = document.createElement("input");
    input.value = val;
    input.addEventListener("input", () => {
      tokens[key] = input.value;
      files["tokens.plaindata"] = formatTokensPlainData();
      if (activeFile === "tokens.plaindata") fileSource.value = files["tokens.plaindata"]!;
      renderFile();
      renderPreview();
    });
    label.append(span, input);
    sharedTokensList.appendChild(label);
  }
}

function renderFile(): void {
  const raw = files[activeFile] ?? "";
  const applied = applyTokens(raw, tokens);
  const res = renderPlainView(applied.text, { spans: applied.spans });
  fileReader.innerHTML = res.html;
  fileDialect.textContent = res.dialect;
  statusMeta.textContent = `${Object.keys(tokens).length} shared tokens · ${activeFile}`;
}

function renderPreview(): void {
  const checked = phase === "Checked" || phase === "PressingToUncheck";
  const pressing = phase === "PressingToCheck" || phase === "PressingToUncheck";
  liveCheckbox.setAttribute("aria-checked", String(checked));
  liveCheckbox.dataset.checked = String(checked);
  liveCheckbox.dataset.pressing = String(pressing);
  liveCheckbox.dataset.disabled = String(disabled);
  liveCheckbox.style.setProperty("--cb-accent", tokens.accentColor || "#2c56c9");
  liveCheckbox.style.setProperty("--cb-radius", `${Number(tokens.radiusPx) || 4}px`);
  cbDisabledToggle.checked = disabled;
  guardNameEl.textContent = tokens.guard || "interactive";

  cbStates.innerHTML = "";
  for (const p of PHASES) {
    const pill = document.createElement("span");
    pill.className = `state-pill${p === phase ? " active" : ""}`;
    pill.textContent = `:${p}:`;
    cbStates.appendChild(pill);
  }

  cbTrace.innerHTML = "";
  if (trace.length === 0) {
    const li = document.createElement("li");
    li.className = "trace-item ignored";
    li.textContent = `Started in :${phase}:. Interact with the checkbox or fire an event.`;
    cbTrace.appendChild(li);
  } else {
    for (const item of trace) {
      const li = document.createElement("li");
      li.className = `trace-item${item.ignored ? " ignored" : ""}`;
      li.textContent = item.text;
      cbTrace.appendChild(li);
    }
  }
}

function selectFile(name: string): void {
  activeFile = name;
  fileSource.value = files[name] ?? "";
  for (const btn of Array.from(fileTabs.querySelectorAll<HTMLButtonElement>(".file-tab"))) {
    btn.classList.toggle("active", btn.dataset.file === name);
  }
  renderFile();
}

function loadFixture(id: string): void {
  const fx = FIXTURES[id] ?? FIXTURES.defaultUnchecked!;
  cbLabel.textContent = fx.label;
  phase = id === "defaultUnchecked" && tokens.defaultChecked === "true" ? "Checked" : fx.phase;
  disabled = fx.disabled;
  trace = [];
  renderPreview();
}

fileTabs.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>(".file-tab");
  if (target?.dataset.file) selectFile(target.dataset.file);
});

fileSource.addEventListener("input", () => {
  files[activeFile] = fileSource.value;
  renderFile();
});

liveCheckbox.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  stepCheckbox("press");
});
liveCheckbox.addEventListener("pointerup", () => {
  if (phase === "PressingToCheck" || phase === "PressingToUncheck") stepCheckbox("release");
});
liveCheckbox.addEventListener("pointerleave", () => {
  if (phase === "PressingToCheck" || phase === "PressingToUncheck") stepCheckbox("cancel");
});
liveCheckbox.addEventListener("pointercancel", () => {
  if (phase === "PressingToCheck" || phase === "PressingToUncheck") stepCheckbox("cancel");
});
liveCheckbox.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    e.preventDefault();
    stepCheckbox("toggle");
  }
});

cbEvents.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-ev]");
  if (!btn?.dataset.ev) return;
  stepCheckbox(btn.dataset.ev as "press" | "release" | "cancel" | "toggle");
});

cbDisabledToggle.addEventListener("change", () => {
  disabled = cbDisabledToggle.checked;
  renderPreview();
});

fixtureSelect.addEventListener("change", () => loadFixture(fixtureSelect.value));

resetAllBtn.addEventListener("click", () => {
  tokens = { ...INITIAL_TOKENS };
  files = { ...INITIAL_FILES };
  renderSharedTokens();
  selectFile(activeFile);
  loadFixture(fixtureSelect.value);
});

renderSharedTokens();
selectFile("component.plain");
loadFixture("defaultUnchecked");
