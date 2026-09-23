import { sourceHash } from './visual-core.mjs';
import assert from 'node:assert/strict';
import { comparePixels, pairFrames } from './visual-diff.mjs';
const frame=(w=64,h=64)=>({width:w,height:h,data:Buffer.alloc(w*h*4,255)});
const a=frame(),b=frame();assert.equal(comparePixels(a,b).changedRatio,0);
b.data[0]=250;assert.equal(comparePixels(a,b).kind,'within-tolerance');
for(let y=10;y<30;y++)for(let x=10;x<30;x++)b.data[(y*64+x)*4]=0;
assert.equal(comparePixels(a,b).kind,'review-required');assert.ok(comparePixels(a,b).hotTiles.length);
assert.equal(comparePixels(a,frame(63,64)).kind,'dimensions');
console.log('Visual diff: identical images, low color noise, localized deletion and resize checked.');

assert.equal(sourceHash(Buffer.from('line\r\n')),sourceHash(Buffer.from('line\n')),'checkout line endings must not trigger false regressions');

const planned={step:'planned',file:'old-plan'},running={step:'running',file:'old-run'};
const added={step:'new-goal',file:'new-form'},newPlan={step:'planned',file:'new-plan'},newRun={step:'running',file:'new-run'};
assert.deepEqual(pairFrames([added,newPlan,newRun],[planned,running]).map(p=>[p.step,p.before?.file,p.after?.file]),[
 ['new-goal',undefined,'new-form'],['planned','old-plan','new-plan'],['running','old-run','new-run']
]);
assert.deepEqual(pairFrames([newRun],[planned,running]),[
 {step:'running',before:running,after:newRun},{step:'planned',before:planned,after:null}
]);
assert.deepEqual(pairFrames([], [planned]),[{step:'planned',before:planned,after:null}]);
assert.throws(()=>pairFrames([planned,planned]),/unique/);
assert.throws(()=>pairFrames([], [running,running]),/unique/);
console.log('Visual step matching: insertion, reordering, deletion and duplicate identities checked.');
