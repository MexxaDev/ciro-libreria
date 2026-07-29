'use strict';

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcDir = join(root, 'node_modules', '@fortawesome', 'fontawesome-free');
const destDir = join(root, 'vendor', 'fontawesome');

const files = [
  'css/all.min.css',
  'webfonts/fa-solid-900.woff2',
  'webfonts/fa-solid-900.ttf',
  'webfonts/fa-regular-400.woff2',
  'webfonts/fa-regular-400.ttf',
  'webfonts/fa-brands-400.woff2',
  'webfonts/fa-brands-400.ttf'
];

if (!existsSync(srcDir)) {
  throw new Error('Font Awesome not found at ' + srcDir);
}

for (const file of files) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);

  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('Copied:', file);
}

console.log('Font Awesome files copied to vendor/fontawesome/');
