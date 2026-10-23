'use strict';
const vscode = require('vscode'), fs = require('fs'), path = require('path');
const {spawn} = require('child_process');
const ROOT = 'D:\\vs code\\problem solving';
const {capture} = require('./capture');
function activate(context) {
  const output = vscode.window.createOutputChannel('C++ Backup');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'cppBackup.showLog';
  status.text = '$(cloud) C++ Backup'; status.tooltip = 'Automatic snapshots and private GitHub publishing'; status.show();
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
      if (code && !result) error('Publisher failed. Local saves are queued; retrying automatically.');
      else if (result && !result.ok) error(result.message);
      else {lastError='';status.text='$(cloud-upload) C++ Backup';status.tooltip=result?.message || 'Ready';}
      if (pending) setTimeout(publish,100);
    });
  }
  context.subscriptions.push(output,status,
    vscode.workspace.onDidSaveTextDocument(doc=>{
      if (doc.uri.scheme !== 'file') return;
      try {
        const id = capture(ROOT,doc.uri.fsPath);
        if (id) {output.appendLine('Captured save: '+doc.uri.fsPath);publish();}
      } catch(e) { output.appendLine('CAPTURE ERROR: '+e.message);vscode.window.showErrorMessage('C++ Backup could not capture this save: '+e.message); }
    }),
    vscode.commands.registerCommand('cppBackup.retry',publish),
    vscode.commands.registerCommand('cppBackup.showLog',()=>{output.show(true);}),
    {dispose:()=>clearInterval(timer)}
  );
  const timer = setInterval(publish,60000);
  output.appendLine('C++ Backup active for '+ROOT+'. Capturing every changed .cpp save; retry every 60 seconds.');
  publish();
}
module.exports = {activate};
