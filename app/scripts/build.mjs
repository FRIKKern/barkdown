import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(root, 'renderer', 'src', 'index.js')],
  bundle: true,
  outfile: path.join(root, 'renderer', 'dist', 'app.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome130'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  loader: { '.css': 'css' },
  define: { 'process.env.NODE_ENV': '"development"' },
};

import fs from 'fs';

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching renderer…');
} else {
  await esbuild.build(options);
}
