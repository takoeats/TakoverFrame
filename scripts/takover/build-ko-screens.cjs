// Builds Korean reward screens for every squad size from the real title crops in
// fixtures/slot-crops-ko, as build-screens.cjs does for the English crops. The
// crops are cut at one frame size, so the screens are too.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { titleRects } = require("./crop-reward-titles.cjs");

const USAGE = `usage: node scripts/takover/build-ko-screens.cjs <out-dir>

Writes ko-<N>p.png and screens.json ({ file, expected[] } per screen). Run each
through run-check.cjs --image with REWARD_SCAN_LOCALE=ko on a Windows PC.`;

const CROP_DIR = path.join(__dirname, "fixtures", "slot-crops-ko");
// Which crops fill each squad size, so the counted forma lands in every layout.
const PICKS = { 1: [1], 2: [0, 1], 3: [1, 2, 3], 4: [0, 1, 2, 3] };

async function buildScreen(players, frame, crops, outDir) {
  const rects = titleRects(frame.width, frame.height, players, frame.uiScale);
  const picked = PICKS[players].map((i) => crops[i]);
  const composites = [];
  for (const [i, rect] of rects.entries()) {
    const card = await sharp({
      create: {
        width: rect.width,
        height: rect.y - rect.cardTop - 3,
        channels: 4,
        background: { r: 146, g: 138, b: 138, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    composites.push({ input: card, left: rect.x, top: rect.cardTop });
    const strip = await sharp(path.join(CROP_DIR, picked[i].file))
      .resize(rect.width, rect.height, { fit: "fill" })
      .toBuffer();
    composites.push({ input: strip, left: rect.x, top: rect.y });
  }
  const file = `ko-${players}p.png`;
  await sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: { r: 24, g: 16, b: 16, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(outDir, file));
  return { file, expected: picked.map((c) => c.expected) };
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error(USAGE);
  fs.mkdirSync(outDir, { recursive: true });
  const { frame, slots } = JSON.parse(
    fs.readFileSync(path.join(CROP_DIR, "expected.json"), "utf8"),
  );
  // Unprefixed crops are the first screenshot's; s2_/s3_ crops are strips from other frames.
  const crops = Object.entries(slots)
    .filter(([file]) => file.startsWith("4_players_"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, slot]) => ({ file, expected: slot.expected }));

  const screens = [];
  for (const players of [1, 2, 3, 4]) {
    screens.push(await buildScreen(players, frame, crops, outDir));
  }
  fs.writeFileSync(path.join(outDir, "screens.json"), JSON.stringify(screens, null, 2));
  for (const s of screens) console.log(`${s.file}: ${s.expected.join(" | ")}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
