package com.mikczemny.nextpiano;

import android.content.Context;
import android.media.midi.*;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;

/** Native Android MIDI 1.0 USB / virtual ports. No browser Web MIDI dependency. */
public final class MidiController implements AutoCloseable {
    public interface Listener { void event(int status, int a, int b); void status(String text); void disconnected(); }
    private final MidiManager manager;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private MidiDevice inDevice, outDevice;
    private MidiOutputPort input;
    private MidiInputPort output;
    private volatile int inputGeneration, outputGeneration;
    private final MidiStreamParser parser;
    private final MidiManager.DeviceCallback callback = new MidiManager.DeviceCallback() {
        @Override public void onDeviceAdded(MidiDeviceInfo info) { listener.status("Wykryto urządzenie MIDI. Odśwież listę portów."); }
        @Override public void onDeviceRemoved(MidiDeviceInfo info) {
            if (inDevice != null && inDevice.getInfo().getId() == info.getId()) { disconnectInput(); listener.disconnected(); }
            if (outDevice != null && outDevice.getInfo().getId() == info.getId()) disconnectOutput();
            listener.status("Urządzenie MIDI odłączone.");
        }
    };
    public MidiController(Context context, Listener listener) {
        this.listener = listener; parser = new MidiStreamParser(listener::event);
        manager = (MidiManager) context.getSystemService(Context.MIDI_SERVICE);
        if (manager != null) manager.registerDeviceCallback(callback, main);
    }
    public boolean hasInput() { return input != null; }
    public String devices() {
        JSONObject result = new JSONObject(); JSONArray ins = new JSONArray(), outs = new JSONArray();
        try {
            result.put("available", manager != null);
            if (manager != null) for (MidiDeviceInfo device : manager.getDevices()) {
                String name = device.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME, "MIDI " + device.getId());
                for (MidiDeviceInfo.PortInfo port : device.getPorts()) {
                    JSONObject p = new JSONObject();
                    p.put("id", device.getId()); p.put("port", port.getPortNumber());
                    p.put("name", name + " · " + (port.getName().isEmpty() ? "port " + port.getPortNumber() : port.getName()));
                    if (port.getType() == MidiDeviceInfo.PortInfo.TYPE_OUTPUT) ins.put(p); else outs.put(p);
                }
            }
            result.put("inputs", ins); result.put("outputs", outs);
        } catch (Exception ex) { listener.status("Nie można odczytać listy MIDI."); }
        return result.toString();
    }
    private MidiDeviceInfo find(int id) { if (manager != null) for (MidiDeviceInfo d : manager.getDevices()) if (d.getId() == id) return d; return null; }
    public void connectInput(int id, int port) {
        disconnectInput(); listener.disconnected(); MidiDeviceInfo info = find(id);
        if (info == null) { listener.status("Brak urządzenia wejściowego. Podłącz USB MIDI i odśwież."); return; }
        int generation = inputGeneration;
        try { manager.openDevice(info, device -> {
            if (device == null) { listener.status("Nie można otworzyć wejścia MIDI."); return; }
            if (generation != inputGeneration) { closeQuietly(device); return; }
            MidiOutputPort candidate = device.openOutputPort(port);
            if (candidate == null) { closeQuietly(device); listener.status("Port wejściowy MIDI jest niedostępny."); return; }
            inDevice = device; input = candidate; parser.reset();
            input.connect(new MidiReceiver() {
                @Override public void onSend(byte[] bytes, int offset, int count, long timestamp) {
                    if (generation == inputGeneration) parser.send(bytes, offset, count);
                }
            });
            listener.status("Wejście MIDI połączone. Zagraj na instrumencie.");
        }, main); } catch (Exception ex) { listener.status("Android nie pozwolił otworzyć wejścia MIDI."); }
    }
    public void connectOutput(int id, int port) {
        disconnectOutput(); MidiDeviceInfo info = find(id);
        if (info == null) { listener.status("Brak urządzenia wyjściowego MIDI."); return; }
        int generation = outputGeneration;
        try { manager.openDevice(info, device -> {
            if (device == null) { listener.status("Nie można otworzyć wyjścia MIDI."); return; }
            if (generation != outputGeneration) { closeQuietly(device); return; }
            MidiInputPort candidate = device.openInputPort(port);
            if (candidate == null) { closeQuietly(device); listener.status("Port wyjściowy MIDI jest zajęty."); return; }
            outDevice = device; output = candidate; listener.status("Wyjście MIDI połączone: ekran steruje instrumentem (kanał 1).");
        }, main); } catch (Exception ex) { listener.status("Android nie pozwolił otworzyć wyjścia MIDI."); }
    }
    public synchronized void send(int status, int a, int b) {
        if (output == null) return;
        try { output.send(new byte[]{(byte)status, (byte)(a & 127), (byte)(b & 127)}); }
        catch (IOException ex) { listener.status("Błąd transmisji MIDI. Rozłącz i podłącz wyjście ponownie."); }
    }
    public void silenceOutput() { send(0xB0, 64, 0); send(0xB0, 123, 0); send(0xB0, 120, 0); }
    public void disconnectInput() { inputGeneration++; closeQuietly(input); closeQuietly(inDevice); input = null; inDevice = null; parser.reset(); }
    public void disconnectOutput() { outputGeneration++; silenceOutput(); closeQuietly(output); closeQuietly(outDevice); output = null; outDevice = null; }
    private static void closeQuietly(java.io.Closeable item) { if (item != null) try { item.close(); } catch (IOException ignored) {} }
    @Override public void close() { disconnectInput(); disconnectOutput(); if (manager != null) manager.unregisterDeviceCallback(callback); }
}
