# PlainView

PlainView is the typographic reader and HTML renderer for `***plain` documents
([`PlainType`](https://github.com/mrjf/PlainType),
[`PlainData`](https://github.com/mrjf/PlainData),
[`PlainState`](https://github.com/mrjf/PlainState), and general `***plain`
specs).

It is a **presentation layer, not a new dialect**: it strips `***header***`
markers, YAML frontmatter, `>` comment prefixes, and `:Concept:` colons,
rendering clean, scannable prose while keeping indentation depth and semantic
roles intact.

## Use

Node.js 20 or newer is required.

```bash
npm install
npm run build

node dist/src/cli.js render document.plaintype
```

Library API:

```ts
import { renderPlainView } from "plainview";

const { dialect, html } = renderPlainView(source);
```

## Studio & Complete Checkbox Example

Try the live [PlainView Studio](https://mrjf.github.io/PlainView/) in your browser
with examples across PlainType, PlainData, PlainState, and Plain specs, or open
the [Complete Checkbox Component](https://mrjf.github.io/PlainView/checkbox.html)
(`examples/checkbox/`) showing a standalone, framework-agnostic Checkbox fully
specified across `tokens.plaindata`, `contract.plaintype`,
`behavior.plainstate`, `fixtures.plaindata`, and `component.plain` with live
shared tokens and an interactive state machine.

## The Plain Family

| Project | Purpose | Repo | Studio |
| --- | --- | --- | --- |
| **PlainType** | Controlled-natural-language JSON Schema | [mrjf/PlainType](https://github.com/mrjf/PlainType) | [PlainType Studio](https://mrjf.github.io/PlainType/) |
| **PlainData** | Lossless JSON data notation | [mrjf/PlainData](https://github.com/mrjf/PlainData) | [PlainData Studio](https://mrjf.github.io/PlainData/) |
| **PlainState** | Deterministic finite state machines | [mrjf/PlainState](https://github.com/mrjf/PlainState) | [PlainState Studio](https://mrjf.github.io/PlainState/) |
| **PlainView** | Typographic reader for `***plain` documents | [mrjf/PlainView](https://github.com/mrjf/PlainView) | [PlainView Studio](https://mrjf.github.io/PlainView/) |
