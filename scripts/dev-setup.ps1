param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Continue"

Write-Host "Pitch-Shifter Demo - Dev Setup (Windows)" 
Write-Host "CheckOnly: $CheckOnly"
Write-Host ""

function Test-Command {
  param([string]$Name)
  return Get-Command $Name -ErrorAction SilentlyContinue
}

function Invoke-Verify {
  param(
    [string]$Command,
    [string[]]$Args,
    [int]$TimeoutSeconds = 5
  )
  if ($CheckOnly) {
    return $null
  }
  try {
    $job = Start-Job -ScriptBlock {
      param($Cmd, $CmdArgs)
      & $Cmd @CmdArgs 2>$null
    } -ArgumentList $Command, (,$Args)
    $completed = Wait-Job $job -Timeout $TimeoutSeconds
    if ($completed) {
      $output = Receive-Job $job
      Remove-Job $job -Force
      if ($output) {
        return ($output | Select-Object -First 1)
      }
    } else {
      Stop-Job $job -ErrorAction SilentlyContinue
      Remove-Job $job -Force
    }
  } catch {
    if ($job) { Remove-Job $job -Force -ErrorAction SilentlyContinue }
    return $null
  }
  return $null
}

function Install-WingetPackage {
  param(
    [string]$Id,
    [string]$Name
  )
  if ($CheckOnly) {
    Write-Host "[SKIP] $Name (check-only mode)"
    return
  }
  Write-Host "[INSTALL] $Name via winget..."
  winget install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements
}

$winget = Test-Command "winget"
if (-not $winget) {
  Write-Warning "winget not found. Install App Installer from Microsoft Store or install dependencies manually."
}

$dependencies = @(
  @{ Name = "Git"; Command = "git"; VerifyArgs = @("--version"); WingetId = "Git.Git" },
  @{ Name = "Node.js (LTS)"; Command = "node"; VerifyArgs = @("--version"); WingetId = "OpenJS.NodeJS.LTS" },
  @{ Name = "npm"; Command = "npm"; VerifyArgs = @("--version"); WingetId = "" },
  @{ Name = ".NET SDK (8.x)"; Command = "dotnet"; VerifyArgs = @("--version"); WingetId = "Microsoft.DotNet.SDK.8" }
)

foreach ($dep in $dependencies) {
  $cmd = Test-Command $dep.Command
  if ($cmd) {
    $version = Invoke-Verify -Command $dep.Command -Args $dep.VerifyArgs
    if ($version) {
      Write-Host "[OK] $($dep.Name) ($version)"
    } else {
      Write-Host "[OK] $($dep.Name)"
    }
    continue
  }

  Write-Host "[MISSING] $($dep.Name)"
  if ($dep.WingetId -and $winget) {
    Install-WingetPackage -Id $dep.WingetId -Name $dep.Name
    $cmdAfter = Test-Command $dep.Command
    if ($cmdAfter) {
      $versionAfter = Invoke-Verify -Command $dep.Command -Args $dep.VerifyArgs
      Write-Host "[OK] $($dep.Name) installed ($versionAfter)"
    } else {
      Write-Warning "$($dep.Name) install did not complete. Install manually and retry."
    }
  } else {
    Write-Warning "Install $($dep.Name) manually."
  }
}

Write-Host ""
Write-Host "Checking Angular CLI..."
$ngCmd = Test-Command "ng"
if ($ngCmd) {
  $ngVersion = Invoke-Verify -Command "ng" -Args @("version")
  if ($ngVersion) {
    Write-Host "[OK] Angular CLI ($ngVersion)"
  } else {
    Write-Host "[OK] Angular CLI"
  }
} else {
  Write-Host "[MISSING] Angular CLI"
  $npmCmd = Test-Command "npm"
  if ($npmCmd) {
    if ($CheckOnly) {
      Write-Host "[SKIP] Angular CLI install (check-only mode)"
    } else {
      Write-Host "[INSTALL] Angular CLI via npm..."
      npm install -g @angular/cli
    }
  } else {
    Write-Warning "npm not found. Install Node.js first."
  }
}

Write-Host ""
Write-Host "Done. Re-run this script after installing missing dependencies."
