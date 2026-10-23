'use strict';
const vscode = require('vscode'), fs = require('fs'), path = require('path');
const {spawn} = require('child_process');
const ROOT = 'D:\\vs code\\problem solving';
const {capture} = require('./capture');
function activate(context) {
  const output = vscode.window.createOutputChannel('C++ Backup');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'cppBackup.showLog';
  status.text = '$(cloud) C++ Backup'; status.tooltip = 'Ctrl+Alt+U: save, snapshot and upload. Ctrl+S saves locally only.'; status.show();
  let running = false, pending = false, lastError = '';
  function publish() {
    if (!fs.existsSync(path.join(ROOT,'.cpp-backup','config.json'))) return;
    if (running) { pending = true; return; }
    running = true; pending = false; status.text = '$(sync~spin) C++ Backup';
    const ps = path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const child = spawn(ps, ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'scripts','cpp-backup','Publish.ps1'),'-ProjectRoot',ROOT], {windowsHide:true});
    child.stdout.on('data', d=>output.append(d.toString()));
    child.stderr.on('data', d=>output.append(d.toString()));
    function error(message) {
      status.text = '$(warning) C++ Backup'; status.tooltip = message;
      if (message !== lastError) { lastError = message; vscode.window.showErrorMessage('C++ Backup: '+message, 'Show Log').then(x=>{if(x)output.show(true);}); }
    }
    child.on('error', e=>{running=false; error(e.message);});
    child.on('close', code=>{
      running=false;
      let result;
      try { result=JSON.parse(fs.readFileSync(path.join(ROOT,'.cpp-backup','status.json'),'utf8')); } catch {}
      if (code && !result) error('Publisher failed. Requested snapshots are queued; press Ctrl+Alt+U to retry.');
      else if (result && !result.ok) error(result.message);
      else {lastError='';status.text='$(cloud-upload) C++ Backup';status.tooltip=result?.message || 'Ready';}
      if (pending) setTimeout(publish,100);
    });
  }
  context.subscriptions.push(output,status,
    vscode.commands.registerCommand('cppBackup.upload',async()=>{
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc || doc.uri.scheme !== 'file') return;
      const relative = path.relative(ROOT,doc.uri.fsPath);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !/\.cpp$/i.test(relative) || /^(versions|\.cpp-backup|\.git)[\\/]/i.test(relative)) {
        vscode.window.showWarningMessage('Open a C++ source file inside problem solving to upload.'); return;
      }
      try {
        if (!(await doc.save())) throw new Error('Saving the active file failed.');
        const id = capture(ROOT,doc.uri.fsPath);
        if (id) {output.appendLine('Upload requested: '+doc.uri.fsPath);publish();}
      } catch(e) { output.appendLine('CAPTURE ERROR: '+e.message);vscode.window.showErrorMessage('C++ Backup could not capture this save: '+e.message); }
    }),
    vscode.commands.registerCommand('cppBackup.retry',publish),
    vscode.commands.registerCommand('cppBackup.showLog',()=>{output.show(true);})
  );
  output.appendLine('C++ Backup manual mode: Ctrl+Alt+U saves and uploads. Ordinary saves do not create snapshots. Pending uploads retry on the next upload request.');
}
module.exports = {activate};
