# VoxForge - Windows Setup Script
# This script downloads and installs whisper.cpp binary and model for Windows

param(
    [string]$Model = "base",
    [switch]$BinaryOnly,
    [switch]$ModelOnly
)

$ErrorActionPreference = "Stop"

# Configuration
$WhisperVersion = "v1.7.4"
$WhisperRepo = "ggerganov/whisper.cpp"
$BinariesDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
$ModelsDir = Join-Path $PSScriptRoot "..\src-tauri\resources\models"

# Model URLs
$Models = @{
    "tiny" = @{
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
        Size = "75 MB"
    }
    "base" = @{
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
        Size = "142 MB"
    }
    "small" = @{
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
        Size = "466 MB"
    }
    "medium" = @{
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
        Size = "1.5 GB"
    }
    "large" = @{
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
        Size = "3.1 GB"
    }
}

function Write-Header {
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "VoxForge - Windows Setup" -ForegroundColor White
    Write-Host "=" * 60 -ForegroundColor Cyan
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Host "Created directory: $Path" -ForegroundColor Green
    }
}

function Download-File {
    param(
        [string]$Url,
        [string]$Destination
    )

    Write-Host "Downloading: $Url" -ForegroundColor Yellow

    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("User-Agent", "VoxForge-Setup")

    try {
        $webClient.DownloadFile($Url, $Destination)
        Write-Host "Download complete!" -ForegroundColor Green
    }
    finally {
        $webClient.Dispose()
    }
}

function Download-WhisperBinary {
    Write-Host "`nDownloading whisper.cpp binary for Windows x64..." -ForegroundColor Cyan

    Ensure-Directory $BinariesDir

    $targetPath = Join-Path $BinariesDir "whisper-x86_64-pc-windows-msvc.exe"

    # Check if already exists
    if (Test-Path $targetPath) {
        Write-Host "Whisper binary already exists: $targetPath" -ForegroundColor Green
        return
    }

    $downloadUrl = "https://github.com/$WhisperRepo/releases/download/$WhisperVersion/whisper-bin-x64.zip"
    $zipPath = Join-Path $BinariesDir "whisper-bin-x64.zip"

    try {
        Download-File -Url $downloadUrl -Destination $zipPath

        Write-Host "Extracting..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $BinariesDir -Force

        # Rename the binary
        $extractedBinary = Join-Path $BinariesDir "main.exe"
        if (Test-Path $extractedBinary) {
            Move-Item -Path $extractedBinary -Destination $targetPath -Force
            Write-Host "Renamed to: whisper-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
        }

        # Clean up
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

        # Remove other extracted files we don't need
        Get-ChildItem $BinariesDir -Filter "*.dll" | Remove-Item -Force -ErrorAction SilentlyContinue

        Write-Host "Whisper binary installed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to download whisper binary: $_" -ForegroundColor Red
        Write-Host "`nManual download instructions:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://github.com/$WhisperRepo/releases/tag/$WhisperVersion"
        Write-Host "2. Download: whisper-bin-x64.zip"
        Write-Host "3. Extract and rename 'main.exe' to 'whisper-x86_64-pc-windows-msvc.exe'"
        Write-Host "4. Place it in: $BinariesDir"
        exit 1
    }
}

function Download-Model {
    param([string]$ModelName)

    if (-not $Models.ContainsKey($ModelName)) {
        Write-Host "Unknown model: $ModelName" -ForegroundColor Red
        Write-Host "Available models: $($Models.Keys -join ', ')"
        return $false
    }

    $model = $Models[$ModelName]

    Ensure-Directory $ModelsDir

    $modelPath = Join-Path $ModelsDir "ggml-$ModelName.bin"

    # Check if already exists
    if (Test-Path $modelPath) {
        Write-Host "Model already exists: $modelPath" -ForegroundColor Green
        return $true
    }

    Write-Host "`nDownloading $ModelName model ($($model.Size))..." -ForegroundColor Cyan
    Write-Host "This may take a while..." -ForegroundColor Yellow

    try {
        Download-File -Url $model.Url -Destination $modelPath
        Write-Host "Model installed: $modelPath" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Failed to download model: $_" -ForegroundColor Red
        return $false
    }
}

# Main
Write-Header

Write-Host "`nConfiguration:" -ForegroundColor White
Write-Host "  Binaries: $BinariesDir"
Write-Host "  Models: $ModelsDir"
Write-Host "  Model: $Model"

if (-not $ModelOnly) {
    Download-WhisperBinary
}

if (-not $BinaryOnly) {
    Download-Model -ModelName $Model
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Make sure Ollama is installed and running"
Write-Host "2. Run 'npm run tauri:build' to build the application"
