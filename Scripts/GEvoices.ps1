# This script uses Azure Cognitive Services for high-quality TTS
# You'll need a free Azure account: https://azure.microsoft.com/free/

# === LOAD .env ===
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+)\s*$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}
else {
    Write-Error ".env file not found at: $envFile (copy .env.example and fill in your values)"
    exit 1
}

# === CONFIGURATION ===
$azureKey = $env:AZURE_TTS_KEY
$azureRegion = $env:AZURE_TTS_REGION
$voiceName = "en-US-DavisNeural"   # Jenny neural voice

# Other voices:
# "en-US-AriaNeural"  - Female, friendly
# "en-US-GuyNeural"   - Male, professional
# "en-US-DavisNeural" - Male, authoritative
# "en-US-JennyNeural"  - Female, clear

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
if ([string]::IsNullOrWhiteSpace($voiceShortName) -or $voiceShortName -eq $voiceName) {
    $voiceShortName = $voiceName  # fallback to full name
}
$outDir = Join-Path $PSScriptRoot "..\src-tauri\sounds\GE_$voiceShortName"
$outDir = [System.IO.Path]::GetFullPath($outDir)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ffmpegExe = "C:\Users\extra\Downloads\Wwise-Unpacker-master\Tools\ffmpeg.exe"

if (-not (Test-Path $ffmpegExe)) {
    Write-Error "FFmpeg not found at: $ffmpegExe"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($azureKey) -or $azureKey -eq "your_azure_tts_key_here") {
    Write-Error "Please set AZURE_TTS_KEY in PSscripts/.env"
    Write-Host ""
    Write-Host "To get a free Azure key:"
    Write-Host "1. Go to https://azure.microsoft.com/free/"
    Write-Host "2. Create a free account"
    Write-Host "3. Create a Speech Service resource"
    Write-Host "4. Copy the key and region"
    exit 1
}

$count = 0
$total = $phrases.Count

Write-Host "Using Azure TTS with voice: $voiceName"
Write-Host ""

foreach ($file in $phrases.Keys) {
    $count++
    $text = $phrases[$file]
    $mp3Path = "$outDir\$file.mp3"
    $oggPath = "$outDir\$file.ogg"

    Write-Host "[$count/$total] Processing: $file"

    try {
        # Build SSML
        $ssml = @"
<speak version='1.0' xml:lang='en-US'>
    <voice name='$voiceName'>
        <prosody rate='-5%' pitch='+0%'>
            $text
        </prosody>
    </voice>
</speak>
"@

        # Call Azure TTS API
        $headers = @{
            "Ocp-Apim-Subscription-Key" = $azureKey
            "Content-Type"              = "application/ssml+xml"
            "X-Microsoft-OutputFormat"  = "audio-16khz-128kbitrate-mono-mp3"
        }

        $uri = "https://$azureRegion.tts.speech.microsoft.com/cognitiveservices/v1"
        
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $ssml -OutFile $mp3Path
        
        # Convert to OGG
        $ffmpegArgs = "-i `"$mp3Path`" -af `"highpass=f=400, lowpass=f=2500, acrusher=bits=8:mode=log, acompressor=threshold=-18dB:ratio=4, volume=3dB`" -c:a libvorbis -q:a 4 `"$oggPath`" -y"
        $process = Start-Process -FilePath $ffmpegExe -ArgumentList $ffmpegArgs -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            Remove-Item $mp3Path -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Error "Error processing $file : $_"
    }
}

Write-Host ""
Write-Host "✓ Completed! Audio files created in $outDir"