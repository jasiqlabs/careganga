import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

async function main() {
  console.log('Fetching live careganga.com html, css, js...');
  const baseUrl = 'https://careganga.com';
  const html = await (await fetch(baseUrl)).text();
  
  // Find js and css urls in html
  const jsMatch = html.match(/\/assets\/[a-zA-Z0-9_\-\.]+\.js/);
  const cssMatch = html.match(/\/assets\/[a-zA-Z0-9_\-\.]+\.css/);

  console.log('JS entry:', jsMatch ? jsMatch[0] : 'None');
  console.log('CSS entry:', cssMatch ? cssMatch[0] : 'None');

  const css = cssMatch ? await (await fetch(baseUrl + cssMatch[0])).text() : '';
  const js = jsMatch ? await (await fetch(baseUrl + jsMatch[0])).text() : '';

  console.log(`Downloaded: CSS (${css.length} bytes), JS (${js.length} bytes)`);

  const outDir = resolve('public/original-assets');
  await mkdir(outDir, { recursive: true });

  const allAssets = new Set();

  // Standard assets in /assets/
  const assetRegex = /\/assets\/[a-zA-Z0-9_\-\.]+\.(?:png|jpg|jpeg|svg|webp|ico|gif|woff2?|ttf)/gi;
  let m;
  while ((m = assetRegex.exec(js)) !== null) allAssets.add(m[0]);
  while ((m = assetRegex.exec(css)) !== null) allAssets.add(m[0]);
  while ((m = assetRegex.exec(html)) !== null) allAssets.add(m[0]);

  // Root assets
  allAssets.add('/favicon.ico');
  allAssets.add('/apple-touch-icon.png');

  // Any other http(s) images in js
  const extRegex = /https?:\/\/[a-zA-Z0-9_\-\.\/]+?\.(?:png|jpg|jpeg|svg|webp|gif)/gi;
  while ((m = extRegex.exec(js)) !== null) {
    if (!m[0].includes('w3.org') && !m[0].includes('google')) {
      allAssets.add(m[0]);
    }
  }

  console.log(`Found ${allAssets.size} unique assets!`);

  const downloaded = [];
  const errors = [];

  for (const assetPath of allAssets) {
    const fullUrl = assetPath.startsWith('http') ? assetPath : (baseUrl + assetPath);
    const fileName = basename(new URL(fullUrl).pathname);
    const targetFile = join(outDir, fileName);

    try {
      const res = await fetch(fullUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(targetFile, buffer);
        downloaded.push({ url: fullUrl, file: fileName, size: buffer.length });
        console.log(`[OK] ${fileName} (${buffer.length} bytes)`);
      } else {
        errors.push({ url: fullUrl, status: res.status });
      }
    } catch (err) {
      errors.push({ url: fullUrl, error: err.message });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Downloaded: ${downloaded.length} files`);
  console.log(`Failed: ${errors.length} files`);

  // Write manifest
  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify({ downloaded, errors, total: downloaded.length }, null, 2)
  );

  // Search for loader / spinner in JS & CSS
  console.log('\n--- Searching for Loader/Spinner in CSS & JS ---');
  const spinnerMatches = [];
  const spinnerRegex = /(?:class|className|id)[=:]["']([^"']*(?:loader|spinner|loading)[^"']*)["']/gi;
  while ((m = spinnerRegex.exec(js)) !== null) {
    spinnerMatches.push(m[0]);
  }
  console.log('Spinner class matches in JS:', spinnerMatches.slice(0, 15));

  // Search for keyframes or animation with spinner
  const keyframeRegex = /@keyframes\s+([a-zA-Z0-9_-]+)/gi;
  const keyframes = [];
  while ((m = keyframeRegex.exec(css)) !== null) {
    keyframes.push(m[1]);
  }
  console.log('CSS Keyframes found:', keyframes);
}

main().catch(console.error);
