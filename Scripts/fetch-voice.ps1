# Fetches the CrewMate-Voice engine pinned in voice.version and deploys it with this aircraft's grammar and phrases.
# Set CREWMATE_VOICE_DIST to a CrewMate-Voice dist/ folder to test an unreleased engine build instead.
# Runs from beforeDevCommand and beforeBuildCommand, so it must stay Windows PowerShell 5.1 compatible.

$ErrorActionPreference = "Stop"
# The progress bar makes Invoke-WebRequest many times slower on Windows PowerShell
$ProgressPreference = "SilentlyContinue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoUrl = "https://github.com/CrewMate-Flight-Sim/CrewMate-Voice"

$version = (Get-Content (Join-Path $root "voice.version") -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "[Voice] voice.version must be X.Y.Z, found '$version'"
}

# Engine asset name -> folder it is deployed to
$assets = [ordered]@{
    "copilot_speech-x86_64-pc-windows-msvc.exe" = "src-tauri\bin"
    "CrewMate-SpeechTrainer.exe"                = "src-tauri\Trainer"
}

function Read-Sums([string]$dir) {
    $sums = @{}
    foreach ($line in Get-Content (Join-Path $dir "SHA256SUMS")) {
        if ($line -match '^([0-9a-fA-F]{64})\s+\*?(.+)$') { $sums[$Matches[2].Trim()] = $Matches[1].ToLowerInvariant() }
    }
    return $sums
}

# Get-FileHash goes missing when Windows PowerShell inherits PowerShell 7's module path
function Get-Sha256([string]$path) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($path)
    try {
        return ([System.BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToLowerInvariant()
    } finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

# Throws unless every asset in $dir matches its SHA256SUMS line
function Assert-Verified([string]$dir, [string]$label) {
    $sums = Read-Sums $dir
    foreach ($name in $assets.Keys) {
        $file = Join-Path $dir $name
        if (-not $sums.ContainsKey($name)) { throw "[Voice] $label SHA256SUMS has no entry for $name" }
        if (-not (Test-Path $file)) { throw "[Voice] $label is missing $name" }
        $actual = Get-Sha256 $file
        if ($actual -ne $sums[$name]) {
            throw "[Voice] SHA256 mismatch for $name in $label (expected $($sums[$name]), got $actual). Delete $dir and run again."
        }
    }
}

function Copy-IfChanged([string]$from, [string]$toDir) {
    $to = Join-Path $toDir (Split-Path $from -Leaf)
    New-Item -ItemType Directory -Force -Path $toDir | Out-Null
    # Skipping identical files avoids touching an exe the running app has locked
    if ((Test-Path $to) -and ((Get-Sha256 $to) -eq (Get-Sha256 $from))) { return }
    Copy-Item $from $to -Force
    Write-Host "[Voice] Deployed $(Split-Path $from -Leaf) to $toDir"
}

if ($env:CREWMATE_VOICE_DIST) {
    $source = $env:CREWMATE_VOICE_DIST
    Write-Warning "[Voice] CREWMATE_VOICE_DIST is set: using the local engine build in $source, not v$version"
    Assert-Verified $source "local build"
} else {
    $source = Join-Path $root ".voice-cache\v$version"
    if (-not (Test-Path (Join-Path $source "SHA256SUMS"))) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        # Download next to the cache and move it in only once verified, so a failed run leaves nothing half-done
        $partial = "$source.partial"
        if (Test-Path $partial) { Remove-Item $partial -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $partial | Out-Null
        foreach ($name in @("SHA256SUMS") + @($assets.Keys)) {
            $url = "$repoUrl/releases/download/v$version/$name"
            Write-Host "[Voice] Downloading $url"
            try {
                Invoke-WebRequest -Uri $url -OutFile (Join-Path $partial $name) -UseBasicParsing
            } catch {
                Remove-Item $partial -Recurse -Force
                throw "[Voice] Could not download $name for engine v$version from $url. Check that voice.version names an existing CrewMate-Voice release. ($($_.Exception.Message))"
            }
        }
        Assert-Verified $partial "download of v$version"
        Move-Item $partial $source
    }
    Assert-Verified $source "cached v$version"
}

foreach ($name in $assets.Keys) {
    Copy-IfChanged (Join-Path $source $name) (Join-Path $root $assets[$name])
}
Copy-IfChanged (Join-Path $root "voice\grammar.xml") (Join-Path $root "src-tauri\bin")
Copy-IfChanged (Join-Path $root "voice\training_phrases.txt") (Join-Path $root "src-tauri\Trainer")

Write-Host "[Voice] Engine $(if ($env:CREWMATE_VOICE_DIST) { 'local build' } else { "v$version" }) ready"
