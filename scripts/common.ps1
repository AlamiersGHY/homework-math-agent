$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-ApiPython {
    $repoRoot = Get-RepoRoot
    $pythonPath = Join-Path $repoRoot "apps\api\.venv\Scripts\python.exe"
    if (-not (Test-Path $pythonPath)) {
        throw "Backend virtualenv Python was not found at $pythonPath. Create it from apps/api/requirements-dev.txt first."
    }
    return $pythonPath
}

function Add-NodeToPath {
    $candidateRoots = @(
        (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"),
        (Join-Path $env:USERPROFILE "AppData\Local\Programs\nodejs"),
        "C:\Program Files\nodejs"
    )

    foreach ($root in $candidateRoots) {
        $nodePath = Join-Path $root "node.exe"
        if (Test-Path $nodePath) {
            $env:PATH = "$root;$env:PATH"
            return $root
        }
    }

    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        return (Split-Path $nodeCommand.Source)
    }

    throw "node.exe was not found. Install Node.js or make the Codex runtime node path available."
}

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Command
    )

    Write-Host ""
    Write-Host "==> $Label"
    $global:LASTEXITCODE = 0
    & $Command
    $exitCode = $global:LASTEXITCODE
    if ($null -ne $exitCode -and $exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode"
    }
}

function Wait-HttpOk {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Url,
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [int] $TimeoutSeconds = 45,
        [scriptblock] $FailureCheck
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = $null

    while ((Get-Date) -lt $deadline) {
        if ($FailureCheck) {
            & $FailureCheck
        }

        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return
            }
            $lastError = "HTTP $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }

        Start-Sleep -Milliseconds 750
    }

    throw "$Label did not become ready at $Url within $TimeoutSeconds seconds. Last error: $lastError"
}
