// The operating system's release, for the screenshot scripts' run reports. The scripts take no other value
// from the os module: machine values come from machine-values.mjs and folders from fixtureFolder().
import os from 'node:os';

export const osRelease = () => os.release();
