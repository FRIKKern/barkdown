// Supplemental live theme/geometry proof. Run through status-shots-isolated.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { connectPaperFixture, openFixturePaper, publishFixture } from '../../../../app/tests/lib/paper-fixture.mjs';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../../..');
const appDir = path.join(root, 'app');
const require = createRequire(path.join(appDir, 'package.json'));
const { _electron: electron } = require('playwright');
const slug = 'c073-link-theme';
publishFixture({slug, title: 'A link in the paper', description: 'Disposable C073 theme proof.', blocks: [
  {type:'heading', level:1, text:'A link in the paper'},
  {type:'paragraph', content:[{type:'text',value:'Read '},{type:'link',href:'https://example.org/docs/page',children:[{type:'text',value:'the documentation'}]},{type:'text',value:' when you need the details.'}]}
]});
const app = await electron.launch({executablePath:require('electron'), args:[appDir, `--user-data=${fs.mkdtempSync(path.join(os.tmpdir(),'c073-link-'))}`], env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const captures = [];
try {
  const page = await app.firstWindow();
  await page.waitForSelector('#bw-pages .bw-page-row');
  await connectPaperFixture(page);
  await openFixturePaper(page, slug);
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live'), null, {timeout:60000});
  for (const [name,theme,width,height] of [['link-dark','dark',1400,900],['link-light','light',1400,900],['link-narrow','dark',1000,800]]) {
    await page.mouse.move(5,5);
    await page.setViewportSize({width,height});
    await page.emulateMedia({colorScheme:theme});
    await page.waitForTimeout(500);
    await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror a[href]').first().hover();
    const card = page.locator('body .bp-link-preview');
    await card.waitFor({state:'visible'});
    await page.waitForTimeout(400);
    const geometry = await card.evaluate(el => { const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,viewport:[innerWidth,innerHeight]}; });
    if (geometry.x<0 || geometry.y<0 || geometry.x+geometry.width>width || geometry.y+geometry.height>height) throw Error(`Clipped preview: ${name}`);
    await page.screenshot({path:path.join(out,name+'.png')});
    captures.push({name,theme,geometry});
  }
  fs.writeFileSync(path.join(out,'linkpreview-geometry.json'),JSON.stringify({host:process.env.BARKDOWN_SHOTS_HOST_COMMIT,upstream:process.env.BARKDOWN_SHOTS_BP_COMMIT,capturedAt:new Date().toISOString(),captures},null,2)+'\n');
  console.log('Three live link-preview views captured; card stays inside each viewport.');
} finally { await app.close(); }
