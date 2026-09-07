# Next Piano 2.0

Offline piano theory and practice studio for Android. Polish explanations; English note/chord terminology, **B, not H**.

## What is implemented
- Multi-touch on-screen keyboard, glissando, QWERTY input, octave range A0–C8, velocity, sustain, panic.
- Native Android USB MIDI 1.0 input, port selection, Note On/Off (including velocity zero), channels, CC64, CC120/123, running status, split messages and interleaved realtime. Native MIDI output from screen/QWERTY on channel 1; no input echo loop.
- Native 48-voice, additive piano-like / sine synthesis. This is **not a sampled piano**. Metronome and example sequences share the AudioTrack frame clock.
- 18 scales, 24 chord types, interval-aware enharmonic spelling, inversions, live exact-set chord recognition, diatonic harmonization, circle of fifths and seven transposable progressions.
- 30 original Polish theory lessons, practice tips, interactive examples and 30 review questions.
- Ear trainer: intervals (up/down/harmonic), chords, scales, repeat a pitch. First answer only is scored; replay unlimited; no answer highlighting beforehand.
- Play-a-note / ascending-scale / chord practice with MIDI, screen or computer keyboard.
- 30–240 BPM, tap tempo, subdivisions, 2/4, 3/4, 4/4, 5/4, 6/8, 9/8, 12/8, 7/8 (2+2+3). Compound meter BPM uses dotted quarters; 7/8 uses eighth notes.
- Local-only preferences and progress, dark/light and four palettes, responsive dock, no INTERNET permission, accounts, ads, analytics or microphone.

## Build
JDK 17, Gradle 8.13, Android SDK 36, AGP 8.13.2. Android 8.0 / API 26 minimum; target API 36.

```sh
node tests/theory.test.js
gradle lint testDebugUnitTest assembleDebug assembleRelease bundleRelease
```

CI builds on pull requests and main, then runs instrumentation on emulators API 26 and 36. Local UI tests use Python Playwright; `tests/browser_smoke.py` injects local assets into about:blank with a storage shim (no network).

## Packages and signing
Release: `com.mikczemny.nextpiano`, versionCode **20000**, versionName **2.0.0**.
Preview: `com.mikczemny.nextpiano.preview`, separate install and data, so it does not overwrite 1.0 or conflict with old debug signatures.
Release AAB/APK from CI are unsigned. Sign with the existing private upload keystore outside Git. Do not create a replacement upload key for an already registered app without going through the appropriate recovery process. Google Play distribution can use a different app-signing certificate from a directly installed upload-key-signed APK.

## Scope / honest limitations
USB/virtual byte-stream MIDI ports only; no built-in Bluetooth pairing UI, no MIDI 2.0/UMP, microphone pitch detection, MIDI recording or acoustic-piano listening. MIDI requires compatible Android hardware and a USB data connection/host adapter. Android metronome stops on background/audio focus loss; no foreground service. Voice detection/recognition concerns played MIDI notes, not audio recording. Recognition uses exact pitch-class sets, so incomplete jazz voicings and ambiguous chords may need manual interpretation.

Automated parser/UI/emulator tests do not replace verification with a real USB instrument. Physical-device latency and audio quality remain manual acceptance checks. See `play/TEST_PLAN.md`.
