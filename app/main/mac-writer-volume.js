const { execFileSync } = require('node:child_process');

const volumeUuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

// Disk device numbers can change on reboot. Disk Utility reports the persistent APFS
// volume UUID. Resolve the device using df because diskutil expects a mount or device.
function readMacWriterVolume(root) {
  if (process.platform !== 'darwin') return null;
  const options = { encoding: 'utf8', timeout: 1500, maxBuffer: 128 * 1024, stdio: ['pipe', 'pipe', 'pipe'] };
  try {
    const device = execFileSync('/bin/df', ['-P', root], options).split('\n')[1]?.split(/\s+/)[0];
    if (!/^\/dev\/disk\d+(?:s\d+)+$/.test(device || '')) return null;
    const plist = execFileSync('/usr/sbin/diskutil', ['info', '-plist', device], options);
    const info = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], { ...options, input: plist }));
    const uuid = typeof info.VolumeUUID === 'string' ? info.VolumeUUID.toLowerCase() : null;
    return info.DeviceNode === device && info.FilesystemType === 'apfs' && volumeUuid(uuid) ? uuid : null;
  } catch { return null; }
}

module.exports = { readMacWriterVolume, volumeUuid };
