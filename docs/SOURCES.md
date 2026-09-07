# Reference material (checked 7 September 2026)

Explanations, examples and quizzes in Next Piano are original concise text, not a reproduction of a textbook. General music-theory conventions were cross-checked against these chapters:

- Open Music Theory 2e, Intervals: https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/1.15%3A_Intervals
- OMT, Triads and Seventh Chords: https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_1e_(Wharton_and_Shaffer_Eds)/01%3A_Fundamentals/1.01%3A_Triads_and_Seventh_Chords
- OMT 2e, Minor Scales: https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/1.13%3A_Minor_Scales_Scale_Degrees_and_Key_Signatures
- OMT 2e, Compound Meter: https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/1.10%3A_Compound_Meter_and_Time_Signatures
- Publisher index (blocked by the research fetch, not relied on alone): https://viva.pressbooks.pub/openmusictheory/

Implementation references:
- https://developer.android.com/reference/android/media/midi/package-summary
- https://developer.android.com/reference/android/media/midi/MidiDeviceInfo
- https://developer.android.com/reference/android/media/AudioTrack.Builder
- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://developer.android.com/jetpack/androidx/releases/webkit
- https://developer.android.com/google/play/requirements/target-sdk

MIDI input is a raw byte stream and may contain partial/multiple messages with interleaved realtime; the custom parser tests those cases. Native audio timing is based on rendered sample frames, with hardware-dependent output latency.
