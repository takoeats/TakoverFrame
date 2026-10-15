// Cuts the item-name strip of each reward card out of a full reward screenshot, so
// a fixture keeps item names and drops player names. The rectangles are the ones the
// scanner reads (FIXED_REWARD_LAYOUTS, buildFixedSlots in rewardScannerImage.ts).
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

// REFERENCE_WARFRAME_UI_SCALE: the interface scale the layouts were measured at.
const REF_UI_SCALE = 0.99;
const REF_ASPECT = 16 / 9;
const CARD = { y: 0.225, width: 0.122, height: 0.225 };
const CARD_X = {
  1: [0.439],
  2: [0.3755, 0.5025],
  3: [0.312, 0.439, 0.566],
  4: [0.245, 0.372, 0.499, 0.626],
};

const USAGE = `usage: node scripts/takover/crop-reward-titles.cjs <screenshot> --players 4
         [--ui-scale 100] [--out <dir>] [--preview <png>]

Crops are named <N>_players_slot<i>_title_<x>x<y>_<w>x<h>.png in the screenshot's
own pixels. --preview draws the rectangles on a copy of the screenshot to check
alignment; it still shows player names, so never write it inside the repo.`;

function parseArgs(argv) {
  const args = { image: null, players: null, uiScale: 100, out: null, preview: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
      return argv[++i];
    };
    if (flag === "--players") args.players = Number(value());
    else if (flag === "--ui-scale") args.uiScale = Number(value());
    else if (flag === "--out") args.out = value();
    else if (flag === "--preview") args.preview = value();
    else if (flag.startsWith("--")) throw new Error(`unknown flag ${flag}`);
    else args.image = flag;
  }
  if (!args.image) throw new Error(USAGE);
  if (!CARD_X[args.players]) throw new Error("--players must be 1-4");
  if (!(args.uiScale >= 25 && args.uiScale <= 100)) throw new Error("--ui-scale is 25-100 (%)");
  return args;
}

/** Title strips (and their card's top edge) in screenshot pixels. */
function titleRects(width, height, players, uiScalePercent = 100) {
  const ui = uiScalePercent / 100 / REF_UI_SCALE;
  const scaleX = Math.min(1, (height * REF_ASPECT) / width);
  const scaleY = Math.min(1, width / REF_ASPECT / height);
  const about = (value, scale) => 0.5 + (value - 0.5) * scale;
  return CARD_X[players].map((cardX, index) => {
    // ratios: interface scale, then aspect, then the title band of the card
    const x = about(about(cardX, ui), scaleX);
    const y = about(about(CARD.y, ui), scaleY);
    const w = CARD.width * ui * scaleX;
    const h = CARD.height * ui * scaleY;
    const left = Math.round(x * width);
    const top = Math.round((y + h * 0.7) * height);
    return {
      index,
      x: left,
      y: top,
      width: Math.round((x + w) * width) - left,
      height: Math.round((y + h * 0.88) * height) - top,
      cardTop: Math.round(y * height),
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { width, height } = await sharp(args.image).metadata();
  const rects = titleRects(width, height, args.players, args.uiScale);
  const outDir = args.out || path.join(path.dirname(args.image), "title-crops");
  fs.mkdirSync(outDir, { recursive: true });

  for (const r of rects) {
    const name = `${args.players}_players_slot${r.index}_title_${r.x}x${r.y}_${r.width}x${r.height}.png`;
    await sharp(args.image)
      .extract({ left: r.x, top: r.y, width: r.width, height: r.height })
      .png()
      .toFile(path.join(outDir, name));
    console.log(path.join(outDir, name));
  }

  if (args.preview) {
    const boxes = rects
      .map(
        (r) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#ff00ff" stroke-width="2"/>`,
      )
      .join("");
    const svg = Buffer.from(`<svg width="${width}" height="${height}">${boxes}</svg>`);
    await sharp(args.image)
      .composite([{ input: svg }])
      .png()
      .toFile(args.preview);
    console.log(`preview: ${args.preview}`);
  }
}

module.exports = { titleRects };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
