$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiPython = Get-ApiPython
$env:PYTHONPATH = (Join-Path $repoRoot "apps\api\src")

Invoke-LoggedCommand "Behavior evals" {
    & $apiPython (Join-Path $repoRoot "scripts\run_evals.py")
}
