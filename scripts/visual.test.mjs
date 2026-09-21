import { sourceHash } from './visual-core.mjs';
import assert from 'node:assert/strict';
import { comparePixels } from './visual-diff.mjs';
const frame=(w=64,h=64)=>({width:w,height:h,data:Buffer.alloc(w*h*4,255)});
const a=frame(),b=frame();assert.equal(comparePixels(a,b).changedRatio,0);
b.data[0]=250;assert.equal(comparePixels(a,b).kind,'within-tolerance');
for(let y=10;y<30;y++)for(let x=10;x<30;x++)b.data[(y*64+x)*4]=0;
assert.equal(comparePixels(a,b).kind,'review-required');assert.ok(comparePixels(a,b).hotTiles.length);
assert.equal(comparePixels(a,frame(63,64)).kind,'dimensions');
console.log('Visual diff: identical images, low color noise, localized deletion and resize checked.');

assert.equal(sourceHash(Buffer.from('line\r\n')),sourceHash(Buffer.from('line\n')),'checkout line endings must not trigger false regressions');
