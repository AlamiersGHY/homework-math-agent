param(
    [switch] $SkipAudit,
    [switch] $StrictAudit,
    [switch] $SkipBrowserQA,
    [switch] $LiveLLM
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$webRoot = Join-Path $repoRoot "apps\web"
$apiPython = Get-ApiPython

& (Join-Path $PSScriptRoot "check.ps1")

$env:PYTHONPATH = (Join-Path $repoRoot "apps\api\src")
Invoke-LoggedCommand "Mock API smoke" {
    & $apiPython (Join-Path $repoRoot "scripts\smoke_api.py")
}

if (-not $SkipBrowserQA) {
    & (Join-Path $PSScriptRoot "browser-qa.ps1")
}

if ($LiveLLM) {
    $env:PYTHONPATH = (Join-Path $repoRoot "apps\api\src")
    Invoke-LoggedCommand "Live LLM smoke" {
        & $apiPython (Join-Path $repoRoot "scripts\smoke_live_llm.py")
    }
}

if (-not $SkipAudit) {
    Add-NodeToPath | Out-Null
    Invoke-LoggedCommand "Frontend dependency audit advisory" {
        Push-Location $webRoot
        try {
            & npm.cmd audit --omit=dev
            $auditExit = $LASTEXITCODE
            if ($auditExit -ne 0) {
                if ($StrictAudit) {
                    throw "npm audit --omit=dev reported findings."
                }
                Write-Warning "npm audit --omit=dev reported findings. This is recorded as TD-005 and is advisory for the local MVP demo unless -StrictAudit is used."
                $global:LASTEXITCODE = 0
            }
        }
        finally {
            Pop-Location
        }
    }
}

Write-Host ""
Write-Host "Release check completed. Live OCR still requires Doubao credentials for provider smoke."
Write-Host "Pass -LiveLLM to include the real OpenAI-compatible LLM smoke when local credentials are configured."
