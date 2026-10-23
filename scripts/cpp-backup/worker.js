'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const {spawnSync} = require('child_process');
const root = path.resolve(process.argv[2]);
const local = path.join(root, '.cpp-backup');
const config = JSON.parse(fs.readFileSync(path.join(local, 'config.json'), 'utf8'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const queue = path.join(local, 'queue'), versions = path.join(root, 'versions');
for (const dir of [queue, versions, path.join(local, 'blocked')]) fs.mkdirSync(dir, {recursive:true});
const stateFile = path.join(local, 'state.json');
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {files:{}};
function atomic(file, data) {
  const tmp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  const fd = fs.openSync(tmp, 'wx');
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
function log(message) {
  const line = new Date().toISOString() + ' ' + message;
  fs.appendFileSync(path.join(local, 'backup.log'), line + '\n');
  console.log(line);
}
function run(exe, args, input) {
  const result = spawnSync(exe, args, {cwd:root, input, encoding:'utf8', windowsHide:true, timeout:90000, maxBuffer:8*1024*1024,
    env:{...process.env, GIT_TERMINAL_PROMPT:'0', GCM_INTERACTIVE:'never', GH_PROMPT_DISABLED:'1'}});
  if (result.error) throw new Error('Process could not finish: ' + result.error.message);
  return result;
}
function git(args) {
  const r = run(config.git, args);
  if (r.status !== 0) throw new Error('Git ' + args[0] + ' failed: ' + (r.stderr || r.stdout).trim());
  return r.stdout.trim();
}
function scan(bytes) {
  const r = run(config.gitleaks, ['stdin','--no-banner','--redact','--exit-code','10'], bytes);
  if (r.status === 10) return false;
  if (r.status !== 0) throw new Error('Secret scanner failed; publishing is paused (fail closed).');
  // Include low-entropy hardcoded credentials which entropy-based rules may miss.
  const text = bytes.toString('utf8');
  return !/\b(?:password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[=:]\s*["'][^"'\r\n]+["']/i.test(text);
}
let blocked = 0;
try {
  for (const name of fs.readdirSync(queue).filter(n=>n.endsWith('.json')).sort()) {
    const eventFile = path.join(queue, name);
    const event = JSON.parse(fs.readFileSync(eventFile, 'utf8'));
    if (!/^\d{17}_\d{6}_[a-f0-9]{16}$/.test(event.id) || name !== event.id + '.json') throw new Error('Invalid queue identifier.');
    const relative = event.relative;
    if (typeof relative !== 'string' || relative.split(/[\\/]/).includes('..') || path.isAbsolute(relative) || !/\.cpp$/i.test(relative) || /^(versions|\.git|\.cpp-backup)\//i.test(relative)) throw new Error('Invalid queued source path.');
    const bytes = Buffer.from(event.content, 'base64');
    const digest = hash(bytes), key = relative.toLowerCase(), sourceId = hash(key).slice(0,12);
    const previous = state.files[key];
    if (previous && previous.hash === digest && fs.existsSync(path.join(root, previous.snapshot))) {
      fs.unlinkSync(eventFile); log('Unchanged; skipped ' + relative); continue;
    }
    if (!scan(bytes)) {
      fs.renameSync(eventFile, path.join(local, 'blocked', name));
      blocked++; log('BLOCKED: possible secret in ' + relative + '. Saved locally in .cpp-backup/blocked; not committed.'); continue;
    }
    const base = path.basename(relative, path.extname(relative)).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,70);
    const snapshot = 'versions/' + base + '_' + sourceId + '_' + event.id + '.cpp';
    const dest = path.join(root, snapshot);
    if (fs.existsSync(dest)) {
      if (hash(fs.readFileSync(dest)) !== digest) throw new Error('Snapshot collision; refusing to overwrite ' + snapshot);
    } else {
      atomic(dest, bytes);
    }
    state.files[key] = {hash:digest, snapshot, savedAt:event.savedAt};
    atomic(stateFile, JSON.stringify(state, null, 2));
    fs.unlinkSync(eventFile);
    log('Snapshot: ' + snapshot);
  }
  if (fs.existsSync(path.join(local, 'pause-publish'))) {
    log('Publishing temporarily paused; snapshots are safe locally.'); process.exit(0);
  }
  if (git(['branch','--show-current']) !== config.branch) throw new Error('Current branch is not ' + config.branch + '; preserving snapshots without switching branches.');
  if (git(['remote','get-url',config.remote]) !== config.remoteUrl || git(['remote','get-url','--push',config.remote]) !== config.remoteUrl) throw new Error('Remote URL changed; refusing to send source to an unverified destination.');
  // Commit only generated, still-untracked snapshots. Never stage arbitrary project files or deletions.
  const candidates = new Set([
    ...git(['ls-files','--others','--exclude-standard','--','versions/']).split('\n'),
    ...git(['diff','--cached','--name-only','--diff-filter=A','--','versions/']).split('\n')
  ]);
  for (const file of [...candidates].filter(Boolean).sort()) {
    if (!/^versions\/[a-zA-Z0-9_-]+_[a-f0-9]{12}_\d{17}_\d{6}_[a-f0-9]{16}\.cpp$/.test(file)) continue;
    if (!scan(fs.readFileSync(path.join(root, file)))) throw new Error('Possible secret detected in a pending snapshot; publishing is paused.');
    git(['add','--',file]);
    git(['commit','--only','-m','Snapshot ' + path.basename(file),'--',file]);
    log('Committed: ' + file);
  }
  // Check outgoing history too, so unrelated manually created commits cannot bypass scanning.
  const head = git(['rev-parse','HEAD']);
  const tracking = run(config.git, ['rev-parse','--verify',config.remote + '/' + config.branch]);
  const range = tracking.status === 0 ? tracking.stdout.trim() + '..HEAD' : 'HEAD';
  if (tracking.status !== 0 || tracking.stdout.trim() !== head) {
    const security = run(config.gitleaks, ['git','--no-banner','--redact','--exit-code','10','--log-opts='+range,'.']);
    if (security.status !== 0) throw new Error('Outgoing history failed secret scanning; push blocked. Review locally with Gitleaks.');
    log('Pushing queued commits...');
    git(['push','--porcelain',config.remote,'HEAD:refs/heads/' + config.branch]);
    log('GitHub push successful.');
  }
  const blockedCount = fs.readdirSync(path.join(local,'blocked')).filter(n=>n.endsWith('.json')).length;
  atomic(path.join(local,'status.json'), JSON.stringify({ok:blockedCount===0, at:new Date().toISOString(), head, message:blockedCount ? blockedCount+' save(s) blocked by secret scanning; inspect .cpp-backup/blocked locally.' : 'All snapshots published.'}));
  if (blockedCount) process.exitCode = 2;
} catch (error) {
  const message = String(error.message).replace(/https:\/\/[^\s/@]+:[^\s/@]+@/g,'https://[redacted]@');
  log('ERROR: ' + message + ' Snapshots retained; automatic retry in 60 seconds while VS Code is open.');
  atomic(path.join(local,'status.json'), JSON.stringify({ok:false,at:new Date().toISOString(),message}));
  process.exitCode = 1;
}
