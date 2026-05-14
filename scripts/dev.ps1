param(
    [int] $ApiPort = 8000,
    [int] $WebPort = 3000
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiRoot = Join-Path $repoRoot "apps\api"
$webRoot = Join-Path $repoRoot "apps\web"
$apiPython = Get-ApiPython
Add-NodeToPath | Out-Null

Write-Host "Starting Math Agent dev stack"
Write-Host "API: http://127.0.0.1:$ApiPort"
Write-Host "Web: http://127.0.0.1:$WebPort"

$apiJob = Start-Job -Name "MathAgentApi" -ScriptBlock {
    param($Root, $Python, $Port)
    Set-Location $Root
    $env:PYTHONPATH = "src"
    & $Python -m uvicorn math_agent_api.main:app --host 127.0.0.1 --port $Port
} -ArgumentList $apiRoot, $apiPython, $ApiPort

try {
    Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/health" -Label "Math Agent API" -TimeoutSeconds 45 -FailureCheck {
        if ($apiJob.State -ne "Running") {
            Receive-Job $apiJob -ErrorAction SilentlyContinue | Out-Host
            throw "Math Agent API exited before becoming ready."
        }
    }

    Push-Location $webRoot
    try {
        $env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$ApiPort"
        & npm.cmd run dev -- --hostname 127.0.0.1 --port $WebPort
    }
    finally {
        Pop-Location
    }
}
finally {
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Receive-Job $apiJob -ErrorAction SilentlyContinue | Out-Host
    Remove-Job $apiJob -ErrorAction SilentlyContinue
}
