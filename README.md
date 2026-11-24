# PlanView

PlanView is the typographic reader and HTML renderer for `***plain` documents
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
import { renderPlainView } from "planview";

const { dialect, html } = renderPlainView(source);
```

## Studio

Try the live [PlanView Studio](https://mrjf.github.io/PlanView/) in your browser
with examples across PlainType, PlainData, PlainState, and Plain specs.

## The Plain Family

| Project | Purpose | Repo | Studio |
| --- | --- | --- | --- |
| **PlainType** | Controlled-natural-language JSON Schema | [mrjf/PlainType](https://github.com/mrjf/PlainType) | [PlainType Studio](https://mrjf.github.io/PlainType/) |
| **PlainData** | Lossless JSON data notation | [mrjf/PlainData](https://github.com/mrjf/PlainData) | [PlainData Studio](https://mrjf.github.io/PlainData/) |
| **PlainState** | Deterministic finite state machines | [mrjf/PlainState](https://github.com/mrjf/PlainState) | [PlainState Studio](https://mrjf.github.io/PlainState/) |
| **PlanView** | Typographic reader for `***plain` documents | [mrjf/PlanView](https://github.com/mrjf/PlanView) | [PlanView Studio](https://mrjf.github.io/PlanView/) |
