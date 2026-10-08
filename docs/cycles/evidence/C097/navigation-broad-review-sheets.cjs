// Derived contact sheets only. Source screenshots/GIFs stay unchanged.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..'); process.chdir(repo);
const magick = 'C:/Users/Frikk/scoop/apps/imagemagick/current/magick.exe';
const run = JSON.parse(fs.readFileSync('docs/visual/pending.json')).run;
const manifest = JSON.parse(fs.readFileSync(`docs/visual/runs/${run}/manifest.json`));
const paper = JSON.parse(fs.readFileSync('docs/images/status/manifest.json'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (manifest.commit !== head || paper.barkdownCommit !== head) throw Error('Review must bind current implementation');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-navigation-broad-review-'));
function decode(file, prefix) {
  execFileSync(magick, [file, '-coalesce', path.join(temp, prefix + '-%03d.png')], {windowsHide:true});
  return fs.readdirSync(temp).filter(n => n.startsWith(prefix + '-') && n.endsWith('.png')).sort().map(n => path.join(temp, n));
}
function sheets(files, prefix) {
  const outputs = [];
  for (let i = 0; i < files.length; i += 12) {
    const output = path.join(__dirname, prefix + '-' + (i / 12 + 1) + '.jpg');
    const args = ['montage', '-background', '#151515', '-fill', 'white', '-font', 'Arial', '-pointsize', '14'];
    for (const file of files.slice(i, i + 12)) args.push('-label', path.basename(file), file);
    args.push('-thumbnail', '480x320>', '-tile', '3x', '-geometry', '+6+6', '-quality', '90', output);
    execFileSync(magick, args, {windowsHide:true}); outputs.push(output);
  }
  return outputs;
}
const stills = manifest.shots.flatMap(s => s.frames.map(f => f.file));
const differences = stills.map(p => p.replace(/\.png$/, '-diff.png')).filter(p => fs.existsSync(p));
const motion = manifest.shots.flatMap((s, i) => decode(s.file, 'standard-' + i));
const paperStills = paper.shots.filter(s => s.file.endsWith('.png')).map(s => 'docs/images/status/' + s.file);
const paperMotion = paper.shots.filter(s => s.file.endsWith('.gif')).flatMap((s, i) => decode('docs/images/status/' + s.file, 'paper-' + i));
const sources = {run, source:head, stills, differences, motion, paperStills, paperMotion};
const outputs = {stills:sheets(stills,'navigation-broad-gallery'),differences:sheets(differences,'navigation-broad-differences'),motion:sheets(motion,'navigation-broad-motion'),paperStills:sheets(paperStills,'navigation-broad-paper-stills'),paperMotion:sheets(paperMotion,'navigation-broad-paper-motion')};
fs.writeFileSync(path.join(__dirname, 'navigation-broad-review-inputs.json'), JSON.stringify({...sources,outputs},null,2)+'\n');
console.log(JSON.stringify({run,source:head,counts:Object.fromEntries(Object.entries(sources).filter(([k,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),outputs},null,2));
