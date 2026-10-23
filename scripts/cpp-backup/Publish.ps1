param([string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))
$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
$hash = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($ProjectRoot.ToLowerInvariant()))).Replace('-', '')
$mutex = New-Object Threading.Mutex($false, "Local\CppBackup_$key")
$held = $false
try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { Write-Output 'Another publisher is working; queued saves remain safe.'; exit 0 }
    $config = Get-Content -LiteralPath (Join-Path $ProjectRoot '.cpp-backup\config.json') -Raw | ConvertFrom-Json
    & $config.node (Join-Path $PSScriptRoot 'worker.js') $ProjectRoot
    exit $LASTEXITCODE
} finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    $hash.Dispose()
}
