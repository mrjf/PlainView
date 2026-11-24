#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { renderPlainView } from "./index.js";

function usage(): never {
  process.stderr.write("Usage: planview render [file] [-o out.html]\n");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args.shift();
if (command !== "render") usage();

let inputPath: string | undefined;
let outPath: string | undefined;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]!;
  if (arg === "-o" || arg === "--output") {
    outPath = args[++i];
    if (!outPath) usage();
  } else if (arg.startsWith("-")) {
    usage();
  } else if (!inputPath) {
    inputPath = arg;
  } else {
    usage();
  }
}

const source = inputPath ? readFileSync(inputPath, "utf8") : readFileSync(0, "utf8");
const result = renderPlainView(source);
const output = result.html + "\n";
if (outPath) {
  writeFileSync(outPath, output, "utf8");
} else {
  process.stdout.write(output);
}
