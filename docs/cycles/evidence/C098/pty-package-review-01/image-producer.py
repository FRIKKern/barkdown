from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
import json, hashlib
root=Path.cwd(); out=root/'.git/c098-pty-package-images-01'; out.mkdir(exist_ok=False)
run=root/'docs/visual/runs'/json.loads((root/'docs/visual/pending.json').read_text())['run']
manifest=json.loads((run/'manifest.json').read_text()); report=json.loads((run/'comparison.json').read_text())
records=[]
def sheets(name, entries):
    for offset in range(0,len(entries),9):
        canvas=Image.new('RGB',(1800,1440),'#222222'); d=ImageDraw.Draw(canvas)
        for i,(label,im) in enumerate(entries[offset:offset+9]):
            im=im.copy(); im.thumbnail((590,440)); x=i%3*600; y=i//3*480
            canvas.paste(im,(x+5,y+30)); d.text((x+5,y+5),label,fill='white')
        canvas.save(out/f'{name}-{offset:02}.png')
def add(file, frame=None):
    records.append({'file':str(file.relative_to(root)).replace('\\','/'),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'frame':frame})
stills=[]; diffs=[]; motion=[]
for e in report['entries']:
    p=root/e['after']; add(p); stills.append((e['area']+' '+e['step'],Image.open(p).convert('RGB')))
    if e['diff']:
        p=root/e['diff']; add(p); diffs.append((e['area']+' '+e['step'],Image.open(p).convert('RGB')))
for shot in manifest['shots']:
    p=root/shot['file']
    for i,im in enumerate(ImageSequence.Iterator(Image.open(p))):
        add(p,i); motion.append((shot['area']+' GIF '+str(i),im.convert('RGB')))
browser=[]
for name in ['2026-10-09T04-11-55-393Z-browser','2026-10-09T04-12-44-460Z-agent-browser']:
    for p in sorted((root/'docs/cycles/evidence/C089/live'/name).glob('*.png')):
        add(p); browser.append((p.parent.name[-13:]+' '+p.name,Image.open(p).convert('RGB')))
for name,entries in [('stills',stills),('diffs',diffs),('motion',motion),('browser',browser)]: sheets(name,entries)
(out/'inputs.json').write_text(json.dumps({'run':str(run.relative_to(root)).replace('\\','/'),'records':records,'counts':{'stills':len(stills),'diffs':len(diffs),'encodedGifFrames':len(motion),'browserFrames':len(browser)},'changes':[e for e in report['entries'] if e['geometryChanged'] or e['metrics'].get('changedRatio',0)]},indent=2)+'\n')
print(json.dumps({'stills':len(stills),'diffs':len(diffs),'encodedGifFrames':len(motion),'browserFrames':len(browser),'sheets':[str(p.relative_to(root)).replace('\\','/') for p in sorted(out.glob('*.png'))]}))
