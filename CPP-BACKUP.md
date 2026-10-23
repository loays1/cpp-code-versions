# Automatic C++ snapshots

Press **Ctrl+Alt+U** while editing a `.cpp` inside this project to save and request an upload. **Ctrl+S saves locally only** and creates no snapshot. The installed **C++ Snapshot Backup** extension captures the explicitly requested source in a durable local queue. A PowerShell mutex serializes the publisher, which creates a separate timestamped file in `versions/`, commits that file, and pushes to the public GitHub repository. Unchanged consecutive content produces no additional snapshot. Saving an older, different version again does create a new snapshot.

Repository: https://github.com/loays1/cpp-code-versions (public; snapshots can be viewed without signing in).

Names contain the source basename, a source-path hash (to distinguish equal names in different folders), UTC save timestamp, sequence and random identifier. Snapshots are complete files with their original encoding and line endings. Existing snapshots are never automatically edited or removed. Saves inside `versions/` are excluded to prevent recursion.

The original solution remains at `.vscode/s1.cpp` so existing Competitive Programming Helper test associations keep working. Existing compiler and task files remain unchanged. Open the project root when using its build task.

## Errors and retries

The VS Code status bar and **C++ Backup** Output channel show progress/errors. Pending work survives VS Code/Windows restarts. Publishing runs only on an explicit upload/retry request; there is no timer or startup upload. **C++ Backup: Retry Publishing** also triggers a retry. Failed pushes never remove snapshots or rewrite Git history. Pending work waits for the next Ctrl+Alt+U or Retry Publishing request. A changed Git branch, changed remote, or conflicting remote history pauses publishing safely.

Only generated snapshots are automatically staged and committed; your unrelated staged changes are left alone. VS Code JSON settings and build configurations stay on this computer and are ignored by Git. Generic compiler/settings files from the initial setup remain in the earlier commit history; that history was checked for secrets before making the repository public. Machine-specific runtime configuration and credentials have never been tracked. Manual changes to setup files are not automatically published.

The ignored `.cpp-backup/` directory contains the queue, state, local tools, log, and original setup backup. Do not delete it while work is pending. Authentication lives in Windows credential storage, outside the project. Gitleaks scans each queued source and outgoing Git history. Additional checks block quoted password/token assignments. Suspected secrets are held in `.cpp-backup/blocked/` and never automatically committed. Correct/remove the secret in your source and save again. Detection is defense in depth; do not put credentials in source code.

## Implementation

`scripts/cpp-backup/capture.js`: immediate durable capture.

`scripts/cpp-backup/Publish.ps1`: cross-process mutex.

`scripts/cpp-backup/worker.js`: deduplication, byte-preserving snapshots, secret scanning, selected-file commits, push and retry status.

`scripts/cpp-backup/extension/`: source of the installed local VS Code extension. Git, Node.js, PowerShell and the local Gitleaks executable are required. Machine-specific tool paths are kept in ignored `.cpp-backup/config.json`.

