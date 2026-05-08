param(
  [string]$InputFile = "Manual/USER_MANUAL.md",
  [string]$OutputFile = "Manual/USER_MANUAL.pdf"
)

$ErrorActionPreference = "Stop"

$inputPath = Resolve-Path $InputFile
$inputFull = $inputPath.Path
$inputDirectory = Split-Path -Path $inputFull -Parent
$inputLeaf = Split-Path -Path $inputFull -Leaf

$outputFull = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputFile))

$pandocExe = (Get-Command pandoc -ErrorAction SilentlyContinue)?.Source
if (-not $pandocExe) {
  $commonPandocPaths = @(
    "$env:ProgramFiles\\Pandoc\\pandoc.exe",
    "$env:LocalAppData\\Pandoc\\pandoc.exe"
  )
  $pandocExe = $commonPandocPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $pandocExe) {
  Write-Error "Pandoc is not installed (or not discoverable). Install with: winget install --id JohnMacFarlane.Pandoc -e"
}

$pdfEngineArgs = @()
if (Get-Command pdflatex -ErrorAction SilentlyContinue) {
  $pdfEngineArgs = @("--pdf-engine=pdflatex")
} elseif (Get-Command wkhtmltopdf -ErrorAction SilentlyContinue) {
  $pdfEngineArgs = @("--pdf-engine=wkhtmltopdf")
} else {
  $wkhtmltopdfExe = "$env:ProgramFiles\\wkhtmltopdf\\bin\\wkhtmltopdf.exe"
  if (Test-Path $wkhtmltopdfExe) {
    $pdfEngineArgs = @("--pdf-engine=$wkhtmltopdfExe")
  } else {
    Write-Error "No PDF engine found. Install one of these: MiKTeX (for pdflatex) or wkhtmltopdf."
  }
}

Write-Host "Building PDF with TOC from $InputFile -> $OutputFile"

Push-Location $inputDirectory
try {
    & $pandocExe $inputLeaf `
      --from=gfm+smart `
      --toc `
      --toc-depth=3 `
      --number-sections `
      --standalone `
      --metadata=title:"CrewmateA350 User Manual" `
      @pdfEngineArgs `
      --output=$outputFull
} finally {
    Pop-Location
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Pandoc failed with exit code $LASTEXITCODE"
}

Write-Host "Done: $OutputFile"
