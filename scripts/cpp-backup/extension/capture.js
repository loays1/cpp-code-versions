'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let sequence = 0;
function capture(root, file) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative) || !/\.cpp$/i.test(relative)) return null;
  if (relative.split('/').some(x => /^(versions|\.git|\.cpp-backup|node_modules|build|dist)$/i.test(x))) return null;
  // Capture synchronously in the save callback, before another save can replace the file.
  const bytes = fs.readFileSync(file);
  const savedAt = new Date().toISOString();
  const id = savedAt.replace(/[-:.TZ]/g, '') + '_' + String(sequence++).padStart(6, '0') + '_' + crypto.randomBytes(8).toString('hex');
  const queue = path.join(root, '.cpp-backup', 'queue');
  fs.mkdirSync(queue, {recursive:true});
  const record = JSON.stringify({id, relative, savedAt, content:bytes.toString('base64')});
  const temp = path.join(queue, id + '.tmp');
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, record); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, path.join(queue, id + '.json'));
  return id;
}
module.exports = {capture};
if (require.main === module) console.log(capture(path.resolve(process.argv[2]), path.resolve(process.argv[3])));
