import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

async function scanRootImages() {
  console.log('Fetching JS bundle...');
  const js = await (await fetch('https://careganga.com/assets/index-jKKGw7wC.js')).text();

  // Search for any "/something.ext"
  const rootImgRegex = /["'](\/[a-zA-Z0-9_\-\.\/]+?\.(?:png|jpg|jpeg|webp|svg|ico|gif))["']/gi;
  const found = new Set();
  let m;
  while ((m = rootImgRegex.exec(js)) !== null) {
    const path = m[1];
    if (!path.startsWith('//') && !path.includes('node_modules')) {
      found.add(path);
    }
  }

  console.log(`Found ${found.size} root image paths:`, Array.from(found));

  const outDir = resolve('public/careganga-live-assets');
  await mkdir(outDir, { recursive: true });

  const results = [];
  for (const p of found) {
    const url = 'https://careganga.com' + p;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const fileName = p.replace(/^\//, '').replace(/\//g, '_');
        await writeFile(join(outDir, fileName), buf);
        results.push({ path: p, file: fileName, size: buf.length, status: 200 });
        console.log(`[DOWNLOADED] ${p} -> ${fileName} (${buf.length} bytes)`);
      } else {
        results.push({ path: p, status: res.status });
        console.log(`[FAILED ${res.status}] ${p}`);
      }
    } catch (e) {
      results.push({ path: p, error: e.message });
      console.log(`[ERR] ${p}: ${e.message}`);
    }
  }

  // Also extract the entire preloader component code around function ym()
  console.log('\n--- Extracting Exact Preloader Component Code ---');
  const ymIndex = js.indexOf('function ym(){');
  if (ymIndex !== -1) {
    const preloaderCode = js.slice(ymIndex, ymIndex + 3000);
    await writeFile('scripts/preloader-extracted.js', preloaderCode);
    console.log('Saved preloader component slice to scripts/preloader-extracted.js');
  }

  await writeFile(join(outDir, 'assets-manifest.json'), JSON.stringify(results, null, 2));
}

scanRootImages().catch(console.error);
