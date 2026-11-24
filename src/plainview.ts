/**
 * PlainView — typographic reader renderer for ***plain documents
 * (PlainType, PlainData, PlainState, and general ***plain specs).
 *
 * Strips ***header*** markers, YAML frontmatter, `>` comment prefixes, and
 * `:Concept:` colons, producing clean, readable HTML while preserving
 * indentation depth and semantic roles.
 */

export type PlainDialect = "plaintype" | "plaindata" | "plainstate" | "plain";

export interface RenderResult {
  readonly dialect: PlainDialect;
  readonly html: string;
  readonly rowCount: number;
}

const CONCEPT_DECLARATION = /^:([A-Za-z0-9+._-]+):(?:\s+(.*))?$/;
const ARRAY_ITEM = /^(#\d+)(?: - (.*))?$/;
const ATTRIBUTE = /^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$-]*)( \((?:optional|object|optional, object)\))?(?:( - |: )(.*))?$/;
const INLINE_CONCEPT = /"(?:[^"\\]|\\.)*"|:([A-Za-z0-9+._-]+):/g;
const STATE_EDGE = /^(On\s+)([A-Za-z][A-Za-z0-9_-]*)(.*)$/;

export function detectDialect(source: string): PlainDialect {
  const match = source.match(/^\*\*\*(plaintype(?:\s+\d+)?|plaindata|plainstate)\*\*\*$/m);
  if (!match) return "plain";
  const tag = match[1]!;
  if (tag.startsWith("plaintype")) return "plaintype";
  if (tag === "plaindata") return "plaindata";
  if (tag === "plainstate") return "plainstate";
  return "plain";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text: string): string {
  let html = "";
  let cursor = 0;
  for (const match of text.matchAll(INLINE_CONCEPT)) {
    const at = match.index ?? 0;
    if (match[1] === undefined) {
      // Quoted string literal
      html += escapeHtml(text.slice(cursor, at));
      html += `<span class="pv-string">${escapeHtml(match[0])}</span>`;
      cursor = at + match[0].length;
    } else {
      html += escapeHtml(text.slice(cursor, at));
      html += `<strong class="pv-ref">${escapeHtml(match[1])}</strong>`;
      cursor = at + match[0].length;
    }
  }
  return html + escapeHtml(text.slice(cursor));
}

function lastUnquotedDash(text: string): number {
  let quoted = false;
  let found = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && quoted) i += 1;
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === " " && text[i + 1] === "-" && text[i + 2] === " ") {
      found = i;
    }
  }
  return found;
}

function renderDescriptionAndConstraint(text: string): string {
  const split = lastUnquotedDash(text);
  if (split === -1) return renderInline(text);
  const desc = text.slice(0, split);
  const constraint = text.slice(split + 3);
  return `${renderInline(desc)}<span class="pv-sep">: </span><span class="pv-constraint">${renderInline(constraint)}</span>`;
}

function renderScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) return `<span class="pv-string">${escapeHtml(trimmed)}</span>`;
  if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
    return `<span class="pv-keyword">${escapeHtml(trimmed)}</span>`;
  }
  if (trimmed === "[]" || trimmed === "{}") {
    return `<span class="pv-empty">${escapeHtml(trimmed)}</span>`;
  }
  if (/^-?\d/.test(trimmed)) {
    return `<span class="pv-number">${escapeHtml(trimmed)}</span>`;
  }
  return renderInline(trimmed);
}

function row(kind: string, depth: number, html: string): string {
  return `<div class="pv-row pv-${kind}" style="--depth:${depth}">${html}</div>`;
}

export function renderPlainView(source: string): RenderResult {
  const dialect = detectDialect(source);
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const frontmatterEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const rows: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (i <= frontmatterEnd || line.trim() === "" || /^\*\*\*[^*]+\*\*\*$/.test(line.trim())) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const depth = Math.floor(indent / 2);

    const comment = /^ *> ?(.*)$/.exec(line);
    if (comment) {
      rows.push(row("comment", depth, escapeHtml(comment[1] ?? "")));
      continue;
    }

    if (!line.startsWith("- ", indent)) {
      rows.push(row("text", depth, renderInline(line.slice(indent))));
      continue;
    }

    const body = line.slice(indent + 2);

    // :Concept: declaration
    const concept = CONCEPT_DECLARATION.exec(body);
    if (concept) {
      const name = concept[1]!;
      const rest = concept[2]?.trim() ?? "";
      const tail = rest
        ? `<span class="pv-sep"> — </span><span class="pv-desc">${renderDescriptionAndConstraint(rest)}</span>`
        : "";
      rows.push(row("definition", depth, `<strong class="pv-name">${escapeHtml(name)}</strong>${tail}`));
      continue;
    }

    // PlainData array index (#1, #2, ...)
    const arr = ARRAY_ITEM.exec(body);
    if (arr) {
      const idx = arr[1]!;
      const tail = arr[2] !== undefined ? `<span class="pv-sep"> · </span>${renderScalar(arr[2])}` : "";
      rows.push(row("index", depth, `<span class="pv-index">${escapeHtml(idx)}</span>${tail}`));
      continue;
    }

    // PlainState transition edge
    if (dialect === "plainstate") {
      const edge = STATE_EDGE.exec(body);
      if (edge) {
        rows.push(
          row(
            "edge",
            depth,
            `<span class="pv-bullet">→</span><span class="pv-keyword">${escapeHtml(edge[1]!)}</span><strong class="pv-event">${escapeHtml(edge[2]!)}</strong>${renderInline(edge[3]!)}`,
          ),
        );
        continue;
      }
      if (/^(Starts in |Unhandled events |Do |Emit |Request |Present )/.test(body)) {
        rows.push(row("directive", depth, `<span class="pv-bullet">·</span>${renderInline(body)}`));
        continue;
      }
    }

    // Attribute / member line
    const attr = ATTRIBUTE.exec(body);
    if (attr && (attr[3] !== undefined || dialect === "plaindata")) {
      const name = attr[1]!;
      const qualifier = attr[2] ?? "";
      const val = attr[4];
      const qualifierHtml = qualifier ? ` <span class="pv-qualifier">${escapeHtml(qualifier.trim())}</span>` : "";
      const valueHtml =
        val !== undefined
          ? `<span class="pv-sep"> — </span>${dialect === "plaindata" ? renderScalar(val) : renderDescriptionAndConstraint(val)}`
          : "";
      rows.push(
        row(
          "attribute",
          depth,
          `<span class="pv-bullet">•</span><span class="pv-attr">${escapeHtml(name)}</span>${qualifierHtml}${valueHtml}`,
        ),
      );
      continue;
    }

    rows.push(row("directive", depth, `<span class="pv-bullet">•</span>${renderInline(body)}`));
  }

  return {
    dialect,
    html: rows.join("\n"),
    rowCount: rows.length,
  };
}
