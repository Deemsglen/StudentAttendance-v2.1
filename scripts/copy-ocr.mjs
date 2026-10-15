import { gunzipSync } from "node:zlib";
import { readFile, writeFile, rm } from "node:fs/promises";
import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const target = "public/ocr";
await mkdir(target, { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  `${target}/worker.min.js`,
);
for (const file of await readdir("node_modules/tesseract.js-core"))
  if (/lstm\.wasm(\.js)?$/.test(file))
    await copyFile(
      path.join("node_modules/tesseract.js-core", file),
      path.join(target, file),
    );
// AAPT rewrites .gz assets; use plain traineddata consistently on web and Android.
await writeFile(
  `${target}/eng.traineddata`,
  gunzipSync(
    await readFile(
      "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    ),
  ),
);
await rm(`${target}/eng.traineddata.gz`, { force: true });
console.log("Packaged local OCR worker, WASM cores and English language data.");

await copyFile(
  "node_modules/tesseract.js/LICENSE.md",
  `${target}/tesseract-js-LICENSE.md`,
);
await copyFile(
  "node_modules/tesseract.js-core/LICENSE",
  `${target}/tesseract-core-LICENSE.txt`,
);
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  `${target}/worker-LICENSE.txt`,
);
