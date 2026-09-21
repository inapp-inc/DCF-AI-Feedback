#Requires -Version 5.1
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
$ContainerName = "dcf-feedback-app"
$ImageName = "localhost/dcf-feedback-app:latest"
$VolumeName = "dcf-feedback-data"

function Write-Step {
  param([string]$Message)
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

function Invoke-Podman {
  param(
    [switch]$Quiet,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$PodmanArgs
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($Quiet) {
      & podman @PodmanArgs 2>&1 | Out-Null
    }
    else {
      & podman @PodmanArgs | ForEach-Object { Write-Host $_ }
    }
    return $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $prev
  }
}

function Test-ComposeAvailable {
  $code = Invoke-Podman -Quiet @("compose", "version")
  if ($code -eq 0) { return $true }
  return [bool](Get-Command podman-compose -ErrorAction SilentlyContinue)
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
  if (-not (Test-ComposeAvailable)) {
    throw "Compose plugin is not installed. This helper uses 'podman run' instead; you do not need Compose."
  }
  $all = @("compose", "-f", $ComposeFile, "--env-file", $EnvFile) + $ComposeArgs
  Push-Location $Here
  try {
    $code = Invoke-Podman @all
    if ($code -ne 0) {
      throw "Compose command failed: podman $($all -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Start-AppContainer {
  $port = Get-DotEnvValue $EnvFile "APP_HTTP_PORT" "4020"
  Write-Step "Starting $ContainerName from $ImageName (podman run; Compose not required)"
  $null = Invoke-Podman -Quiet @("rm", "-f", $ContainerName)
  $code = Invoke-Podman @(
    "run", "-d",
    "--name", $ContainerName,
    "--replace",
    "-p", "${port}:80",
    "--env-file", $EnvFile,
    "-e", "NODE_ENV=production",
    "-e", "PORT=8080",
    "-v", "${VolumeName}:/app/backend/data",
    "--restart", "unless-stopped",
    $ImageName
  )
  if ($code -ne 0) {
    throw "podman run failed. Confirm the image exists: podman images $ImageName"
  }
}

function Stop-AppContainer {
  param([switch]$RemoveVolume)
  $null = Invoke-Podman -Quiet @("rm", "-f", $ContainerName)
  if ($RemoveVolume) {
    $null = Invoke-Podman -Quiet @("volume", "rm", "-f", $VolumeName)
    Write-Step "Removed volume $VolumeName"
  }
  else {
    Write-Step "Stopped $ContainerName. Volume $VolumeName was kept."
  }
}

function Show-AppLogs {
  param([switch]$FollowLogs)
  if ($FollowLogs) {
    $null = Invoke-Podman @("logs", "-f", "--tail", "200", $ContainerName)
  }
  else {
    $null = Invoke-Podman @("logs", "--tail", "200", $ContainerName)
  }
}

function Ensure-PodmanReady {
  $code = Invoke-Podman -Quiet @("info")
  if ($code -eq 0) { return }

  Write-Step "Podman engine is not ready. Starting the default machine..."
  $start = Invoke-Podman @("machine", "start")
  if ($start -ne 0) {
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
    Write-Host "      Add a token from https://huggingface.co/settings/tokens and run: .\dcf-podman.cmd up"
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
  throw "App did not become healthy. Check: .\dcf-podman.cmd logs"
}

function Show-DesktopRunHints {
  Write-Host ""
  Write-Host "Image is on the Podman machine. Click-to-run in Podman Desktop:"
  Write-Host "  1. Images -> dcf-feedback-app (tag latest) -> Run"
  Write-Host "  2. Container name:  dcf-feedback-app"
  Write-Host "  3. Port mapping:    Host 4020 -> Container 80"
  Write-Host "  4. Volume:          dcf-feedback-data -> /app/backend/data"
  Write-Host "  5. Optional env:    HF_API_TOKEN=hf_..."
  Write-Host "  6. Start, then open http://127.0.0.1:4020/feedback/"
  Write-Host ""
  Write-Host "Or play the ready-made pod (ports + volume already set):"
  Write-Host "  Kubernetes -> Play YAML -> $Here\desktop-play.yaml"
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
    throw "Image build failed. If the machine ran out of memory, raise RAM in Podman Desktop -> Settings -> Resources."
  }
  Write-Step "Tagged: dcf-feedback-app:latest  and  localhost/dcf-feedback-app:latest"
  & podman images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" dcf-feedback-app
}

function Show-Help {
  Write-Host "Feedback Analytics - local Podman helper"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  .\dcf-podman.cmd build         Build image only (then click-to-run in Desktop)"
  Write-Host "  .\dcf-podman.cmd build -NoCache"
  Write-Host "  .\dcf-podman.cmd up            Build (if needed) and start with podman run"
  Write-Host "  .\dcf-podman.cmd up -NoBuild   Start without rebuilding"
  Write-Host "  .\dcf-podman.cmd up -NoSmoke   Skip the health check"
  Write-Host "  .\dcf-podman.cmd rebuild       Rebuild with --no-cache, then start"
  Write-Host "  .\dcf-podman.cmd down          Stop and remove containers (keeps SQLite volume)"
  Write-Host "  .\dcf-podman.cmd reset         Stop, delete the data volume, then start fresh"
  Write-Host "  .\dcf-podman.cmd logs          Show recent logs"
  Write-Host "  .\dcf-podman.cmd logs -Follow  Follow logs"
  Write-Host "  .\dcf-podman.cmd status        Container / machine / image status"
  Write-Host "  .\dcf-podman.cmd urls          Print local URLs"
  Write-Host ""
  Write-Host "Click-to-run later:"
  Write-Host "  1. .\dcf-podman.cmd build"
  Write-Host "  2. Podman Desktop -> Images -> dcf-feedback-app -> Run"
  Write-Host "     Host port 4020 -> container 80; volume /app/backend/data"
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
    $null = Invoke-Podman @("images", $ImageName)
    Write-Host ""
    Write-Step "container $ContainerName"
    $null = Invoke-Podman @("ps", "-a", "--filter", "name=$ContainerName")
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
    if ($Follow) { Show-AppLogs -FollowLogs }
    else { Show-AppLogs }
  }
  "down" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Stop-AppContainer
  }
  "up" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Assert-HfTokenNotice
    if (-not $NoBuild) { Invoke-ImageBuild }
    Start-AppContainer
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
  "rebuild" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Assert-HfTokenNotice
    Invoke-ImageBuild -ForceNoCache
    Start-AppContainer
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
  "reset" {
    Assert-Podman
    Ensure-PodmanReady
    Ensure-EnvFile
    Write-Step "Removing containers and the SQLite volume (demo data will be re-seeded on start)..."
    Stop-AppContainer -RemoveVolume
    Invoke-ImageBuild
    Start-AppContainer
    if (-not $NoSmoke) { Wait-Healthy }
    Show-Urls
  }
}
