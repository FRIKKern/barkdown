const fs = require('node:fs'),
  path = require('node:path');
const service = require('../../main/terminal');
const owner = JSON.parse(process.argv[2]);
(async () => {
  const session = await service.start({ ...owner, root: owner.storeDir, send: () => {} });
  fs.writeFileSync(path.join(owner.storeDir, 'session.json'), JSON.stringify(session));
  const marker = path.join(owner.storeDir, 'pids.jsonl');
  service.input(
    { ...owner, ...session },
    `& '${process.execPath}' '${path.join(__dirname, 'terminal-descendants.cjs')}' '${marker}'`,
  );
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim().split('\n').length === 3) process.exit(23);
  }
  throw Error('Descendants did not start');
})().catch(async (error) => {
  console.error(error);
  await service.stopAll();
  process.exit(1);
});
