package com.mikczemny.nextpiano;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.List;
public class MidiStreamParserTest {
    private final List<String> events = new ArrayList<>();
    private final MidiStreamParser parser = new MidiStreamParser((s,a,b) -> events.add(s+":"+a+":"+b));
    private void feed(int... values) { byte[] bytes=new byte[values.length]; for(int i=0;i<values.length;i++) bytes[i]=(byte)values[i]; parser.send(bytes,0,bytes.length); }
    @Test public void noteOnOff() { feed(0x90,60,100,0x80,60,0); assertEquals(List.of("144:60:100","128:60:0"),events); }
    @Test public void splitPacketAndRunningStatus() { feed(0x92,60); feed(80,64,90); assertEquals(List.of("146:60:80","146:64:90"),events); }
    @Test public void realTimeCanSplitMessage() { feed(0x90,60,0xF8,100,62,0xFE,110); assertEquals(List.of("144:60:100","144:62:110"),events); }
    @Test public void sysexIsSkipped() { feed(0xF0,1,2,3,0xF8,4,0xF7,0x90,64,100); assertEquals(List.of("144:64:100"),events); }
    @Test public void commonCancelsRunningStatus() { feed(0x90,60,90,0xF2,0,1,64,100,0x90,65,90); assertEquals(List.of("144:60:90","144:65:90"),events); }
    @Test public void oneDataByteMessages() { feed(0xC0,4,5,0xD2,88,0x90,60,90); assertEquals(List.of("192:4:0","192:5:0","210:88:0","144:60:90"),events); }
    @Test public void velocityZeroPreserved() { feed(0x9F,71,0); assertEquals(List.of("159:71:0"),events); }
    @Test public void sustainAndAllNotesOff() { feed(0xB0,64,127,64,0,123,0); assertEquals(List.of("176:64:127","176:64:0","176:123:0"),events); }
    @Test public void invalidBoundsIgnored() { parser.send(new byte[]{1,2},-1,3); parser.send(null,0,1); assertTrue(events.isEmpty()); }
    @Test public void resetDropsPartialMessage() { feed(0x90,60); parser.reset(); feed(127); assertTrue(events.isEmpty()); }
    @Test public void everyChunkingIsEquivalent() {
        byte[] stream={(byte)0x90,60,100,64,110,(byte)0xF8,67,120,(byte)0xB0,64,127,(byte)0x80,60,0};
        for(int split=1;split<stream.length;split++) { events.clear(); parser.reset(); parser.send(stream,0,split); parser.send(stream,split,stream.length-split); assertEquals(5,events.size()); }
    }
}
