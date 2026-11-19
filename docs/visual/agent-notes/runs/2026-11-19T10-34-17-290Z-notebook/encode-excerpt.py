from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json, hashlib, tempfile, sys
run=Path(sys.argv[1]); manifest=json.loads((run/'manifest.json').read_text())
assert not manifest.get('failure'), manifest.get('failure')
source=Path(sys.argv[2]); video_files=sorted(source.glob('*.png')); captured=manifest['frames']; assert [f['file'] for f in captured]==[f.name for f in video_files]; samples=[{'file':f['file'],'atMs':f['atMs'],'capturedMs':f['atMs']} for f in captured]
assert len(samples)>20
# docs/visual/RULES.md#readme-demo: at least 8 frames a second, measured from the frame times.
MIN_FPS=8; fps=(len(samples)-1)*1000/(samples[-1]['atMs']-samples[0]['atMs'])
assert fps>=MIN_FPS, f'measured {fps:.2f} fps, under the {MIN_FPS} fps floor'
size=(1200,750)
def frame(s): return Image.open(source/s['file']).convert('RGB').resize(size,Image.Resampling.LANCZOS)
sheet=Image.new('RGB',(size[0],size[1]*12))
for j,i in enumerate(np.linspace(0,len(samples)-1,12,dtype=int)): sheet.paste(frame(samples[i]),(0,j*size[1]))
palette=sheet.quantize(colors=240,method=Image.Quantize.MEDIANCUT).getpalette()[:240*3]
# Reserve exact application surfaces so large flat regions never acquire a tint.
from collections import Counter
surfaces=[list(c) for c,n in Counter((lambda im:getattr(im,'get_flattened_data',im.getdata)())(frame(samples[0]))).most_common(16)]
palette += [v for c in surfaces for v in c]
rgb=np.array(palette,dtype=np.int32).reshape(-1,3)
lut=np.full(1<<24,-1,dtype=np.int16); frames=[]; durations=[]; total_error=0; nvalues=0; protected=0; max_surface_error=0
for i,s in enumerate(samples):
    a=np.array(frame(s),dtype=np.uint32); codes=(a[:,:,0]<<16)|(a[:,:,1]<<8)|a[:,:,2]
    unique=np.unique(codes); missing=unique[lut[unique]<0]
    for offset in range(0,len(missing),2048):
        chunk=missing[offset:offset+2048]; c=np.stack([chunk>>16,(chunk>>8)&255,chunk&255],axis=-1).astype(np.int32)
        lut[chunk]=((c[:,None,:]-rgb[None,:,:])**2).sum(axis=2).argmin(axis=1)
    indices=lut[codes].astype(np.uint8); f=Image.fromarray(indices); f.putpalette(palette); frames.append(f)
    err=np.abs(a.astype(np.int32)-rgb[indices]); total_error+=int(err.sum()); nvalues+=err.size
    mask=((a==surfaces[0]).all(axis=2)|(a==surfaces[1]).all(axis=2)); protected+=int(mask.sum())
    if mask.any(): max_surface_error=max(max_surface_error,int(err[mask].max()))
    end=samples[i+1]['atMs'] if i+1<len(samples) else s['atMs']+125
    durations.append(max(10,round(end/10)*10-round(s['atMs']/10)*10))
out=run/'readme-notebook.gif'; frames[0].save(out,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1)
assert max_surface_error==0
encoded=Image.open(out); decoded=[]; duration=0; review=Path(tempfile.mkdtemp(prefix='barkdown-notebook-review-'))
for i in range(encoded.n_frames):
    encoded.seek(i); duration+=encoded.info.get('duration',0); decoded.append(encoded.convert('RGB'))
for n in range(0,len(decoded),12):
    contact=Image.new('RGB',(1600,804),'#171a17'); d=ImageDraw.Draw(contact)
    for j,im in enumerate(decoded[n:n+12]):
        thumb=im.resize((400,250)); x=j%4*400; y=j//4*268; contact.paste(thumb,(x,y)); d.text((x+4,y+251),str(n+j),fill='white')
    contact.save(review/f'sheet-{n//12:02}.jpg')
for i in [0,len(decoded)//3,2*len(decoded)//3,len(decoded)-1]: decoded[i].save(review/f'frame-{i}.png')
metrics={'output':out.name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'dimensions':size,'sourceVideoSha256':hashlib.sha256((run/'full-session.webm').read_bytes()).hexdigest(),'sampleFrames':len(samples),'reservedColors':surfaces,'encodedFrames':len(decoded),'durationMs':duration,'measuredFps':round(fps,2),'sourceTiming':'Every frame the capture recorded after setup, at its measured time: %d frames from %d to %d ms, about %.1f fps (mean gap %d ms). atMs and capturedMs are both milliseconds after frame capture began; the WebM has its own clock, not recorded per frame. Startup omitted; nothing cut; playback speed unchanged.'%(len(samples),samples[0]['atMs'],samples[-1]['atMs'],(len(samples)-1)*1000/(samples[-1]['atMs']-samples[0]['atMs']),round((samples[-1]['atMs']-samples[0]['atMs'])/(len(samples)-1))),'meanAbsoluteChannelError':total_error/nvalues,'exactBackgroundPixels':protected,'backgroundMaxAbsoluteChannelError':max_surface_error,'palette':'Shared 256 colors, exact nearest RGB lookup; reserved application backgrounds; no dithering','sourceFrames':[{'file':s['file'],'atMs':s['atMs'],'capturedMs':s['capturedMs'],'sha256':hashlib.sha256((source/s['file']).read_bytes()).hexdigest()} for s in samples]}
(run/'readme-encoding.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps({k:v for k,v in metrics.items() if k!='sourceFrames'},indent=2)); print('Review:',review)
