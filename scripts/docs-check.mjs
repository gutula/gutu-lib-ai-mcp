#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredDocs = ["README.md","DEVELOPER.md","TODO.md"];
const placeholderPatterns = [/This folder is the intended standalone git repository/i, /_Document\\b[^_]*_/i, /_Explain\\b[^_]*_/i, /_Describe\\b[^_]*_/i];
const failures = [];

for (const doc of requiredDocs) {
  const target = path.join(root, doc);
  if (!fs.existsSync(target)) {
    failures.push(`${doc} is missing.`);
    continue;
  }

  const content = fs.readFileSync(target, "utf8");
  for (const pattern of placeholderPatterns) {
    if (pattern.test(content)) {
      failures.push(`${doc} still contains placeholder content matching ${pattern}.`);
    }
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const heading of ["## Part Of The Gutu Stack", "## What It Does Now", "## Maturity", "## Verified API Summary", "## Capability Matrix", "## Current Test Coverage", "## Recommended Next Milestones"]) {
  if (!readme.includes(heading)) {
    failures.push(`README.md is missing heading '${heading}'.`);
  }
}
if ((readme.match(/https:\/\/img\.shields\.io\/badge\//g) || []).length < 4) {
  failures.push("README.md is missing the required local badge block.");
}
if (!readme.includes("./docs/assets/gutu-mascot.png")) {
  failures.push("README.md is missing the mascot image reference.");
}
if (!fs.existsSync(path.join(root, "docs", "assets", "gutu-mascot.png"))) {
  failures.push("docs/assets/gutu-mascot.png is missing.");
}

const developer = fs.readFileSync(path.join(root, "DEVELOPER.md"), "utf8");
for (const heading of ["## Purpose And Architecture Role", "## Package Contract", "## Public API Surface", "## React, UI, And Extensibility Notes", "## Mermaid Flows", "## Test Matrix", "## Current Truth And Recommended Next"]) {
  if (!developer.includes(heading)) {
    failures.push(`DEVELOPER.md is missing heading '${heading}'.`);
  }
}
if (!developer.includes("mermaid")) {
  failures.push("DEVELOPER.md is missing a Mermaid diagram.");
}

const todo = fs.readFileSync(path.join(root, "TODO.md"), "utf8");
for (const heading of ["## Shipped Now", "## Current Gaps", "## Recommended Next", "## Later / Optional"]) {
  if (!todo.includes(heading)) {
    failures.push(`TODO.md is missing heading '${heading}'.`);
  }
}

if (failures.length > 0) {
  console.error("Library docs check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Library docs check passed.");
