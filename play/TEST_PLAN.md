# Next Piano 2.0 acceptance tests

## Automated
- `tests/theory.test.js`: enharmonic spelling, all 12 roots, 18 scales, 24 chord types, inversion pitch preservation, chord recognition, harmonization.
- `MidiStreamParserTest`: 11 JVM tests covering split messages, running status, realtime, SysEx, channel messages, velocity-zero, sustain, reset and bounds.
- `tests/ui_test.py`: responsive layouts and flows, QWERTY, simulated MIDI input, chord/scale tasks, first-answer scoring, replay, lessons, compound meter, theme and state restoration. Web Audio is mocked in this UI test; storage shim is used in about:blank.
- `AppSmokeTest`: real Android WebView offline startup, all modules, localStorage after Activity recreation, simulated MIDI UI events, native audio/metronome smoke (does not measure audio quality).

## Required physical hardware checks before production
- Install Preview alongside 1.0; verify launch, portrait/landscape, resizing, suspend/resume and no blank screen.
- Plug a class-compliant USB MIDI 1.0 keyboard into an Android USB host connection. Refresh ports; connect input. Verify low/middle/high notes, chords, velocity, repeated same note, all 16 channels.
- Hold CC64 sustain, release keys, then release sustain. No stuck notes. Disconnect USB while playing; verify panic. Reconnect and resume.
- Play two or more fingers on screen and glissando. Press/release keys while changing tabs, orientation, octave; no stuck note.
- Choose an external MIDI output. Screen/QWERTY should transmit on channel 1, incoming keyboard events must not echo. Test output disconnect while a key is held.
- Run metronome at 30, 80, 240 BPM and all meters. 6/8 = 2 dotted-quarter pulses subdivided in 3, 7/8 = seven eighths grouped 2+2+3. Compare timing to a reliable external click. Do not assume Bluetooth audio is latency-free.
- Background app, take audio focus away, switch output route. Audio and click must stop. Return and enable audio or reconnect input if necessary.
- Check ear questions by sound, without UI answer clues; record first-answer scoring. Verify no duplicate point from replay or repeated key.
- Check stored progress after app restart. Read privacy text; clear progress with confirmation.
- Internal Play test and pre-launch report; confirm signed upload certificate against existing registered app before any production promotion.

Not automatically verified: physical MIDI compatibility, round-trip latency, subjective synthesis quality, store acceptance or account eligibility. No claim of complete hardware certification.
