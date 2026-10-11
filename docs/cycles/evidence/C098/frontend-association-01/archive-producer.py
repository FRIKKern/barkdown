import pathlib,zipfile,tarfile,hashlib,json,base64,time,shutil
root=pathlib.Path.cwd();base=root/'docs/cycles/evidence/C098';out=base/'frontend-association-01';assert not out.exists();out.mkdir();shutil.copyfile(__file__,out/'archive-producer.py');start=time.monotonic();sha=lambda b:hashlib.sha256(b).hexdigest();result={'status':'running','archives':[]}
def save():(out/'archives.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
save()
try:
 f=json.loads((base/'font-attribution-01/result.json').read_text());p=json.loads((base/'font-player-attribution-02/result.json').read_text());matches=[]
 for row in f['exactReleaseMatches']:
  arc=root/'runtime/font-inputs-01'/row['archive'];b=arc.read_bytes();assert sha(b)==row['archiveSha256']
  with zipfile.ZipFile(arc) as z:
   data=z.read(row['member']);assert len(data)==row['bytes'] and sha(data)==row['sha256']
   if row['archive']=='Inter-3.9.zip':assert z.read('LICENSE.txt')==(base/'font-attribution-01/licenses/Inter-release-LICENSE.txt').read_bytes()
  matches.append(row)
 m=json.loads((base/'font-player-attribution-02/asciinema-player-npm.json').read_text());b=(base/'font-player-attribution-02/asciinema-player-3.8.0.tgz').read_bytes();d=m['dist'];assert sha(b)==next(r['sha256'] for r in p['downloads'] if r['file'].endswith('.tgz'));assert hashlib.sha1(b).hexdigest()==d['shasum'];assert 'sha512-'+base64.b64encode(hashlib.sha512(b).digest()).decode()==d['integrity']
 with tarfile.open(base/'font-player-attribution-02/asciinema-player-3.8.0.tgz','r:gz') as t:
  for r in p['matches']:
   if r['kind']!='player':continue
   data=t.extractfile(r['packageMember']).read();assert len(data)==r['bytes'] and sha(data)==r['sha256']
  original=t.extractfile('package/LICENSE').read();assert original==(base/'font-player-attribution-02/Asciinema-player-LICENSE.txt').read_bytes()==(base/'font-player-attribution-02/Asciinema-player-source-LICENSE.txt').read_bytes()
 result.update(status='passed',archives=matches,player={'name':m['name'],'version':m['version'],'tarball':d['tarball'],'integrity':d['integrity'],'shasum':d['shasum'],'archiveSha256':sha(b),'packageJsonSha256':sha(tarfile.open(base/'font-player-attribution-02/asciinema-player-3.8.0.tgz','r:gz').extractfile('package/package.json').read()),'sourceCommit':p['playerCommit']},limits=['Exact retained archive members and originals rechecked, not signature verification or historical acquisition','Player published dist correspondence is separate from original-source/embedded compilation'])
except Exception as e:result.update(status='failed',error=repr(e))
finally:result['elapsedMs']=round((time.monotonic()-start)*1000);save();print(json.dumps({k:v for k,v in result.items() if k!='archives'}))
if result['status']!='passed':raise SystemExit(1)
