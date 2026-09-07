package com.mikczemny.nextpiano;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Process;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Additive, velocity-sensitive piano-like synth; no samples or third-party assets.
 * Notes and metronome use the same audio frame clock, not UI timers. */
public final class SoundEngine implements AutoCloseable {
    public interface Listener { void beat(int step, int total); void error(String message); }
    private static final int RATE = 48000, BLOCK = 240, MAX_VOICES = 48, TABLE_SIZE = 8192;
    private final double[] sine = new double[TABLE_SIZE];
    private final ArrayList<Voice> voices = new ArrayList<>();
    private final ConcurrentLinkedQueue<Runnable> commands = new ConcurrentLinkedQueue<>();
    private final boolean[] sustain = new boolean[18];
    private final Listener listener;
    private final Object wake = new Object();
    private final Thread thread;
    private volatile boolean running = true, active;
    private volatile double volume = .65;
    private volatile int tone;
    private long frame;
    private final java.util.PriorityQueue<Pulse> pulses = new java.util.PriorityQueue<>(java.util.Comparator.comparingLong(p -> p.at));
    private static final class Pulse { int note, duration; long at; Pulse(int n, int d, long a) { note=n; duration=d; at=a; } }
    private boolean metro;
    private double nextTick, tickPeriod;
    private int tick, ticksPerBar, subdivision = 1, accentMask = 1;
    private double clickAge = 1, clickFrequency, clickGain;

    private final class Voice {
        int id, note, channel; double phase, age, release = -1, amplitude, frequency;
        boolean held = true; long expires;
        Voice(int id, int note, int velocity, int channel, int durationMs) {
            this.id = id; this.note = note; this.channel = channel;
            amplitude = Math.pow(velocity / 127.0, 1.35) * .21;
            frequency = 440 * Math.pow(2, (note - 69) / 12.0);
            expires = durationMs > 0 ? frame + (long) durationMs * RATE / 1000 : Long.MAX_VALUE;
        }
        double sample() {
            if (frame >= expires && held) { held = false; release = 0; }
            double env = Math.min(1, age / .004) * Math.exp(-age / (tone == 1 ? 8 : 2.7));
            if (release >= 0) { env *= Math.exp(-release / .085); release += 1.0 / RATE; }
            double value = sin(phase);
            if (tone != 1) {
                if (frequency * 2 < RATE * .45) value += .36 * Math.exp(-age * 1.5) * sin(phase * 2);
                if (frequency * 3 < RATE * .45) value += .15 * Math.exp(-age * 3) * sin(phase * 3);
                if (frequency * 4 < RATE * .45) value += .07 * Math.exp(-age * 5) * sin(phase * 4);
            }
            phase = (phase + frequency / RATE) % 1;
            age += 1.0 / RATE;
            return value * env * amplitude;
        }
    }
    public SoundEngine(Listener listener) {
        this.listener = listener;
        for (int i = 0; i < TABLE_SIZE; i++) sine[i] = Math.sin(i * Math.PI * 2 / TABLE_SIZE);
        thread = new Thread(this::render, "NextPianoAudio"); thread.start();
    }
    private double sin(double p) { return sine[((int) (p * TABLE_SIZE)) & (TABLE_SIZE - 1)]; }
    private void command(Runnable action) { if (running) commands.add(action); }
    public void activate() { active = true; synchronized (wake) { wake.notifyAll(); } }
    public void pause() { active = false; panic(); }
    public void settings(double level, int sound) {
        if (Double.isFinite(level)) volume = Math.max(0, Math.min(1, level));
        tone = sound == 1 ? 1 : 0;
    }
    public void on(int id, int note, int velocity, int channel, int durationMs) {
        if (!active || note < 21 || note > 108 || velocity < 1 || velocity > 127 || channel < 0 || channel >= 18) return;
        command(() -> {
            voices.removeIf(v -> v.id == id);
            if (voices.size() >= MAX_VOICES) voices.remove(0);
            voices.add(new Voice(id, note, velocity, channel, Math.max(0, Math.min(10000, durationMs))));
        });
    }
    public void pulse(int note, int delay, int duration) {
        if (!active || note < 21 || note > 108) return;
        command(() -> { if (pulses.size() < 256) pulses.add(new Pulse(note, duration, frame + (long) delay * RATE / 1000)); });
    }
    public void cancelExamples() { command(() -> { pulses.clear(); voices.removeIf(v -> v.channel == 17); }); }
    public void off(int id) { command(() -> { for (Voice v : voices) if (v.id == id) { v.held = false; if (!sustain[v.channel]) v.release = 0; } }); }
    public void pedal(int channel, boolean down) {
        if (channel < 0 || channel >= 18) return;
        command(() -> {
            sustain[channel] = down;
            if (!down) for (Voice v : voices) if (v.channel == channel && !v.held && v.release < 0) v.release = 0;
        });
    }
    public void allOff(int channel) { command(() -> { sustain[channel] = false; for (Voice v : voices) if (v.channel == channel) { v.held = false; v.release = 0; } }); }
    public void panic() { command(() -> { voices.clear(); pulses.clear(); java.util.Arrays.fill(sustain, false); metro = false; clickAge = 1; }); }
    public void metronome(boolean enabled, int bpm, int beats, int sub, int accent) {
        int b = Math.max(30, Math.min(240, bpm)), n = Math.max(1, Math.min(12, beats));
        int s = Math.max(1, Math.min(4, sub));
        command(() -> { metro = enabled; subdivision = s; accentMask = accent & 4095;
            tickPeriod = RATE * 60.0 / b / s; ticksPerBar = n * s; tick = 0; nextTick = frame; });
    }
    private void render() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        AudioTrack track = null;
        try {
            int min = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(Math.max(min, BLOCK * 4))
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY).build();
            short[] buffer = new short[BLOCK];
            while (running) {
                Runnable cmd; while ((cmd = commands.poll()) != null) cmd.run();
                if (!active) {
                    if (track.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) { track.pause(); track.flush(); }
                    voices.clear(); pulses.clear(); metro = false; clickAge = 1;
                    synchronized (wake) { if (!active && running) wake.wait(100); }
                    continue;
                }
                if (track.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) track.play();
                for (int i = 0; i < BLOCK; i++, frame++) {
                    while (!pulses.isEmpty() && pulses.peek().at <= frame) {
                        Pulse p = pulses.poll(); voices.removeIf(v -> v.id == 20000 + p.note);
                        if (voices.size() >= MAX_VOICES) voices.remove(0);
                        voices.add(new Voice(20000 + p.note, p.note, 88, 17, p.duration));
                    }
                    if (metro && frame >= nextTick) {
                        boolean downbeat = tick == 0, primary = tick % subdivision == 0;
                        clickFrequency = downbeat ? 1760 : primary ? 1175 : 780;
                        clickGain = downbeat ? .3 : primary ? ((accentMask & (1 << (tick / subdivision))) != 0 ? .22 : .15) : .09;
                        clickAge = 0; listener.beat(tick, ticksPerBar);
                        tick = (tick + 1) % ticksPerBar; nextTick += tickPeriod;
                    }
                    double sample = 0;
                    for (Voice v : voices) sample += v.sample();
                    if (clickAge < .04) { sample += sin(clickAge * clickFrequency) * Math.exp(-clickAge * 130) * clickGain; clickAge += 1.0 / RATE; }
                    sample *= volume; sample = sample / (1 + Math.abs(sample));
                    buffer[i] = (short) (sample * 30000);
                }
                Iterator<Voice> it = voices.iterator();
                while (it.hasNext()) { Voice v = it.next(); if (v.release > .8 || v.age > 30) it.remove(); }
                int offset = 0;
                while (running && active && offset < BLOCK) {
                    int written = track.write(buffer, offset, BLOCK - offset, AudioTrack.WRITE_BLOCKING);
                    if (written < 0) throw new IllegalStateException("AudioTrack write " + written);
                    if (written == 0) break;
                    offset += written;
                }
            }
        } catch (Exception ex) { listener.error("Nie można uruchomić dźwięku. Uruchom aplikację ponownie."); }
        finally { if (track != null) { try { track.stop(); } catch (IllegalStateException ignored) {} track.release(); } }
    }
    @Override public void close() { running = false; active = false; synchronized (wake) { wake.notifyAll(); } }
}
