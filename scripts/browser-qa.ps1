param(
    [int] $ApiPort = 8011,
    [int] $WebPort = 3011,
    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\common.ps1"

$repoRoot = Get-RepoRoot
$apiRoot = Join-Path $repoRoot "apps\api"
$webRoot = Join-Path $repoRoot "apps\web"
$apiPython = Get-ApiPython
$nodeRoot = Add-NodeToPath
$cacheRoot = Join-Path $repoRoot ".cache\qa"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path $cacheRoot $timestamp
$apiLog = Join-Path $runRoot "api.out.log"
$apiErr = Join-Path $runRoot "api.err.log"
$webLog = Join-Path $runRoot "web.out.log"
$webErr = Join-Path $runRoot "web.err.log"
$databaseFile = Join-Path $runRoot "browser-qa.db"
$databaseUrl = "sqlite:///$($databaseFile -replace '\\', '/')"

$envNames = @(
    "PYTHONPATH",
    "DATABASE_URL",
    "LLM_PROVIDER",
    "OCR_PROVIDER",
    "LLM_MOCK_FALLBACK",
    "OCR_MOCK_FALLBACK",
    "NEXT_PUBLIC_API_BASE_URL"
)
$previousEnv = @{}
foreach ($name in $envNames) {
    $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

$apiProcess = $null
$webProcess = $null

function Assert-PortsFree {
    param(
        [Parameter(Mandatory = $true)]
        [int[]] $Ports
    )

    $connections = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" }
    if ($connections) {
        $summary = ($connections | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize | Out-String).Trim()
        throw "Browser QA ports are already in use: $summary"
    }
}

function Assert-PortsReleased {
    param(
        [Parameter(Mandatory = $true)]
        [int[]] $Ports
    )

    $deadline = (Get-Date).AddSeconds(12)
    $remaining = $null
    do {
        $remaining = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
            Where-Object { $_.State -eq "Listen" }
        if (-not $remaining) {
            return
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    if ($remaining) {
        $summary = ($remaining | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize | Out-String).Trim()
        throw "Browser QA left local ports in use after cleanup wait: $summary"
    }
}

New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

$nextBin = Join-Path $webRoot "node_modules\next\dist\bin\next"
$nodeStartScript = Join-Path $runRoot "start-web.cjs"

try {
    Assert-PortsFree -Ports @($ApiPort, $WebPort)

    if (-not $SkipBuild) {
        Invoke-LoggedCommand "Frontend build for browser QA" {
            Push-Location $webRoot
            try {
                $env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$ApiPort"
                & npm.cmd run build
            }
            finally {
                Pop-Location
            }
        }
    }

    @"
process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$ApiPort";
process.argv = ["node", "$($nextBin -replace '\\', '\\\\')", "start", "--hostname", "127.0.0.1", "--port", "$WebPort"];
require("$($nextBin -replace '\\', '\\\\')");
"@ | Set-Content -Path $nodeStartScript -Encoding UTF8

    $env:PYTHONPATH = "src"
    $env:DATABASE_URL = $databaseUrl
    $env:LLM_PROVIDER = "mock"
    $env:OCR_PROVIDER = "mock"
    $env:LLM_MOCK_FALLBACK = "true"
    $env:OCR_MOCK_FALLBACK = "true"

    $apiProcess = Start-Process -FilePath $apiPython `
        -ArgumentList @("-m", "uvicorn", "math_agent_api.main:app", "--host", "127.0.0.1", "--port", $ApiPort) `
        -WorkingDirectory $apiRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $apiLog `
        -RedirectStandardError $apiErr `
        -PassThru

    Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/health" -Label "Browser QA API" -TimeoutSeconds 45 -FailureCheck {
        if ($apiProcess.HasExited) {
            throw "Browser QA API exited before becoming ready. See $apiErr"
        }
    }

    $webProcess = Start-Process -FilePath "node.exe" `
        -ArgumentList "`"$nodeStartScript`"" `
        -WorkingDirectory $webRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $webLog `
        -RedirectStandardError $webErr `
        -PassThru

    Wait-HttpOk -Url "http://127.0.0.1:$WebPort" -Label "Browser QA web app" -TimeoutSeconds 60 -FailureCheck {
        if ($webProcess.HasExited) {
            throw "Browser QA web app exited before becoming ready. See $webErr"
        }
    }

    Invoke-LoggedCommand "Browser QA desktop/mobile" {
        Push-Location $repoRoot
        try {
            & node.exe (Join-Path $repoRoot "scripts\browser_qa.cjs") `
                --url "http://127.0.0.1:$WebPort" `
                --api-url "http://127.0.0.1:$ApiPort" `
                --screenshots $runRoot
        }
        finally {
            Pop-Location
        }
    }
}
finally {
    if ($webProcess -and -not $webProcess.HasExited) {
        Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    }
    foreach ($name in $envNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], "Process")
    }
    Assert-PortsReleased -Ports @($ApiPort, $WebPort)
}
