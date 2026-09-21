const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
for(const file of ['check-worktabs.cjs','check-project-editor.cjs','check-upgrades.cjs','check-editor-study.cjs','check-prd.cjs','check-previews.cjs']){
 const result=spawnSync(process.execPath,[path.join(root,'tests',file)],{cwd:root,encoding:'utf8',timeout:120000,env:process.env});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 fs.writeFileSync(path.join(root,'test-results',file+'.log'),(result.stdout||'')+(result.stderr||''));
 if(result.error||result.status!==0){console.error(result.error||file+' failed');process.exit(1);}
}console.log('All concept and handoff checks passed.');
