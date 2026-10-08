import sys,json,hashlib,pathlib,urllib.request,time,datetime,tarfile,io,subprocess,shutil,base64
root=pathlib.Path.cwd();sys.path.insert(0,str(root/'runtime/font-inspector-01'))
from fontTools.ttLib import TTFont
from fontTools import subset,version as fonttools_version
out=root/'docs/cycles/evidence/C098/font-player-attribution-02';assert not out.exists(),'Preserve prior output';out.mkdir(parents=True)
shutil.copyfile(__file__,out/'producer.py');start=time.monotonic();report={'version':1,'status':'running','distributionReady':False,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'downloads':[],'matches':[]}
sha=lambda b:hashlib.sha256(b).hexdigest()
def persist():(out/'result.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
def get(url,name):
    b=urllib.request.urlopen(url,timeout=25).read();(out/name).write_bytes(b);report['downloads'].append({'url':url,'file':name,'bytes':len(b),'sha256':sha(b)});persist();return b
source=root/'../barkpark-windows-return/api/priv/static';runtime=root/'runtime/barkpark-944a57a1-win32-x64-release-05/lib/barkpark-0.1.0/priv/static';package=root/'app/release/C098 Packaged Chø 02/win-unpacked/resources/runtime/lib/barkpark-0.1.0/priv/static'
def target(rel):
    b=(source/rel).read_bytes();assert b==(runtime/rel).read_bytes()==(package/rel).read_bytes(),rel+' source/runtime/package mismatch';return b
try:
    pin='01d5d9f05246fb7090a8403b81257535cb1a088b';report['googleFontsCommit']=pin;report['fonttools']=fonttools_version;report['unicodeSet']='U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212'
    fonts=get('https://api.github.com/repos/google/fonts/commits/'+pin,'google-fonts-commit.json');assert json.loads(fonts)['sha']==pin
    base='https://raw.githubusercontent.com/google/fonts/'+pin+'/ofl/ibmplexmono/'
    license_bytes=get(base+'OFL.txt','IBM-Plex-Mono-OFL.txt');report['fontLicenseMatchesCarried']=license_bytes==target('fonts/IBMPlexMono-OFL.txt')
    get(base+'upstream_info.md','IBM-Plex-Mono-upstream-info.md');get(base+'METADATA.pb','IBM-Plex-Mono-metadata.pb')
    issue=get('https://api.github.com/repos/FRIKKern/barkpark/issues/4217','font-recipe-issue.json');report['recipeReference']='https://github.com/FRIKKern/barkpark/issues/4217';assert json.loads(issue)['number']==4217
    for weight in ['Regular','Medium','SemiBold']:
        name='IBMPlexMono-'+weight;ttf=get(base+name+'.ttf',name+'.ttf');font=TTFont(io.BytesIO(ttf),recalcTimestamp=False);versions=[n.toUnicode() for n in font['name'].names if n.nameID==5];assert versions and all(v=='Version 2.3' for v in versions),versions
        options=subset.Options();options.flavor='woff2';options.recalc_timestamp=False
        sub=subset.Subsetter(options=options);sub.populate(unicodes=subset.parse_unicodes(report['unicodeSet']));sub.subset(font);font.flavor='woff2';file=out/(name+'-latin-reproduced.woff2');font.save(file)
        actual=target('fonts/'+name+'-latin.woff2');new=file.read_bytes();report['matches'].append({'kind':'font','file':name+'-latin.woff2','sourceVersion':versions,'sourceBytes':len(ttf),'sourceSha256':sha(ttf),'carriedBytes':len(actual),'carriedSha256':sha(actual),'reproducedBytes':len(new),'reproducedSha256':sha(new),'exact':actual==new});persist()
    metadata=json.loads(get('https://registry.npmjs.org/asciinema-player/3.8.0','asciinema-player-npm.json'));assert metadata['name']=='asciinema-player' and metadata['version']=='3.8.0'
    dist=metadata['dist'];tgz=get(dist['tarball'],'asciinema-player-3.8.0.tgz');algorithm,digest=dist['integrity'].split('-',1);assert algorithm=='sha512' and hashlib.sha512(tgz).digest()==base64.b64decode(digest);assert hashlib.sha1(tgz).hexdigest()==dist['shasum']
    ref=json.loads(get('https://api.github.com/repos/asciinema/asciinema-player/git/ref/tags/v3.8.0','asciinema-player-ref.json'));assert ref['object']['type']=='commit' and ref['object']['sha']=='6e0b95ecea4773599d49dc590624f508e3ff8e0e';report['playerCommit']=ref['object']['sha']
    with tarfile.open(fileobj=io.BytesIO(tgz),mode='r:gz') as tar:
        members=tar.getnames();(out/'player-package-inventory.json').write_text(json.dumps(members,indent=2)+'\n')
        for name in ['asciinema-player.min.js','asciinema-player.css']:
            member='package/dist/bundle/'+name;b=tar.extractfile(member).read();actual=target('assets/'+name);assert actual==b,name+' mismatch';report['matches'].append({'kind':'player','file':name,'bytes':len(b),'sha256':sha(b),'exact':True,'packageMember':member});persist()
        license_bytes=tar.extractfile('package/LICENSE').read();(out/'Asciinema-player-LICENSE.txt').write_bytes(license_bytes)
        original=get('https://raw.githubusercontent.com/asciinema/asciinema-player/'+report['playerCommit']+'/LICENSE','Asciinema-player-source-LICENSE.txt');assert original==license_bytes
        carried=target('assets/asciinema-player.LICENSE.txt');assert license_bytes in carried,'Original license absent from carried notice';report['playerLicenseExactOriginalWithinCarriedNotice']=True
    report.update(status='prepared',limits=['Preparation only, no distribution approval or installer','Exact reproduction can establish correspondence without proving original acquisition route or historical compiler','FontTools4.60.1 differs from historical issue4.60.2; comparison result is explicit','Player transitive embedded/generated dependency obligations and complete app/native/PostgreSQL/CRT notices remain for review','Source runtime and package inputs are read-only; no source font/asset replacement'])
except Exception as error:report.update(status='failed',error=repr(error))
finally:report.update(elapsedMs=round((time.monotonic()-start)*1000),finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());persist();print(json.dumps(report,ensure_ascii=False))
if report['status']=='failed':sys.exit(1)
