package com.mikczemny.nextpiano;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private SoundEngine sound;
    private MidiController midi;
    private AudioManager audioManager;
    private AudioFocusRequest focus;
    private volatile boolean hasFocus;
    private volatile boolean foreground, ready;
    private final int[] outputNotes = new int[10000];
    private final int[] outputCounts = new int[128];

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        java.util.Arrays.fill(outputNotes, -1);
        FrameLayout host = new FrameLayout(this); host.setBackgroundColor(Color.rgb(19, 22, 29));
        web = new WebView(this); web.setBackgroundColor(Color.rgb(19, 22, 29));
        host.addView(web, new FrameLayout.LayoutParams(-1, -1)); setContentView(host);
        host.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                host.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else host.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        host.requestApplyInsets();
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setBlockNetworkLoads(true); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true); s.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(false);
        WebView.setWebContentsDebuggingEnabled(false);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = loader.shouldInterceptRequest(request.getUrl());
                if (local != null) return local;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().equals(ORIGIN + "/assets/index.html");
            }
            @Override public void onPageFinished(WebView view, String url) { ready = url.equals(ORIGIN + "/assets/index.html"); }
        });
        audioManager = (AudioManager)getSystemService(AUDIO_SERVICE);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener(change -> { if (change <= 0) { hasFocus = false; stopAudio(); } }).build();
        sound = new SoundEngine(new SoundEngine.Listener() {
            public void beat(int step, int total) { emit("beat", "{\"step\":" + step + ",\"total\":" + total + "}"); }
            public void error(String text) { emit("error", JSONObject.quote(text)); }
        });
        midi = new MidiController(this, new MidiController.Listener() {
            public void event(int status, int a, int b) {
                if (!foreground) return;
                int command = status & 0xF0, ch = status & 15, id = 10000 + ch * 128 + a;
                if (command == 0x90 && b > 0) { if (hasFocus) sound.on(id, a, b, ch, 0); }
                else if (command == 0x80 || (command == 0x90 && b == 0)) sound.off(id);
                else if (command == 0xB0 && a == 64) sound.pedal(ch, b >= 64);
                else if (command == 0xB0 && (a == 120 || a == 123)) sound.allOff(ch);
                emit("midi", "{\"status\":"+status+",\"a\":"+a+",\"b\":"+b+"}");
            }
            public void status(String text) { emit("midiStatus", JSONObject.quote(text)); }
            public void disconnected() { sound.panic(); emit("reset", "null"); }
        });
        web.addJavascriptInterface(new Bridge(), "NativePiano");
        web.loadUrl(ORIGIN + "/assets/index.html");
    }
    private void emit(String type, String json) {
        if (!foreground || !ready) return;
        runOnUiThread(() -> { if (web != null && ready) web.evaluateJavascript("window.nativeEvent && window.nativeEvent("+JSONObject.quote(type)+","+json+")", null); });
    }
    private boolean activateAudio() {
        if (!foreground) return false;
        if (!hasFocus) hasFocus = audioManager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        if (hasFocus) sound.activate(); else emit("error", JSONObject.quote("Dźwięk jest używany przez inną aplikację."));
        return hasFocus;
    }
    private void stopAudio() {
        if (sound != null) sound.pause();
        if (midi != null) midi.silenceOutput();
        java.util.Arrays.fill(outputNotes, -1); java.util.Arrays.fill(outputCounts, 0);
        if (web != null) web.evaluateJavascript("window.nativeEvent && window.nativeEvent('reset',null)", null);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    public final class Bridge {
        @JavascriptInterface public String devices() { return midi.devices(); }
        @JavascriptInterface public void connectInput(int id, int port) { runOnUiThread(() -> { activateAudio(); midi.connectInput(id, port); }); }
        @JavascriptInterface public void connectOutput(int id, int port) { runOnUiThread(() -> midi.connectOutput(id, port)); }
        @JavascriptInterface public void disconnect() { runOnUiThread(() -> { midi.disconnectInput(); midi.disconnectOutput(); sound.panic(); emit("reset", "null"); emit("midiStatus", JSONObject.quote("MIDI rozłączone.")); }); }
        @JavascriptInterface public void enableAudio() { runOnUiThread(() -> activateAudio()); }
        @JavascriptInterface public void noteOn(int id, int note, int velocity) {
            if (id < 0 || id >= 10000 || note < 21 || note > 108 || velocity < 1 || velocity > 127) return;
            runOnUiThread(() -> {
                if (!activateAudio()) return;
                releaseOutput(id); sound.on(id, note, velocity, 16, 0);
                outputNotes[id] = note; if (outputCounts[note]++ == 0) midi.send(0x90, note, velocity);
            });
        }
        @JavascriptInterface public void noteOff(int id) { if (id >= 0 && id < 10000) runOnUiThread(() -> { sound.off(id); releaseOutput(id); }); }
        @JavascriptInterface public void pulse(int note, int delayMs, int durationMs) {
            if (note < 21 || note > 108 || delayMs < 0 || delayMs > 120000) return;
            // Both pulse starts and duration use the native frame clock.
            runOnUiThread(() -> { if (activateAudio()) sound.pulse(note, delayMs, Math.max(50, Math.min(5000, durationMs))); });
        }
        @JavascriptInterface public void stopExamples() { sound.cancelExamples(); }
        @JavascriptInterface public void sustain(boolean down) { runOnUiThread(() -> { sound.pedal(16, down); midi.send(0xB0, 64, down ? 127 : 0); }); }
        @JavascriptInterface public void audioSettings(double volume, int tone) { sound.settings(volume, tone); }
        @JavascriptInterface public void metronome(boolean enabled, int bpm, int beats, int sub, int accentMask) {
            runOnUiThread(() -> { if (!enabled || activateAudio()) sound.metronome(enabled, bpm, beats, sub, accentMask);
                if (enabled) getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
        @JavascriptInterface public void panic() { runOnUiThread(() -> { sound.panic(); midi.silenceOutput(); getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); java.util.Arrays.fill(outputNotes, -1); java.util.Arrays.fill(outputCounts, 0); }); }
    }
    private void releaseOutput(int id) {
        int note = outputNotes[id]; if (note >= 0) { if (--outputCounts[note] <= 0) { outputCounts[note] = 0; midi.send(0x80, note, 0); } outputNotes[id] = -1; }
    }
    @Override protected void onResume() { super.onResume(); foreground = true; if (web != null) web.onResume(); if (midi != null && midi.hasInput()) activateAudio(); }
    @Override protected void onPause() { stopAudio(); foreground = false; if (web != null) web.onPause(); if (hasFocus) audioManager.abandonAudioFocusRequest(focus); hasFocus = false; super.onPause(); }
    @Override protected void onDestroy() { ready = false; if (midi != null) midi.close(); if (sound != null) sound.close(); if (web != null) { web.removeJavascriptInterface("NativePiano"); ((android.view.ViewGroup)web.getParent()).removeView(web); web.destroy(); web = null; } super.onDestroy(); }
}
