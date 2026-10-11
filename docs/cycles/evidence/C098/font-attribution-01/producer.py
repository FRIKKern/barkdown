import sys,json,hashlib,pathlib,zipfile,urllib.request,time,shutil,datetime
root=pathlib.Path.cwd()
sys.path.insert(0,str(root/'runtime/font-inspector-01'))
from fontTools.ttLib import TTFont
out=root/'docs/cycles/evidence/C098/font-attribution-01'
assert not out.exists(),'Preserve prior output'
out.mkdir(parents=True)
shutil.copyfile(__file__,out/'producer.py')
started=time.monotonic()
report={'version':1,'status':'running','distributionReady':False,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
def h(b):return hashlib.sha256(b).hexdigest()
def write(): (out/'result.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
write()
try:
 source=root/'../barkpark-windows-return/api/priv/static/fonts'
 runtime=root/'runtime/barkpark-944a57a1-win32-x64-release-03/lib/barkpark-0.1.0/priv/static/fonts'
 package=root/'app/release/C098 Packaged Chø 01/win-unpacked/resources/runtime/lib/barkpark-0.1.0/priv/static/fonts'
 metadata=[]
 for p in sorted(source.glob('*.woff2')):
  b=p.read_bytes();assert b==(runtime/p.name).read_bytes()==(package/p.name).read_bytes()
  font=TTFont(p)
  names=[{'id':n.nameID,'platform':n.platformID,'encoding':n.platEncID,'language':n.langID,'value':n.toUnicode()} for n in font['name'].names if n.nameID in [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17]]
  axes=[{'tag':a.axisTag,'min':a.minValue,'default':a.defaultValue,'max':a.maxValue} for a in font['fvar'].axes] if 'fvar' in font else []
  metadata.append({'file':p.name,'bytes':len(b),'sha256':h(b),'names':names,'axes':axes,'sourceRuntimePackageEqual':True})
 (out/'metadata.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
 originals=out/'licenses';originals.mkdir()
 for p in source.glob('*OFL.txt'):shutil.copyfile(p,originals/p.name)
 mappings=[('Inter-3.9.zip','Inter (web)/Inter-upright.var.woff2','Inter-var.woff2'),('source-serif-4.005_WOFF2.zip','source-serif-4.005_WOFF2/VAR/SourceSerif4Variable-Roman.otf.woff2','SourceSerif4Variable-Roman.woff2'),('source-serif-4.005_WOFF2.zip','source-serif-4.005_WOFF2/VAR/SourceSerif4Variable-Italic.otf.woff2','SourceSerif4Variable-Italic.woff2')]
 matches=[]
 for archive,member,name in mappings:
  p=root/'runtime/font-inputs-01'/archive
  with zipfile.ZipFile(p) as z:b=z.read(member)
  assert b==(source/name).read_bytes()
  matches.append({'archive':archive,'archiveSha256':h(p.read_bytes()),'member':member,'target':name,'bytes':len(b),'sha256':h(b),'exact':True})
 with zipfile.ZipFile(root/'runtime/font-inputs-01/Inter-3.9.zip') as z:(originals/'Inter-release-LICENSE.txt').write_bytes(z.read('LICENSE.txt'))
 serif='2823e993c53fca27c5c8749f529b56a5a7c77b6b'
 url='https://raw.githubusercontent.com/adobe-fonts/source-serif/'+serif+'/LICENSE.md'
 with urllib.request.urlopen(url,timeout=30) as response:license_bytes=response.read()
 (originals/'SourceSerif-release-LICENSE.md').write_bytes(license_bytes)
 for stem in ['serif','inter']:
  shutil.copyfile(root/('.git/c098-'+stem+'-release-01.json'),out/(stem+'-release.json'))
  shutil.copyfile(root/('.git/c098-'+stem+'-commit-01.txt'),out/(stem+'-commit.txt'))
 shutil.copyfile(root/'.git/c098-font-inspector-install-01.json',out/'inspector-install.json')
 report.update({'status':'prepared','fontCount':len(metadata),'exactReleaseMatches':matches,'sourceSerifLicense':{'url':url,'sha256':h(license_bytes)},'inspector':{'fonttools':'4.60.1','brotli':'1.1.0','location':'owned runtime/font-inspector-01; no app/upstream dependency changes'},'limits':['Embedded font versions are declarations; separate exact archive-byte matches establish these three source artifacts','IBM Plex Mono 2.3 latin subsets match pinned source/runtime/package, but original subset recipe and exact Google Fonts source pin remain unproven','Release tags resolved to recorded commits; original acquisition route is not established','Download duration excluded; no font regeneration, replacement or new rendering acceptance','Other compiled/native/system inputs remain open; not an installer or complete distribution notice set']})
except Exception as error:
 report.update({'status':'failed','error':repr(error)});sys.exitcode=1
finally:
 report['elapsedMs']=round((time.monotonic()-started)*1000);report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write();print(json.dumps(report))
if report['status']=='failed':sys.exit(1)
