$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiPython = Get-ApiPython
$apiRoot = Join-Path $repoRoot "apps\api"

Invoke-LoggedCommand "Backend pytest" {
    Push-Location $apiRoot
    try {
        & $apiPython -m pytest
    }
    finally {
        Pop-Location
    }
}
