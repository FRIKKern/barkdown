import sys,pathlib,json,hashlib,time,datetime,shutil
root=pathlib.Path.cwd();sys.path.insert(0,str(root/'runtime/font-inspector-01'))
from fontTools import subset,version
from fontTools.ttLib import TTFont
inputs=root/'docs/cycles/evidence/C098/font-player-attribution-02';out=root/'docs/cycles/evidence/C098/font-reproduction-03';assert not out.exists(),'Preserve prior output';out.mkdir(parents=True);shutil.copyfile(__file__,out/'producer.py')
start=time.monotonic();sha=lambda b:hashlib.sha256(b).hexdigest();report={'version':1,'status':'running','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fonttools':version,'inputEvidence':'../font-player-attribution-02','sourceCommit':'01d5d9f05246fb7090a8403b81257535cb1a088b','unicodeSet':'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212','options':{'flavor':'woff2','recalc_bounds':False,'recalc_timestamp':False},'matches':[],'distributionReady':False}
try:
    previous=json.loads((inputs/'result.json').read_text());assert previous['status']=='prepared'
    for weight in ['Regular','Medium','SemiBold']:
        name='IBMPlexMono-'+weight;file=inputs/(name+'.ttf');expected=next(d for d in previous['downloads'] if d['file']==file.name)['sha256'];assert sha(file.read_bytes())==expected
        options=subset.Options();options.flavor='woff2';assert options.recalc_bounds is False and options.recalc_timestamp is False
        # Use the actual CLI loader: its default preserves existing bounds. A
        # bare TTFont constructor defaults to recalculating three header tables.
        font=subset.load_font(str(file),options);sub=subset.Subsetter(options=options);sub.populate(unicodes=subset.parse_unicodes(report['unicodeSet']));sub.subset(font);font.flavor='woff2';generated=out/(name+'-latin-reproduced.woff2');subset.save_font(font,str(generated),options)
        rel=pathlib.Path('fonts')/(name+'-latin.woff2');source=root/'../barkpark-windows-return/api/priv/static'/rel;runtime=root/'runtime/barkpark-944a57a1-win32-x64-release-05/lib/barkpark-0.1.0/priv/static'/rel;package=root/'app/release/C098 Packaged Chø 02/win-unpacked/resources/runtime/lib/barkpark-0.1.0/priv/static'/rel
        actual=source.read_bytes();assert actual==runtime.read_bytes()==package.read_bytes();new=generated.read_bytes();assert actual==new,name+' did not reproduce'
        a,b=TTFont(source),TTFont(generated);assert a.getGlyphOrder()==b.getGlyphOrder() and a.getBestCmap()==b.getBestCmap()
        report['matches'].append({'file':rel.name,'bytes':len(new),'sha256':sha(new),'sourceTtfSha256':expected,'sourceRuntimePackageExact':True,'reproductionExact':True,'glyphOrderCmapEqual':True})
    report.update(status='prepared',limits=['Exact correspondence, not proof of historical acquisition route/compiler','No source or carried fonts replaced; outputs confined to fresh evidence','Original attempt02 retained: default TTFont recalculated bounds/header tables','Complete installer/app/native/PostgreSQL/ordinary CRT and player transitive obligations remain open'])
except Exception as error:report.update(status='failed',error=repr(error))
finally:report.update(elapsedMs=round((time.monotonic()-start)*1000),finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());(out/'result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if report['status']=='failed':sys.exit(1)
