$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiPython = Get-ApiPython
$apiRoot = Join-Path $repoRoot "apps\api"
$pytestTemp = Join-Path $repoRoot ".cache\pytest"
New-Item -ItemType Directory -Force -Path $pytestTemp | Out-Null

Invoke-LoggedCommand "Backend pytest" {
    Push-Location $apiRoot
    try {
        & $apiPython -m pytest --basetemp $pytestTemp -o cache_dir="$pytestTemp\.pytest_cache"
    }
    finally {
        Pop-Location
    }
}
