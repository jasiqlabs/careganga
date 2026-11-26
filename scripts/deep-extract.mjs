import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

async function analyze() {
  const css = await (await fetch('https://careganga.com/assets/index-DWm0_6Pa.css')).text();
  const js = await (await fetch('https://careganga.com/assets/index-jKKGw7wC.js')).text();

  console.log('--- Checking CSS for Spinner / Loading styles ---');
  // Look for spinSlow or keyframes definition
  const lines = css.split('}');
  const spinnerRules = lines.filter(l => 
    l.includes('spinSlow') || 
    l.includes('spinReverse') || 
    l.includes('pulseGlow') || 
    l.includes('letterBounce') ||
    l.includes('preloader') ||
    l.includes('loading') ||
    l.includes('loader')
  );
  console.log('Found spinner related CSS rules:', spinnerRules.length);
  await writeFile('scripts/spinner-css.txt', spinnerRules.join('}\n'));

  // Search JS for preloader / loading screen component
  console.log('--- Checking JS for Loading / Spinner Component ---');
  // Find strings like "loading", "CareGanga", spinner, preloader in JSX-like calls
  const matches = [];
  const regex = /.{0,100}(?:preloader|spinSlow|spinReverse|Loading\.\.\.|CareGanga Foundation).{0,100}/gi;
  let m;
  let count = 0;
  while ((m = regex.exec(js)) !== null && count < 20) {
    matches.push(m[0]);
    count++;
  }
  console.log('Sample JS matches near loading/preloader:');
  console.log(matches.slice(0, 10));

  // Extract all image URLs (including Cloudinary, S3, Firebase, Unsplash, CDN, etc.)
  const urlRegex = /(https?:\/\/[a-zA-Z0-9_\-\.\:\/]+?\.(?:png|jpg|jpeg|svg|webp|gif|avif))/gi;
  const imageUrls = new Set();
  while ((m = urlRegex.exec(js)) !== null) {
    const u = m[1];
    if (!u.includes('w3.org') && !u.includes('schema.org') && !u.includes('googleapis') && !u.includes('github')) {
      imageUrls.add(u);
    }
  }

  // Also check for relative image paths like /images/..., /assets/...
  const relRegex = /["'](\/(?:images|img|static|assets)\/[a-zA-Z0-9_\-\.\/]+?\.(?:png|jpg|jpeg|svg|webp|gif|ico))["']/gi;
  while ((m = relRegex.exec(js)) !== null) {
    imageUrls.add('https://careganga.com' + m[1]);
  }
  while ((m = relRegex.exec(css)) !== null) {
    imageUrls.add('https://careganga.com' + m[1]);
  }

  console.log(`\nFound ${imageUrls.size} image URLs!`);
  const imgList = Array.from(imageUrls);
  await writeFile('scripts/image-urls.json', JSON.stringify(imgList, null, 2));
  console.log('Sample Image URLs (first 25):', imgList.slice(0, 25));

  // Download all images to public/careganga-assets
  const outDir = resolve('public/careganga-assets');
  await mkdir(outDir, { recursive: true });

  let dlCount = 0;
  for (const imgUrl of imageUrls) {
    try {
      const parsed = new URL(imgUrl);
      const name = basename(parsed.pathname) || `asset_${dlCount}.png`;
      const res = await fetch(imgUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 50) {
          await writeFile(join(outDir, name), buf);
          dlCount++;
          console.log(`Downloaded (${dlCount}/${imageUrls.size}): ${name} [${buf.length} bytes]`);
        }
      }
    } catch (e) {
      // skip
    }
  }
  console.log(`\nSuccessfully downloaded ${dlCount} assets into public/careganga-assets/`);
}

analyze().catch(console.error);
