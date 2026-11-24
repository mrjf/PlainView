/**
 * PlainView — token-aware typographic reader and HTML renderer for ***plain
 * documents (PlainType, PlainData, PlainState, and general ***plain specs).
 */

export type PlainDialect = "plaintype" | "plaindata" | "plainstate" | "plain";

export interface TokenSpan {
  readonly token: string;
  readonly start: number;
  readonly end: number;
}

export interface AppliedTemplate {
  readonly text: string;
  readonly spans: readonly TokenSpan[];
  readonly missing: readonly string[];
}

export interface RenderOptions {
  readonly spans?: readonly TokenSpan[];
}

export interface RenderResult {
  readonly dialect: PlainDialect;
  readonly html: string;
  readonly rowCount: number;
}

const TOKEN_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g;
const CONCEPT_DECLARATION = /^:([A-Za-z0-9+._-]+):(?:\s+(.*))?$/;
const ARRAY_ITEM = /^(#\d+)(?: - (.*))?$/;
const ATTRIBUTE = /^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$-]*)( \((?:optional|object|optional, object)\))?(?:( - |: )(.*))?$/;
const INLINE_CONCEPT = /"(?:[^"\\]|\\.)*"|:([A-Za-z0-9+._-]+):|\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g;
const STATE_EDGE = /^(On\s+)([A-Za-z][A-Za-z0-9_-]*)(.*)$/;

export function extractTokens(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    seen.add(match[1]!);
  }
  return [...seen];
}

export function applyTokens(
  template: string,
  values: Readonly<Record<string, string>>,
): AppliedTemplate {
  const spans: TokenSpan[] = [];
  const missing = new Set<string>();
  let text = "";
  let cursor = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const at = match.index ?? 0;
    const token = match[1]!;
    text += template.slice(cursor, at);
    if (Object.hasOwn(values, token)) {
      const replacement = values[token]!;
      const start = text.length;
      text += replacement;
      spans.push({ token, start, end: text.length });
    } else {
      missing.add(token);
      text += match[0];
    }
    cursor = at + match[0].length;
  }

  text += template.slice(cursor);
  return { text, spans, missing: [...missing] };
}

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

function clipSpans(spans: readonly TokenSpan[], start: number, end: number): TokenSpan[] {
  const out: TokenSpan[] = [];
  for (const s of spans) {
    if (s.start < end && start < s.end) {
      out.push({
        token: s.token,
        start: Math.max(s.start, start) - start,
        end: Math.min(s.end, end) - start,
      });
    }
  }
  return out;
}

function paintSlice(text: string, spans: readonly TokenSpan[]): string {
  if (spans.length === 0) return escapeHtml(text);
  let html = "";
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) html += escapeHtml(text.slice(cursor, s.start));
    const slice = text.slice(s.start, s.end);
    html += `<span class="pv-token-resolved" data-token="${escapeHtml(s.token)}" title="{{${escapeHtml(s.token)}}}">${escapeHtml(slice)}</span>`;
    cursor = s.end;
  }
  if (cursor < text.length) html += escapeHtml(text.slice(cursor));
  return html;
}

function renderInline(text: string, spans: readonly TokenSpan[]): string {
  let html = "";
  let cursor = 0;
  for (const match of text.matchAll(INLINE_CONCEPT)) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (at > cursor) html += paintSlice(text.slice(cursor, at), clipSpans(spans, cursor, at));
    if (match[2] !== undefined) {
      html += `<span class="pv-token" data-token="${escapeHtml(match[2])}">${escapeHtml(match[2])}</span>`;
    } else if (match[1] === undefined) {
      html += `<span class="pv-string">${paintSlice(match[0], clipSpans(spans, at, end))}</span>`;
    } else {
      html += `<strong class="pv-ref">${paintSlice(match[1], clipSpans(spans, at + 1, end - 1))}</strong>`;
    }
    cursor = end;
  }
  if (cursor < text.length) html += paintSlice(text.slice(cursor), clipSpans(spans, cursor, text.length));
  return html;
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

function renderDescriptionAndConstraint(text: string, spans: readonly TokenSpan[]): string {
  const split = lastUnquotedDash(text);
  if (split === -1) return renderInline(text, spans);
  const desc = text.slice(0, split);
  const constraint = text.slice(split + 3);
  return `${renderInline(desc, clipSpans(spans, 0, split))}<span class="pv-sep">: </span><span class="pv-constraint">${renderInline(constraint, clipSpans(spans, split + 3, text.length))}</span>`;
}

function renderScalar(raw: string, spans: readonly TokenSpan[]): string {
  const trimmed = raw.trim();
  const lead = raw.indexOf(trimmed);
  const localSpans = clipSpans(spans, lead, lead + trimmed.length);
  const tok = /^\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}$/.exec(trimmed);
  if (tok) return `<span class="pv-token" data-token="${escapeHtml(tok[1]!)}">${escapeHtml(tok[1]!)}</span>`;
  if (trimmed.startsWith('"')) return `<span class="pv-string">${paintSlice(trimmed, localSpans)}</span>`;
  if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
    return `<span class="pv-keyword">${paintSlice(trimmed, localSpans)}</span>`;
  }
  if (trimmed === "[]" || trimmed === "{}") {
    return `<span class="pv-empty">${paintSlice(trimmed, localSpans)}</span>`;
  }
  if (/^-?\d/.test(trimmed)) {
    return `<span class="pv-number">${paintSlice(trimmed, localSpans)}</span>`;
  }
  return renderInline(trimmed, localSpans);
}

function row(kind: string, depth: number, html: string): string {
  return `<div class="pv-row pv-${kind}" style="--depth:${depth}">${html}</div>`;
}

export function renderPlainView(source: string, options: RenderOptions = {}): RenderResult {
  const normalized = source.replace(/\r\n/g, "\n");
  const spans = options.spans ?? [];
  const dialect = detectDialect(normalized);
  const lines = normalized.split("\n");
  const frontmatterEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const rows: string[] = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const base = offset;
    offset += line.length + 1;
    if (i <= frontmatterEnd || line.trim() === "" || /^\*\*\*[^*]+\*\*\*$/.test(line.trim())) {
      continue;
    }

    const lineSpans = clipSpans(spans, base, base + line.length);
    const indent = line.length - line.trimStart().length;
    const depth = Math.floor(indent / 2);

    const comment = /^ *> ?(.*)$/.exec(line);
    if (comment) {
      const start = line.length - (comment[1]?.length ?? 0);
      rows.push(row("comment", depth, paintSlice(comment[1] ?? "", clipSpans(lineSpans, start, line.length))));
      continue;
    }

    if (!line.startsWith("- ", indent)) {
      rows.push(row("text", depth, renderInline(line.slice(indent), clipSpans(lineSpans, indent, line.length))));
      continue;
    }

    const bodyStart = indent + 2;
    const body = line.slice(bodyStart);
    const bodySpans = clipSpans(lineSpans, bodyStart, line.length);

    const concept = CONCEPT_DECLARATION.exec(body);
    if (concept) {
      const name = concept[1]!;
      const rest = concept[2]?.trim() ?? "";
      const restStart = rest ? body.indexOf(rest, name.length + 2) : body.length;
      const tail = rest
        ? `<span class="pv-sep"> — </span><span class="pv-desc">${renderDescriptionAndConstraint(rest, clipSpans(bodySpans, restStart, restStart + rest.length))}</span>`
        : "";
      rows.push(row("definition", depth, `<strong class="pv-name">${paintSlice(name, clipSpans(bodySpans, 1, 1 + name.length))}</strong>${tail}`));
      continue;
    }

    const arr = ARRAY_ITEM.exec(body);
    if (arr) {
      const idx = arr[1]!;
      const val = arr[2];
      const valStart = idx.length + 3;
      const tail = val !== undefined ? `<span class="pv-sep"> · </span>${renderScalar(val, clipSpans(bodySpans, valStart, body.length))}` : "";
      rows.push(row("index", depth, `<span class="pv-index">${escapeHtml(idx)}</span>${tail}`));
      continue;
    }

    if (dialect === "plainstate") {
      const edge = STATE_EDGE.exec(body);
      if (edge) {
        const evStart = edge[1]!.length;
        const restStart = evStart + edge[2]!.length;
        rows.push(
          row(
            "edge",
            depth,
            `<span class="pv-bullet">→</span><span class="pv-keyword">${escapeHtml(edge[1]!)}</span><strong class="pv-event">${paintSlice(edge[2]!, clipSpans(bodySpans, evStart, restStart))}</strong>${renderInline(edge[3]!, clipSpans(bodySpans, restStart, body.length))}`,
          ),
        );
        continue;
      }
      if (/^(Starts in |Unhandled events |Do |Emit |Request |Present )/.test(body)) {
        rows.push(row("directive", depth, `<span class="pv-bullet">·</span>${renderInline(body, bodySpans)}`));
        continue;
      }
    }

    const attr = ATTRIBUTE.exec(body);
    if (attr && (attr[3] !== undefined || dialect === "plaindata")) {
      const name = attr[1]!;
      const qualifier = attr[2] ?? "";
      const sep = attr[3] ?? "";
      const val = attr[4];
      const valStart = name.length + qualifier.length + sep.length;
      const qualifierHtml = qualifier ? ` <span class="pv-qualifier">${escapeHtml(qualifier.trim())}</span>` : "";
      const valueHtml =
        val !== undefined
          ? `<span class="pv-sep"> — </span>${dialect === "plaindata" ? renderScalar(val, clipSpans(bodySpans, valStart, body.length)) : renderDescriptionAndConstraint(val, clipSpans(bodySpans, valStart, body.length))}`
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

    rows.push(row("directive", depth, `<span class="pv-bullet">•</span>${renderInline(body, bodySpans)}`));
  }

  return {
    dialect,
    html: rows.join("\n"),
    rowCount: rows.length,
  };
}
