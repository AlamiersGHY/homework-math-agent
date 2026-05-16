$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$webRoot = Join-Path $repoRoot "apps\web"

& (Join-Path $PSScriptRoot "test.ps1")
& (Join-Path $PSScriptRoot "eval.ps1")

$nodeRoot = Add-NodeToPath
Write-Host ""
Write-Host "Using Node from $nodeRoot"

Invoke-LoggedCommand "Frontend typecheck" {
    Push-Location $webRoot
    try {
        Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
        & npm.cmd run typecheck
    }
    finally {
        Pop-Location
    }
}

Invoke-LoggedCommand "Frontend math rendering normalization tests" {
    Push-Location $webRoot
    try {
        & npm.cmd run test:math
    }
    finally {
        Pop-Location
    }
}

Invoke-LoggedCommand "Frontend build" {
    Push-Location $webRoot
    try {
        & npm.cmd run build
    }
    finally {
        Pop-Location
    }
}
