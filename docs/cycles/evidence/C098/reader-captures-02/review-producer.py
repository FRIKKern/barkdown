from PIL import Image,ImageDraw
from pathlib import Path
import json, hashlib, os, datetime, shutil
root=Path.cwd(); evidence=root/'docs/cycles/evidence/C098/reader-captures-02'; review=root/'.git/c098-review-reader-02';review.mkdir(exist_ok=True)
manifest=json.loads((root/'docs/images/status/manifest.json').read_text())
result=json.loads((evidence/'result.json').read_text())
assert result['status']=='passed' and manifest['barkdownCommit']==result['source']
def when(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
start,end=when(result['startedAt']),when(result['finishedAt'])
candidates=[d for d in Path(os.environ['TEMP']).glob('bd-status-*/status-gif-frames') if start<=d.stat().st_mtime<=end]
assert len(candidates)==1, candidates
frames=sorted(candidates[0].glob('*.png')); assert frames
motion=evidence/'live-motion';motion.mkdir(exist_ok=True)
retained=[]
for file in frames:
    target=motion/file.name; shutil.copyfile(file,target); b=target.read_bytes();retained.append({'file':file.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(motion/'manifest.json').write_text(json.dumps({'source':result['source'],'originalDirectory':str(candidates[0]),'scope':'All lossless live editing frames retained; no database or credentials','frames':retained},indent=2)+'\n')
run=json.loads((root/'docs/visual/pending.json').read_text())['run']; standard=json.loads((root/f'docs/visual/runs/{run}/manifest.json').read_text()); comparison=json.loads((root/f'docs/visual/runs/{run}/comparison.json').read_text())
def sheets(items,stem):
    output=[]
    for offset in range(0,len(items),6):
        canvas=Image.new('RGB',(1260,1320),'#222');draw=ImageDraw.Draw(canvas)
        for i,(label,im) in enumerate(items[offset:offset+6]):
            im=im.convert('RGB');im.thumbnail((620,410));x=(i%2)*630;y=(i//2)*440;draw.text((x+5,y+3),label,fill='white');canvas.paste(im,(x+5,y+25))
        out=review/f'{stem}-{offset:03}.png';canvas.save(out);output.append(str(out))
    return output
live=sheets([(f'lossless {f.name}',Image.open(f)) for f in frames],'live')
gif=Image.open(root/'docs/images/status/editing.gif');encoded=[]
for i in range(gif.n_frames):gif.seek(i);encoded.append((f'GIF {i:03}',gif.copy()))
gif_sheets=sheets(encoded,'gif')
standard_sheets=sheets([(f"{s['area']} {f['step']}",Image.open(root/f['file'])) for s in standard['shots'] for f in s['frames']],'standard')
changed=[e for e in comparison['entries'] if e['metrics'].get('changedRatio',0)>0 or e['geometryChanged'] or e['metrics']['kind'] not in ['within-tolerance']]
report={'source':result['source'],'run':run,'environmentChanged':comparison['environmentChanged'],'standardFrames':sum(len(s['frames']) for s in standard['shots']),'liveFrames':len(frames),'gifFrames':gif.n_frames,'sheets':live+gif_sheets+standard_sheets,'changed':changed}
(review/'review-inputs.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['sheets','changed']},indent=2));print('Changed entries: '+str(len(changed)))
