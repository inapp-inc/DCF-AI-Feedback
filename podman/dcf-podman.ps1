#Requires -Version 5.1
<#
.SYNOPSIS
  Reusable local Podman helper for Feedback Analytics.

.EXAMPLE
  .\dcf-podman.ps1 up
  .\dcf-podman.ps1 logs
  .\dcf-podman.ps1 down
  .\dcf-podman.ps1 reset
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("up", "down", "logs", "status", "reset", "rebuild", "build", "urls", "help")]
  [string]$Command = "help",

  [switch]$Follow,
  [switch]$NoBuild,
  [switch]$NoSmoke,
  [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$RepoRoot = Split-Path $Here -Parent
$EnvFile = Join-Path $Here ".env"
$EnvExample = Join-Path $Here ".env.example"
$ComposeFile = Join-Path $Here "compose.yml"
$DockerEnv = Join-Path $RepoRoot "docker\.env"

function Write-Step([string]$Message) {
  Write-Host "[podman] $Message"
}

function Get-DotEnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Default = ""
  )
  if (-not (Test-Path $Path)) { return $Default }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trim = $line.Trim()
    if ($trim -eq "" -or $trim.StartsWith("#") -or $trim -notmatch "=") { continue }
    $name, $value = $trim -split "=", 2
    if ($name.Trim() -eq $Key) { return $value.Trim() }
  }
  return $Default
}

function Assert-Podman {
  if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw "Podman is not on PATH. Install Podman Desktop from https://podman-desktop.io/ and reopen this terminal."
  }
}

function Get-ComposeInvocation {
  # On Windows, `podman compose` talks to the machine. Call Ensure-PodmanReady first.
  & podman compose version 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    return @{ Exe = "podman"; Prefix = @("compose") }
  }
  if (Get-Command podman-compose -ErrorAction SilentlyContinue) {
    return @{ Exe = "podman-compose"; Prefix = @() }
  }
  # Podman 4+ ships compose; the version check fails only when the machine is down.
  return @{ Exe = "podman"; Prefix = @("compose") }
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
  $compose = Get-ComposeInvocation
  $all = @()
  $all += $compose.Prefix
  $all += @("-f", $ComposeFile, "--env-file", $EnvFile)
  $all += $ComposeArgs
  Push-Location $Here
  try {
    & $compose.Exe @all
    if ($LASTEXITCODE -ne 0) {
      throw "Compose command failed: $($compose.Exe) $($all -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Ensure-PodmanReady {
  & podman info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { return }

  Write-Step "Podman engine is not ready. Starting the default machine..."
  & podman machine start
  if ($LASTEXITCODE -ne 0) {
    throw "Could not start the Podman machine. Open Podman Desktop, start the machine, then retry."
  }
}

function Ensure-EnvFile {
  if (Test-Path $EnvFile) {
    Write-Step "Using $EnvFile"
    return
  }
  if (Test-Path $DockerEnv) {
    Copy-Item -LiteralPath $DockerEnv -Destination $EnvFile
    Write-Step "Created podman/.env from docker/.env"
    return
  }
  if (-not (Test-Path $EnvExample)) {
    throw "Missing $EnvExample"
  }
  Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
  Write-Step "Created podman/.env from .env.example"
}

function Get-AppUrls {
  $port = Get-DotEnvValue $EnvFile "APP_HTTP_PORT" "4020"
  $base = (Get-DotEnvValue $EnvFile "APP_BASE_PATH" "/feedback").TrimEnd("/")
  if ($base -eq "") { $base = "/feedback" }
  return [pscustomobject]@{
    Port   = $port
    Base   = $base
    Ui     = "http://127.0.0.1:${port}${base}/"
    Health = "http://127.0.0.1:${port}${base}/v1/health"
    Portal = "http://127.0.0.1:${port}${base}/portal"
  }
}

function Show-Urls {
  $urls = Get-AppUrls
  Write-Host ""
  Write-Host "UI:          $($urls.Ui)"
  Write-Host "API health:  $($urls.Health)"
  Write-Host "Portal:      $($urls.Portal)"
  Write-Host ""
  Write-Host "Demo logins (password: demo): admin_demo, supervisor_demo, mr_demo"
}

function Assert-HfTokenNotice {
  $token = Get-DotEnvValue $EnvFile "HF_API_TOKEN"
  if (-not $token) { $token = Get-DotEnvValue $EnvFile "HUGGINGFACE_API_KEY" }
  if (-not $token) {
    Write-Host ""
    Write-Host "WARN: HF_API_TOKEN is empty in podman/.env. The UI still works; AI uses fallback heuristics."
    Write-Host "      Add a token from https://huggingface.co/settings/tokens and run: .\dcf-podman.ps1 up"
    Write-Host ""
  }
}

function Wait-Healthy {
  $urls = Get-AppUrls
  Write-Step "Waiting for $($urls.Health) (up to 180s)..."
  for ($i = 0; $i -lt 36; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $urls.Health -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
        Write-Step "Health check passed."
        return
      }
    }
    catch {
      Start-Sleep -Seconds 5
    }
  }
  throw "App did not become healthy. Check: .\dcf-podman.ps1 logs"
}

function Show-DesktopRunHints {
  Write-Host ""
  Write-Host "Image is on the Podman machine. Click-to-run in Podman Desktop:"
  Write-Host "  1. Images → dcf-feedback-app (tag latest) → Run / play button"
  Write-Host "  2. Container name:  dcf-feedback-app"
  Write-Host "  3. Port mapping:    Host 4020  →  Container 80"
  Write-Host "  4. Volume:          dcf-feedback-data  →  /app/backend/data"
  Write-Host "  5. Optional env:    HF_API_TOKEN=hf_..."
  Write-Host "  6. Start, then open http://127.0.0.1:4020/feedback/"
  Write-Host ""
  Write-Host "Or play the ready-made pod (ports + volume already set):"
  Write-Host "  Kubernetes → Play YAML → $Here\desktop-play.yaml"
  Write-Host ""
}

function Invoke-ImageBuild {
  param([switch]$ForceNoCache)
  Ensure-EnvFile
  $viteBase = Get-DotEnvValue $EnvFile "VITE_BASE_PATH" "/feedback/"
  $viteApi = Get-DotEnvValue $EnvFile "VITE_API_BASE_URL" "/feedback/v1"
  $dockerFile = Join-Path $RepoRoot "docker\Dockerfile.app"
  $buildArgs = @(
    "build",
    "-f", $dockerFile,
    "-t", "dcf-feedback-app:latest",
    "-t", "localhost/dcf-feedback-app:latest",
    "--build-arg", "VITE_BASE_PATH=$viteBase",
    "--build-arg", "VITE_API_BASE_URL=$viteApi"
  )
  if ($ForceNoCache -or $NoCache) {
    $buildArgs += "--no-cache"
  }
  $buildArgs += $RepoRoot
  Write-Step "Building dcf-feedback-app:latest for Podman Desktop (this can take several minutes the first time)"
  & podman @buildArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Image build failed. If the machine ran out of memory, raise RAM in Podman Desktop → Settings → Resources."
  }
  Write-Step "Tagged: dcf-feedback-app:latest  and  localhost/dcf-feedback-app:latest"
  & podman images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" dcf-feedback-app
}

function Show-Help {
  @"
Feedback Analytics — local Podman helper

Usage:
  .\dcf-podman.ps1 build         Build image only (then click-to-run in Desktop)
  .\dcf-podman.ps1 build -NoCache
  .\dcf-podman.ps1 up            Build (if needed) and start via Compose
  .\dcf-podman.ps1 up -NoBuild   Start without rebuilding
  .\dcf-podman.ps1 up -NoSmoke   Skip the health check
  .\dcf-podman.ps1 rebuild       Rebuild with --no-cache, then start
  .\dcf-podman.ps1 down          Stop and remove containers (keeps SQLite volume)
  .\dcf-podman.ps1 reset         Stop, delete the data volume, then start fresh
  .\dcf-podman.ps1 logs          Show recent logs
  .\dcf-podman.ps1 logs -Follow  Follow logs
  .\dcf-podman.ps1 status        Container / machine / image status
  .\dcf-podman.ps1 urls          Print local URLs

Click-to-run later:
  1. .\dcf-podman.ps1 build
  2. Podman Desktop → Images → dcf-feedback-app → Run
     Host port 4020 → container 80; volume /app/backend/data
"@ | Write-Host
}

switch ($Command) {
  "help" { Show-Help }
  "urls" {
    Ensure-EnvFile
    Show-Urls
  }
  "status" {
    Assert-Podman
    Ensure-PodmanReady
    Write-Step "podman version"
    & podman version
    Write-Host ""
    Write-Step "machine list"
    & podman machine list
    Write-Host ""
    Write-Step "images (dcf-feedback-app)"
    & podman images dcf-feedback-app
    Write-Host ""
    if (Test-Path $EnvFile) {
      Invoke-Compose @("ps")
    }
    else {
      Write-Step "No podman/.env yet — run .\dcf-podman.ps1 build  or  .\dcf-podman.ps1 up"
    }
  }
  "build" {
    Assert-Podman
    Ensure-PodmanReady
    Invoke-ImageBuild
    Assert-HfTokenNotice
    Show-DesktopRunHints
  }
  "logs" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    if ($Follow) { Invoke-Compose @("logs", "-f", "--tail", "200") }
    else { Invoke-Compose @("logs", "--tail", "200") }
  }
  "down" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Invoke-Compose @("down")
    Write-Step "Stopped. SQLite volume dcf-feedback-data was kept."
  }
  "up" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Assert-HfTokenNotice
    if (-not $NoBuild) { Invoke-ImageBuild }
    Invoke-Compose @("up", "-d")
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
  "rebuild" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Assert-HfTokenNotice
    Invoke-ImageBuild -ForceNoCache
    Invoke-Compose @("up", "-d")
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
  "reset" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Write-Step "Removing containers and the SQLite volume (demo data will be re-seeded on start)..."
    Invoke-Compose @("down", "-v")
    Invoke-ImageBuild
    Invoke-Compose @("up", "-d")
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
}
