import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const { reportLines } = createRequire(__filename)(
  "../../../scripts/takover/ko-scan-report.cjs",
) as {
  reportLines: (dir: string, options?: { suspectOnly?: boolean }) => string[];
};

let dir: string | null = null;

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function bundle(root: string, name: string, slots: unknown[]): void {
  fs.mkdirSync(path.join(root, name));
  fs.writeFileSync(
    path.join(root, name, "meta.json"),
    JSON.stringify({ reason: "matched", slots }),
  );
}

describe("Korean scan log report", () => {
  it("lists each slot and marks reads that disagree with the match", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-ko-report-"));
    bundle(dir, "2026-10-03_10-00-00-000_01", [
      {
        slot: 1,
        read: "포르마 설계도",
        matchedName: "Forma Blueprint",
        confidence: 1,
        agrees: true,
      },
      {
        slot: 2,
        read: "2ⅹ포르마 설계도",
        matchedName: "Forma Blueprint",
        confidence: 0.994,
        agrees: false,
      },
    ]);
    bundle(dir, "2026-10-03_10-05-00-000_02", [
      { slot: 1, read: "", matchedName: null, confidence: null, agrees: false },
    ]);

    const all = reportLines(dir);
    expect(all).toHaveLength(5);
    expect(all[0]).toContain("2026-10-03_10-00-00-000_01");
    expect(all[1]).toMatch(/^ {2}ok {2}1 /);
    expect(all[2]).toMatch(/^ {2}\? {3}2 .*2ⅹ포르마 설계도.*Forma Blueprint.*0\.994/);
    expect(all[4]).toMatch(/^ {2}-- {2}1 /);

    const suspects = reportLines(dir, { suspectOnly: true });
    expect(suspects.filter((line) => !line.startsWith("2026"))).toHaveLength(2);
  });
});
