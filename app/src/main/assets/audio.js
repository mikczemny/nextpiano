(function(global){
'use strict';
let ctx, compressor, master, tone=0, level=.65, pedal=false;
let voices=new Map(), samples=[], timers=[], metroVisuals=new Set(), metroSounds=new Set(), metroTimer=null, metroNext=0, metroStep=0, metroConfig=null;
const native=typeof NativePiano!=='undefined';
function init(){
  if(native){NativePiano.enableAudio();return;}
  if(!ctx){
    const C=global.AudioContext||global.webkitAudioContext;if(!C)throw Error('Ta przeglądarka nie obsługuje Web Audio. Użyj wersji Android.');
    ctx=new C({latencyHint:'interactive'});compressor=ctx.createDynamicsCompressor();master=ctx.createGain();
    compressor.connect(master);master.connect(ctx.destination);master.gain.value=level;
  }
  if(ctx.state==='suspended')ctx.resume();
}
function make(note,velocity,at,duration){
  const gain=ctx.createGain(), oscs=[], freq=440*Math.pow(2,(note-69)/12), strength=Math.pow(velocity/127,1.3)*.18;
  gain.connect(compressor);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(strength,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+18);
  (tone===1?[1]:[1,.36,.15,.07]).forEach((amp,i)=>{
    if(freq*(i+1)>=ctx.sampleRate*.45)return;
    const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq*(i+1);g.gain.value=amp;o.connect(g);g.connect(gain);o.start(at);o.stop(at+20);oscs.push(o);
  });
  const v={gain,oscs,at,strength,released:false,held:true};
  if(duration)release(v,at+duration);
  oscs[0].onended=()=>gain.disconnect();return v;
}
function release(v,at){
  if(v.released)return;v.released=true;const t=Math.max(at||ctx.currentTime,ctx.currentTime);
  const elapsed=Math.max(0,t-v.at), a=Math.max(.0001,v.strength*Math.pow(.0001/v.strength,Math.min(18,elapsed)/18));
  v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(a,t);v.gain.gain.exponentialRampToValueAtTime(.0001,t+.22);
  v.oscs.forEach(o=>{try{o.stop(t+.25);}catch(e){}});
}
function on(id,n,v){init();if(native){NativePiano.noteOn(id,n,v);return;}if(voices.has(id))release(voices.get(id));if(voices.size>=48){const oldest=voices.keys().next().value;release(voices.get(oldest));voices.delete(oldest);}voices.set(id,make(n,v,ctx.currentTime,0));}
function off(id){if(native){NativePiano.noteOff(id);return;}const v=voices.get(id);if(v){v.held=false;if(!pedal){release(v);voices.delete(id);}}}
function sustain(down){pedal=down;if(native){NativePiano.sustain(down);return;}if(!down)voices.forEach((v,k)=>{if(!v.held){release(v);voices.delete(k);}});}
function stopExamples(){timers.forEach(clearTimeout);timers=[];if(native){NativePiano.stopExamples();return;}samples.forEach(v=>release(v));samples=[];}
function sequence(events){init();stopExamples();events.forEach(e=>{if(native)NativePiano.pulse(e.note,Math.round(e.at*1000),Math.round(e.duration*1000));else samples.push(make(e.note,e.velocity||88,ctx.currentTime+.025+e.at,e.duration));});}
function settings(volume,sound){level=volume;tone=sound;if(native)NativePiano.audioSettings(volume,sound);else if(master)master.gain.setTargetAtTime(level,ctx.currentTime,.02);}
function click(at,step,cfg){
  const main=step%cfg.sub===0,beat=Math.floor(step/cfg.sub),g=ctx.createGain(),o=ctx.createOscillator();
  const accent=!!(cfg.mask&(1<<beat));o.frequency.value=step===0?1760:main?1175:780;
  g.gain.setValueAtTime(step===0?.3:main?(accent?.22:.15):.09,at);g.gain.exponentialRampToValueAtTime(.0001,at+.04);
  o.connect(g);g.connect(compressor);o.start(at);o.stop(at+.05);o.onended=()=>{g.disconnect();metroSounds.delete(o);};metroSounds.add(o);
  const t=setTimeout(()=>{metroVisuals.delete(t);global.nativeEvent('beat',{step,total:cfg.beats*cfg.sub});},Math.max(0,(at-ctx.currentTime)*1000));metroVisuals.add(t);
}
function metro(enabled,cfg){
  if(native){if(enabled)init();NativePiano.metronome(enabled,cfg.bpm,cfg.beats,cfg.sub,cfg.mask);return;}
  if(metroTimer){clearInterval(metroTimer);metroTimer=null;}
  metroVisuals.forEach(clearTimeout);metroVisuals.clear();metroSounds.forEach(o=>{try{o.stop();}catch(e){}});metroSounds.clear();metroConfig=null;
  if(!enabled)return;init();metroConfig=cfg;metroStep=0;metroNext=ctx.currentTime+.04;
  function schedule(){if(!metroConfig)return;while(metroNext<ctx.currentTime+.12){click(metroNext,metroStep,cfg);metroNext+=60/cfg.bpm/cfg.sub;metroStep=(metroStep+1)%(cfg.beats*cfg.sub);}}
  schedule();metroTimer=setInterval(schedule,25);
}
function panic(){stopExamples();if(native)NativePiano.panic();else{if(ctx)voices.forEach(v=>release(v));voices.clear();metro(false,{});}pedal=false;}
global.PianoAudio={native,init,on,off,sustain,sequence,stopExamples,settings,metro,panic};
})(window);
