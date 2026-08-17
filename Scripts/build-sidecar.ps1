# Build and deploy CopilotSpeechNew sidecar (Windows SAPI engine)

Write-Host "Building CopilotSpeechNew sidecar..." -ForegroundColor Cyan

# Locate the project dynamically by searching for its .csproj,
# starting from the script's own directory and walking upward.
function Find-ProjectDir {
    param(
        [string]$StartPath,
        [string]$ProjectFolderName = "CopilotSpeechNew"
    )

    $current = Get-Item $StartPath

    while ($null -ne $current) {
        $candidate = Join-Path $current.FullName $ProjectFolderName
        if (Test-Path $candidate) {
            $csproj = Get-ChildItem -Path $candidate -Filter "*.csproj" -ErrorAction SilentlyContinue
            if ($csproj) {
                return $candidate
            }
        }
        $current = $current.Parent
    }

    return $null
}

$projectDir = Find-ProjectDir -StartPath $PSScriptRoot

if (-not $projectDir) {
    Write-Host "Could not locate CopilotSpeechNew project directory (searched upward from $PSScriptRoot)" -ForegroundColor Red
    exit 1
}

Write-Host "Found project at: $projectDir" -ForegroundColor DarkGray

$repoRoot = Split-Path -Parent $projectDir

Set-Location $projectDir

# Build project
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

Set-Location $repoRoot

# Create the bin directory if it doesn't exist
$binDir = Join-Path $repoRoot "src-tauri\bin"
if (!(Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

$publishDir = Join-Path $projectDir "bin\Release\net8.0-windows\win-x64\publish"

# Copy executable
Write-Host "Copying .exe..." -ForegroundColor Yellow
Copy-Item "$publishDir\CopilotSpeech.exe" `
    "$binDir\copilot_speech-x86_64-pc-windows-msvc.exe" -Force
Write-Host "✓ Copied copilot_speech-x86_64-pc-windows-msvc.exe" -ForegroundColor Green

# Copy grammar file (required at runtime next to the exe)
Write-Host "Copying grammar.xml..." -ForegroundColor Yellow
$grammarPublishPath = Join-Path $publishDir "grammar.xml"
$grammarProjectPath = Join-Path $projectDir "grammar.xml"
$grammarLegacyPath = Join-Path $projectDir "bin\Release\net8.0\grammar.xml"
$grammarFound = $null

if (Test-Path $grammarPublishPath) {
    $grammarFound = $grammarPublishPath
}
elseif (Test-Path $grammarProjectPath) {
    $grammarFound = $grammarProjectPath
}
elseif (Test-Path $grammarLegacyPath) {
    $grammarFound = $grammarLegacyPath
}

if ($grammarFound) {
    Copy-Item $grammarFound "$binDir\grammar.xml" -Force
    Write-Host "✓ Copied grammar.xml from $grammarFound" -ForegroundColor Green
}
else {
    Write-Host "✗ Warning: grammar.xml not found in publish or project paths" -ForegroundColor Yellow
}

Write-Host "`nSidecar build complete!" -ForegroundColor Green
Write-Host "Files are ready in: $binDir" -ForegroundColor Cyan