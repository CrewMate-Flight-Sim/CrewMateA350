# === CONFIGURATION ===
$voiceName = "en-US-ChristopherNeural"   # Jenny neural voice

$phrases = @{
    "go_ahead" = "Go ahead"
    "gpu_on"   = "GPU is connected"
    "gpu_off"  = "GPU is disconnected"
    "asu_on"   = "ASU is connected"
    "asu_off"  = "ASU is disconnected"
    "acu_on"   = "ACU is connected"
    "acu_off"  = "ACU is disconnected"
    "all_off"  = "All equipment has been disconnected"
}

# Derive folder name from voice: "en-US-JennyNeural" -> "Jenny"
$voiceShortName = ($voiceName -replace '^.*-([A-Za-z]+)Neural$', '$1')
$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\src-tauri\sounds\GE_$voiceShortName"))
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ffmpegExe = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

if (-not (Test-Path $ffmpegExe)) {
    Write-Error "FFmpeg not found at: $ffmpegExe"
    exit 1
}

$count = 0
$total = $phrases.Count

foreach ($file in $phrases.Keys) {
    $count++
    $text = $phrases[$file]
    $mp3Path = "$outDir\$file.mp3"
    $oggPath = "$outDir\$file.ogg"

    Write-Host "[$count/$total] Generating Ground Staff: $file"

    try {
        # Call the Python tool you installed via npm/pip
        # We use --rate=-5% to match your old prosody setting
        edge-tts --voice $voiceName --text "$text" --rate=-5% --write-media "$mp3Path"
        
        if (Test-Path $mp3Path) {
            # Apply your Radio Effects: Highpass/Lowpass + Crushing + Compression
            $ffmpegArgs = "-i `"$mp3Path`" -af `"highpass=f=400, lowpass=f=2500, acrusher=bits=8:mode=log, acompressor=threshold=-18dB:ratio=4, volume=3dB`" -c:a libvorbis -q:a 4 `"$oggPath`" -y -loglevel error"
            
            $process = Start-Process -FilePath $ffmpegExe -ArgumentList $ffmpegArgs -Wait -NoNewWindow -PassThru
            
            if ($process.ExitCode -eq 0) {
                Remove-Item $mp3Path -ErrorAction SilentlyContinue
                Write-Host "  [OK] $file (Radio effect applied)" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Error "Error processing $file : $_"
    }
}


Write-Host ""
Write-Host "✓ Completed! Audio files created in $outDir"