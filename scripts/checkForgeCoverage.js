const fs = require("fs");

const lcovPath = process.argv[2] || "lcov.info";
const minimum = Number(process.argv[3] || "90");

if (!fs.existsSync(lcovPath)) {
  console.error(`Coverage file not found: ${lcovPath}`);
  process.exit(1);
}

const content = fs.readFileSync(lcovPath, "utf8");
let found = 0;
let hit = 0;
let currentFile = "";

for (const line of content.split(/\r?\n/)) {
  if (line.startsWith("SF:")) {
    currentFile = line.slice(3).replace(/\\/g, "/");
    continue;
  }
  if (!currentFile.includes("/contracts/") && !currentFile.startsWith("contracts/")) {
    continue;
  }
  if (line.startsWith("LF:")) {
    found += Number(line.slice(3));
  }
  if (line.startsWith("LH:")) {
    hit += Number(line.slice(3));
  }
}

const percent = found === 0 ? 0 : (hit / found) * 100;
console.log(`Foundry line coverage for contracts/: ${percent.toFixed(2)}% (${hit}/${found})`);

if (percent < minimum) {
  console.error(`Coverage threshold failed: expected at least ${minimum}% line coverage.`);
  process.exit(1);
}
