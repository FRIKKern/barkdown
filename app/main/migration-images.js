// Migration-only image mapping. The convenience converter still refuses images.
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const zlib = require('node:zlib');
const { pmDocToBlocks } = require('../shared/portabledoc');
const { mapReferences } = require('./migration-references');

function pngInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 20 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('Only captured PNG images are supported');
  let pos = 8, width, height, channels, ended = false;
  const data = [];
  while (pos + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(pos), end = pos + 12 + length;
    if (end > bytes.length) throw Error('Truncated PNG image');
    const type = bytes.toString('ascii', pos + 4, pos + 8), payload = bytes.subarray(pos + 8, end - 4);
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(pos + 4, end - 4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(end - 4)) throw Error('PNG checksum differs');
    if (pos === 8 && type !== 'IHDR') throw Error('PNG header missing');
    if (type === 'IHDR') {
      if (width || length !== 13) throw Error('Invalid PNG header');
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[payload[9]];
      if (!width || !height || width > 10000 || height > 10000 || width * height > 20000000 || payload[8] !== 8 || !channels || payload[10] || payload[11] || payload[12]) throw Error('PNG dimensions, palette, depth or interlace are unsupported');
    } else if (type === 'acTL') throw Error('Animated PNG migration is not proven');
    else if (type === 'IDAT') data.push(payload);
    else if (type === 'IEND') { if (length || end !== bytes.length) throw Error('Invalid PNG ending'); ended = true; break; }
    else if (!/^[a-z]/.test(type) && type !== 'PLTE') throw Error('Unknown critical PNG chunk');
    pos = end;
  }
  if (!ended || !data.length) throw Error('Incomplete PNG image');
  const stride = width * channels + 1, expected = stride * height;
  const decoded = zlib.inflateSync(Buffer.concat(data), { maxOutputLength: expected });
  if (decoded.length !== expected) throw Error('PNG pixel data length differs');
  for (let row = 0; row < height; row++) if (decoded[row * stride] > 4) throw Error('Invalid PNG row filter');
  return { pixelWidth: width, pixelHeight: height };
}

function resolveImage(src, { files, sourceDir } = {}) {
  if (typeof src !== 'string' || !src || !files || !sourceDir) throw Error('Image requires a captured profile attachment');
  let relative;
  if (/^attachments\/[\w .-]+\.png$/i.test(src)) relative = src;
  else {
    let file = src;
    if (src.startsWith('file:')) {
      const url = new URL(src);
      if (url.search || url.hash || (url.hostname && url.hostname !== 'localhost')) throw Error('Unowned image URL');
      file = fileURLToPath(url);
    }
    if (!path.isAbsolute(file)) throw Error('External or noncanonical image source');
    relative = path.relative(sourceDir, file).split(path.sep).join('/');
  }
  if (!/^attachments\/[\w .-]+\.png$/i.test(relative)) throw Error('Image is outside captured profile attachments');
  const file = files.find(f => f.path === relative);
  if (!file) throw Error('Image attachment is missing or belongs to another profile');
  return { src, path: relative, sha256: file.sha256, bytes: file.bytes, mime: 'image/png', ...pngInfo(file.data) };
}

function migrationBlocks(content, references, images = [], media = {}) {
  const blocks = content.content.flatMap(node => {
    if (node.type !== 'image') return pmDocToBlocks({ type: 'doc', content: [node] });
    const image = images.find(item => item.src === node.attrs.src);
    if (!image || typeof media[image.path] !== 'string') throw Error('Image has no verified migration mapping');
    const block = { type: 'image', src: media[image.path] };
    if (node.attrs.alt) block.alt = node.attrs.alt;
    for (const key of ['width', 'height']) if (node.attrs[key] != null) block[key] = node.attrs[key];
    return [block];
  });
  return mapReferences(blocks, references);
}

module.exports = { pngInfo, resolveImage, migrationBlocks };
