const fs = require('node:fs');
const path = require('node:path');
const { launchOwnedWorker } = require('../../main/goal-process');
const owner = JSON.parse(process.argv[2]);
launchOwnedWorker({ ...owner, script: path.join(__dirname, 'goal-process-tree.cjs'), args: [path.join(owner.storeDir, 'effects.txt')], onMessage(message) {
  if (message.type === 'tree') {
    fs.writeFileSync(path.join(owner.storeDir, 'tree.json'), JSON.stringify(message));
    setTimeout(() => process.exit(23), 150); // Abrupt host exit; no stop/finally call.
  }
} }).catch(error => { process.stderr.write(error.stack); process.exit(1); });
