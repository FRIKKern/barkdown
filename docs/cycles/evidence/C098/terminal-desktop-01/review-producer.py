from PIL import Image, ImageDraw
from pathlib import Path
import json, hashlib
root=Path.cwd()
folders=[root/'docs/cycles/evidence/C089/live/2026-10-08T12-58-57-346Z-browser', root/'docs/cycles/evidence/C089/live/2026-10-08T12-59-40-049Z-agent-browser']
out=root/'.git/c098-terminal-desktop-review-01'
out.mkdir(exist_ok=False)
frames=[p for folder in folders for p in sorted(folder.glob('*.png'))]
assert len(frames)==17
for offset in range(0,len(frames),9):
    canvas=Image.new('RGB',(1800,1440),'#222222'); draw=ImageDraw.Draw(canvas)
    for i,p in enumerate(frames[offset:offset+9]):
        im=Image.open(p).convert('RGB'); im.thumbnail((590,440))
        x=(i%3)*600; y=(i//3)*480
        draw.text((x+5,y+5),p.parent.name[-13:]+' '+p.name,fill='white');canvas.paste(im,(x+5,y+30))
    canvas.save(out/f'browser-{offset:02}.png')
manifest={'frames':[{'file':str(p.relative_to(root)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in frames]}
(out/'inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'reviewDirectory':str(out)}))
