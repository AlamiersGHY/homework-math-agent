$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiPython = Get-ApiPython
$apiRoot = Join-Path $repoRoot "apps\api"
$pytestRoot = Join-Path ([System.IO.Path]::GetTempPath()) "math-agent-pytest"
$pytestTemp = Join-Path $pytestRoot ("run-{0}-{1}" -f $PID, (Get-Date -Format "yyyyMMddHHmmssfff"))
New-Item -ItemType Directory -Force -Path $pytestRoot | Out-Null

Invoke-LoggedCommand "Backend pytest" {
    Push-Location $apiRoot
    try {
        & $apiPython -m pytest --basetemp $pytestTemp -o cache_dir="$pytestTemp\.pytest_cache"
    }
    finally {
        Pop-Location
    }
}
