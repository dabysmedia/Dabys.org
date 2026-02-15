const fs = require("fs");
const path = require("path");
const PImage = require("pureimage");

const PUBLIC = path.join(__dirname, "..", "public");
const THEME_COLOR = "#8b5cf6";

async function main() {
  for (const size of [192, 512]) {
    const img = PImage.make(size, size);
    const ctx = img.getContext("2d");
    ctx.fillStyle = THEME_COLOR;
    ctx.fillRect(0, 0, size, size);
    const out = path.join(PUBLIC, `icon-${size}.png`);
    await PImage.encodePNGToStream(img, fs.createWriteStream(out));
    console.log("Created", out);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
