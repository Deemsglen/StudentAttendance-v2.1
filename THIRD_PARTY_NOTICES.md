# Bundled OCR components

The app bundles Tesseract.js, tesseract.js-core, its WebAssembly builds, and the English trained-data package. Original license files from Tesseract.js/core and the worker distribution are copied unchanged into public/ocr by scripts/copy-ocr.mjs and packaged with the app.

- Tesseract.js: see public/ocr/tesseract-js-LICENSE.md and node_modules/tesseract.js/package.json.
- Tesseract.js-core: see public/ocr/tesseract-core-LICENSE.txt.
- Worker third-party notices: see public/ocr/worker-LICENSE.txt.
- @tesseract.js-data/eng 1.0.0 package declares MIT; package repository: https://github.com/naptha/tessdata. See its package metadata and upstream trained-data notices when redistributing beyond this project.

Other JavaScript/Android libraries retain their respective package notices and licenses. The included welcome illustration is AI-generated; no external student photograph is bundled as real profile information.
