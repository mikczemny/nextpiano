package com.mikczemny.nextpiano;

/** Stateful MIDI 1.0 parser. Accepts split packets, running status and interleaved realtime. */
public final class MidiStreamParser {
    public interface Listener { void message(int status, int data1, int data2); }
    private final Listener listener;
    private int status, count, expected;
    private final int[] data = new int[2];
    private boolean sysex;
    public MidiStreamParser(Listener listener) { this.listener = listener; }
    public synchronized void reset() { status = count = expected = 0; sysex = false; }
    public synchronized void send(byte[] bytes, int offset, int length) {
        if (bytes == null || offset < 0 || length < 0 || offset > bytes.length - length) return;
        for (int i = offset; i < offset + length; i++) {
            int b = bytes[i] & 255;
            if (b >= 0xF8) { if (b == 0xFF) reset(); continue; }
            if (b == 0xF7) { sysex = false; status = expected = count = 0; continue; }
            if (b >= 128) {
                sysex = b == 0xF0;
                status = b; count = 0;
                expected = b < 0xF0 ? (((b & 0xE0) == 0xC0) ? 1 : 2)
                        : b == 0xF2 ? 2 : (b == 0xF1 || b == 0xF3) ? 1 : 0;
                continue;
            }
            if (sysex || expected == 0) continue;
            data[count++] = b;
            if (count == expected) {
                if (status < 0xF0) listener.message(status, data[0], expected == 2 ? data[1] : 0);
                else { status = 0; expected = 0; }
                count = 0;
            }
        }
    }
}
