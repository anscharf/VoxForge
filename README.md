# VoxForge

Eine plattformübergreifende Desktop-Anwendung für Sprachaufnahme, Transkription und KI-gestützte Textanreicherung.

**Technologie-Stack:** Next.js + Tauri 2 + Whisper.cpp + Ollama

## Features

- **Sprachaufnahme** - Hochwertige Audioaufnahme mit Echtzeit-Visualisierung
- **Lokale Transkription** - Offline Sprache-zu-Text mit Whisper.cpp
- **KI-Anreicherung** - Transkriptionen mit lokalen LLMs über Ollama oder OpenAI transformieren
- **Mehrere Modi** - E-Mail, Technischer Bericht, Besprechungsprotokoll, Stichpunkte, Benutzerdefiniert
- **Export-Optionen** - Als PDF oder DOCX speichern
- **Globaler Hotkey** - Aufnahme starten/stoppen mit Cmd/Ctrl+Shift+R
- **System Tray** - Läuft im Hintergrund, immer erreichbar

## Schnellstart

### 1. Whisper herunterladen (erforderlich)

```bash
# Whisper-Binary und Base-Modell automatisch herunterladen
npm run setup:whisper

# Oder nur die Binary (ohne Modell)
npm run setup:whisper:binary

# Oder mit einem anderen Modell (tiny, base, small, medium, large)
node scripts/download-whisper.js small
```

**Windows PowerShell Alternative:**
```powershell
.\scripts\setup-windows.ps1
# Oder mit anderem Modell:
.\scripts\setup-windows.ps1 -Model small
```

### 2. Ollama installieren (erforderlich für KI-Anreicherung)

Die App benötigt Ollama für die KI-Anreicherung:

**macOS:**
```bash
# Ollama herunterladen und installieren
brew install ollama
# Oder von https://ollama.com herunterladen

# LLM-Modell herunterladen (~2 GB)
ollama pull llama3.2
```

**Windows:**
1. Ollama von https://ollama.com/download/windows herunterladen
2. Installieren und starten
3. PowerShell öffnen und ausführen:
   ```powershell
   ollama pull llama3.2
   ```

### 3. App starten

```bash
# Entwicklungsmodus
npm run tauri:dev

# Produktions-Build erstellen
npm run tauri:build
```

## Download & Installation

### Fertige App herunterladen

| Plattform | Datei | Inhalt |
|-----------|-------|--------|
| macOS (Apple Silicon) | `VoxForge_1.0.0_aarch64.dmg` | macOS Installer |
| Windows (x64) | `VoxForge_1.0.0_x64-setup.exe` | Windows Installer |

**Im Paket enthalten:**
- VoxForge App
- Whisper-Binary (lokale Spracherkennung)
- Whisper Base-Modell (142 MB)

**Separat erforderlich:**
- Ollama (für KI-Anreicherung)

### Installation auf macOS

1. **DMG öffnen**
2. **"VoxForge.app"** in den Applications-Ordner ziehen
3. **Beim ersten Start:** Rechtsklick auf die App → "Öffnen" wählen (wegen macOS Gatekeeper)

### Installation auf Windows

1. **Setup-Datei ausführen** (`VoxForge_1.0.0_x64-setup.exe`)
2. Installation durchführen
3. **Ollama installieren** (siehe Schnellstart)

## Benutzung

### Aufnahme

1. Klicke auf den Mikrofon-Button oder drücke **Cmd/Ctrl+Shift+R**
2. Sprich in dein Mikrofon
3. Klicke auf Stopp oder drücke den Hotkey erneut

### Transkription

- Die Transkription startet automatisch nach Beenden der Aufnahme
- Der transkribierte Text kann bei Bedarf bearbeitet werden

### Anreicherung

1. Wähle einen Anreicherungsmodus:
   - **E-Mail** - Formatiert als professionelle E-Mail
   - **Technischer Bericht** - Strukturiert mit Abschnitten
   - **Besprechungsprotokoll** - Chronologisch mit Aktionspunkten
   - **Stichpunkte** - Prägnante Kernpunkte
   - **Benutzerdefiniert** - Eigenen Prompt verwenden

2. Klicke auf "Text anreichern" zur Verarbeitung

### Export

- **Kopieren** - In die Zwischenablage kopieren
- **PDF** - Als PDF-Dokument exportieren
- **DOCX** - Als Word-Dokument exportieren

## Einstellungen

Zugriff über das Zahnrad-Symbol:

### Transkription
- **Anbieter** - Lokal (Whisper) oder OpenAI
- **Whisper Modell** - Modellgröße wählen (tiny, base, small, medium)
- **Sprache** - Transkriptionssprache (de/en/auto)

### KI-Anreicherung
- **Anbieter** - Ollama (lokal) oder OpenAI
- **Ollama Modell** - LLM für Anreicherung wählen
- **Ollama URL** - Standard: http://localhost:11434 (Windows: http://127.0.0.1:11434)

### OpenAI (Optional)
- **API-Key** - OpenAI API-Schlüssel eingeben
- **Modell** - OpenAI Modell wählen (gpt-4o-mini, gpt-4o, etc.)

## Systemanforderungen

- **macOS** 12.0 oder neuer (Apple Silicon / Intel)
- **Windows** 10/11 (x64)
- **Speicherplatz** ~500 MB für die App + ~2 GB für das LLM-Modell
- **RAM** Mindestens 8 GB empfohlen
- **Mikrofon** Integriert oder extern

## Windows Build-Anleitung

Um die App unter Windows selbst zu bauen:

### 1. Voraussetzungen installieren

- **Node.js** - https://nodejs.org (LTS Version)
- **Rust** - https://rustup.rs (Standard-Installation)
- **Visual Studio Build Tools** - https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Bei der Installation "Desktop development with C++" auswählen

### 2. Whisper Setup

```powershell
# Automatisch (empfohlen)
.\scripts\setup-windows.ps1

# Oder manuell:
# 1. https://github.com/ggerganov/whisper.cpp/releases
# 2. whisper-bin-x64.zip herunterladen
# 3. main.exe nach src-tauri/binaries/ kopieren
# 4. Umbenennen zu: whisper-x86_64-pc-windows-msvc.exe
```

### 3. Projekt bauen

```powershell
cd voxforge
npm install
npm run tauri:build
```

Die fertige Installationsdatei findest du unter:
- `src-tauri/target/release/bundle/msi/VoxForge_1.0.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/VoxForge_1.0.0_x64-setup.exe`

## Fehlerbehebung

### Ollama wird nicht erkannt

**macOS:**
1. Prüfe ob Ollama in der Menüleiste läuft
2. Starte Ollama manuell über die App

**Windows:**
1. Prüfe ob Ollama in der Taskleiste läuft (Lama-Icon)
2. Starte Ollama über das Startmenü
3. Prüfe Windows-Firewall: Port 11434 muss für "Ollama" erlaubt sein
4. Teste manuell: `curl http://127.0.0.1:11434/api/tags`

### Transkription schlägt fehl

1. **Whisper-Binary fehlt:**
   ```bash
   npm run setup:whisper
   ```

2. **Modell fehlt:**
   - Prüfe ob `src-tauri/resources/models/ggml-base.bin` existiert
   - Falls nicht: `npm run setup:whisper:model`

3. **Audio-Probleme:**
   - Prüfe Mikrofon-Berechtigung
   - Stelle sicher, dass keine andere App das Mikrofon verwendet

### Kein Audio-Input

1. Gewähre Mikrofon-Berechtigung wenn angefragt
2. Prüfe die System-Audioeinstellungen
3. Stelle sicher, dass keine andere App das Mikrofon verwendet

### OpenAI funktioniert nicht

1. Prüfe ob der API-Key korrekt eingegeben wurde
2. Stelle sicher, dass der API-Key gültig ist und Guthaben vorhanden ist
3. Der Status sollte "OpenAI bereit" anzeigen

## Entwicklung

### Voraussetzungen

- Node.js 18+
- Rust (für Tauri)
- Cargo

### Setup

```bash
# Repository klonen
git clone <repository-url>
cd voxforge

# Abhängigkeiten installieren
npm install

# Whisper herunterladen
npm run setup:whisper

# Entwicklungsmodus starten
npm run tauri:dev

# Produktions-Build erstellen
npm run tauri:build
```

### Projektstruktur

```
voxforge/
├── src/                    # Next.js Frontend
│   ├── app/               # App Router Seiten
│   ├── components/        # React Komponenten
│   ├── hooks/             # Custom Hooks
│   └── stores/            # Zustand State
├── src-tauri/             # Tauri Backend
│   ├── src/               # Rust Quellcode
│   │   ├── audio.rs       # Audioaufnahme
│   │   ├── whisper.rs     # Transkription
│   │   ├── ollama.rs      # LLM Client
│   │   ├── openai.rs      # OpenAI Client
│   │   └── commands/      # Tauri Commands
│   ├── binaries/          # Whisper Binary (plattformspezifisch)
│   └── resources/models/  # Whisper Modelle
├── scripts/               # Setup-Scripts
│   ├── download-whisper.js    # Node.js Setup-Script
│   └── setup-windows.ps1      # PowerShell Setup-Script
└── package.json
```

### Verfügbare Scripts

```bash
npm run dev              # Next.js Entwicklungsserver
npm run build            # Next.js Build
npm run tauri:dev        # Tauri + Next.js Entwicklung
npm run tauri:build      # Produktions-Build

# Whisper Setup
npm run setup:whisper           # Binary + Base-Modell
npm run setup:whisper:binary    # Nur Binary
npm run setup:whisper:model     # Nur Base-Modell
```

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Desktop | Tauri 2.x |
| Audio | cpal (Rust) |
| Transkription | Whisper.cpp / OpenAI Whisper API |
| LLM | Ollama / OpenAI GPT |
| State | Zustand |
| Export | jsPDF, docx |

## Architektur-Entscheidungen

### Warum Tauri statt Electron?
- **Kleinere Bundle-Größe** (~16 MB vs ~200+ MB)
- **Bessere Performance** durch Rust-Backend
- **Höhere Sicherheit** durch Capability-basierte Permissions
- **Geringerer Speicherverbrauch**

### Warum lokale Whisper-Transkription?
- **Datenschutz** - Audio verlässt nie den Computer
- **Offline-fähig** - Keine Internetverbindung erforderlich
- **Keine API-Kosten** - Kostenlose Nutzung

### Warum Ollama für LLM?
- **Lokale Ausführung** - Kein Cloud-Dienst erforderlich
- **Datenschutz** - Texte bleiben lokal
- **Flexibilität** - Verschiedene Modelle wählbar

## Lizenz

MIT
