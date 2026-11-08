import sharp from "sharp";
for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
])
  await sharp("public/favicon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/${file}`);
const centered = await sharp("public/favicon.svg")
  .resize(360, 360)
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#174d3d" },
})
  .composite([{ input: centered, gravity: "centre" }])
  .png()
  .toFile("public/icon-maskable.png");
console.log("Generated installable icons.");
