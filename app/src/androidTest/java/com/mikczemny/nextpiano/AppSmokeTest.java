package com.mikczemny.nextpiano;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private WebView find(View v) { if(v instanceof WebView)return (WebView)v; if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){WebView w=find(((ViewGroup)v).getChildAt(i));if(w!=null)return w;}return null; }
    private String js(ActivityScenario<MainActivity> scenario,String code) throws Exception {
        CountDownLatch latch=new CountDownLatch(1); AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(a -> find(a.getWindow().getDecorView()).evaluateJavascript(code, value->{result.set(value);latch.countDown();}));
        assertTrue("WebView callback",latch.await(5,TimeUnit.SECONDS));return result.get();
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception { for(int i=0;i<80;i++){if("true".equals(js(scenario,"!!window.NextPiano")))return;Thread.sleep(150);}fail("App did not load offline assets"); }
    @Test public void loadsAllModulesOffline() throws Exception {
        try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)) {
            ready(s);assertEquals("\"2.0.0\"",js(s,"NextPiano.version"));
            for(String page:new String[]{"studio","theory","ear","practice","metro","midi"}){js(s,"NextPiano.go('"+page+"')");assertEquals("true",js(s,"document.querySelectorAll('.card').length > 0 && document.querySelectorAll('.pkey').length >= 13"));}
            assertEquals("true",js(s,"JSON.parse(NativePiano.devices()).inputs instanceof Array"));
        }
    }
    @Test public void persistsAcrossActivityRecreation() throws Exception {
        try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)) {
            ready(s);js(s,"document.getElementById('themeToggle').click()");String before=js(s,"NextPiano.getState().theme");
            s.recreate();ready(s);assertEquals(before,js(s,"NextPiano.getState().theme"));
        }
    }
    @Test public void simulatedMidiHighlightsAndReleases() throws Exception {
        try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)) {
            ready(s);js(s,"NextPiano.go('studio');nativeEvent('midi',{status:144,a:60,b:90});nativeEvent('midi',{status:144,a:64,b:90});nativeEvent('midi',{status:144,a:67,b:90})");
            assertEquals("\"C Major\"",js(s,"document.getElementById('liveName').textContent"));
            js(s,"nativeEvent('midi',{status:176,a:123,b:0})");assertEquals("0",js(s,"document.querySelectorAll('.pkey.pressed').length"));
        }
    }
    @Test public void nativeAudioAndMetronomeDoNotCrash() throws Exception {
        try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)) {
            ready(s);js(s,"NextPiano.go('metro');NativePiano.enableAudio();NativePiano.noteOn(22,60,90);NativePiano.metronome(true,90,4,2,15)");
            Thread.sleep(1000);js(s,"NativePiano.noteOff(22);NativePiano.sustain(false);NativePiano.panic()");
            assertEquals("false",js(s,"document.getElementById('toast').textContent.includes('Nie można uruchomić dźwięku')"));
            js(s,"NextPiano.go('studio')");
        }
    }
}
