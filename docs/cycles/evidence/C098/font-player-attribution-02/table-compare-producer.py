import pathlib,sys,json,hashlib
root=pathlib.Path.cwd();sys.path.insert(0,str(root/'runtime/font-inspector-01'))
from fontTools.ttLib import TTFont
out=root/'docs/cycles/evidence/C098/font-player-attribution-02';rows=[]
for weight in ['Regular','Medium','SemiBold']:
    name='IBMPlexMono-'+weight;actual=root/'../barkpark-windows-return/api/priv/static/fonts'/(name+'-latin.woff2');rebuilt=out/(name+'-latin-reproduced.woff2');a,b=TTFont(actual),TTFont(rebuilt)
    rows.append({'file':actual.name,'glyphOrderEqual':a.getGlyphOrder()==b.getGlyphOrder(),'cmapEqual':a.getBestCmap()==b.getBestCmap(),'tables':[{'tag':str(tag),'equal':a.getTableData(tag)==b.getTableData(tag),'actualSha256':hashlib.sha256(a.getTableData(tag)).hexdigest(),'rebuiltSha256':hashlib.sha256(b.getTableData(tag)).hexdigest()} for tag in a.keys() if tag!='GlyphOrder'], 'headActual':{'created':a['head'].created,'modified':a['head'].modified,'checksum':a['head'].checkSumAdjustment},'headRebuilt':{'created':b['head'].created,'modified':b['head'].modified,'checksum':b['head'].checkSumAdjustment}})
(out/'table-comparison.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps([{**{k:v for k,v in r.items() if k!='tables'},'differentTags':[t['tag'] for t in r['tables'] if not t['equal']]} for r in rows],indent=2))
