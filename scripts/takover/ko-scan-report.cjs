// Lists the Korean reward scans the app kept in scan-log-ko/ (services/takover/koScanLog.ts).
const fs = require("node:fs");
const path = require("node:path");

const USAGE = `usage: node scripts/takover/ko-scan-report.cjs <scan-log-ko dir> [--suspect]

One line per slot: "ok" when the read spells the reported item's Korean name,
"?" when it does not (a likely wrong match), "--" when nothing matched.
--suspect shows only "?" and "--" slots. Each scan folder holds slot<N>.png, the
strip OCR saw; a wrong one becomes a crop fixture and a matcher test.`;

function mark(slot) {
  if (!slot.matchedName) return "--";
  return slot.agrees ? "ok" : "?";
}

function reportLines(dir, { suspectOnly = false } = {}) {
  const lines = [];
  const scans = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of scans) {
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, name, "meta.json"), "utf8"));
    } catch {
      continue;
    }
    const slots = (meta.slots || []).filter((slot) => !suspectOnly || mark(slot) !== "ok");
    if (slots.length === 0) continue;
    lines.push(`${name}  ${meta.reason || ""}`);
    for (const slot of slots) {
      const confidence = typeof slot.confidence === "number" ? ` (${slot.confidence})` : "";
      lines.push(
        `  ${mark(slot).padEnd(3)} ${slot.slot} "${slot.read}" -> ${slot.matchedName || "-"}${confidence}`,
      );
    }
  }
  return lines;
}

module.exports = { reportLines };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args.find((arg) => !arg.startsWith("--"));
  if (!dir) {
    console.error(USAGE);
    process.exit(1);
  }
  for (const line of reportLines(dir, { suspectOnly: args.includes("--suspect") })) {
    console.log(line);
  }
}
