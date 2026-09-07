(function(){
'use strict';
const T=window.Theory, A=window.PianoAudio, $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults={view:'studio',studio:'key',root:'C',scale:'Major (Ionian)',chord:'Major',inversion:0,keyChord:-1,octave:3,octaves:0,theme:'dark',palette:'lavender',volume:.65,tone:0,velocity:95,bpm:80,meter:'4/4',sub:1,lesson:'keyboard',group:'Wszystkie',earType:'interval',difficulty:'basic',direction:'up',practiceType:'scale',progression:0,stats:{notes:0,ear:{},practice:0,misses:0,read:[],quiz:{}}};
let state=JSON.parse(JSON.stringify(defaults));
try{const raw=JSON.parse(localStorage.getItem('nextpiano.v2')||'null');if(raw&&raw.schema===2){Object.keys(defaults).forEach(k=>{if(k!=='stats'&&typeof raw[k]===typeof defaults[k])state[k]=raw[k];});if(raw.stats&&Array.isArray(raw.stats.read)&&raw.stats.ear&&raw.stats.quiz)state.stats=Object.assign({},defaults.stats,raw.stats);}}catch(e){}
if(!T.ROOTS.includes(state.root))state.root='C';if(!T.SCALES[state.scale])state.scale=defaults.scale;if(!T.CHORDS[state.chord])state.chord='Major';
if(!['studio','theory','ear','practice','metro','midi'].includes(state.view))state.view='studio';
state.octave=Math.max(0,Math.min(7,state.octave));state.bpm=Math.max(30,Math.min(240,state.bpm));state.volume=Math.max(0,Math.min(1,state.volume));
let held=new Map(), pointers=new Map(), pcHeld=new Map(), pointerSerial=1, sustain=false, collapsed=false;
let ear=null, task=null, metroOn=false, currentBeat=-1, taps=[], midiText='Podłącz instrument przez USB i wybierz port.', query='', saveTimer, toastTimer, resizeTimer;
const meters={
 '2/4':{beats:2,sub:0,mask:3,unit:'ćwierćnuta'},'3/4':{beats:3,sub:0,mask:7,unit:'ćwierćnuta'},
 '4/4':{beats:4,sub:0,mask:15,unit:'ćwierćnuta'},'5/4':{beats:5,sub:0,mask:31,unit:'ćwierćnuta'},
 '6/8':{beats:2,sub:3,mask:3,unit:'ćwierćnuta z kropką'},'9/8':{beats:3,sub:3,mask:7,unit:'ćwierćnuta z kropką'},
 '12/8':{beats:4,sub:3,mask:15,unit:'ćwierćnuta z kropką'},'7/8':{beats:7,sub:1,mask:21,unit:'ósemka · akcenty 2+2+3'}
};
if(!meters[state.meter])state.meter='4/4';
function save(){try{localStorage.setItem('nextpiano.v2',JSON.stringify(Object.assign({schema:2},state)));}catch(e){toast('Brak miejsca na zapis postępów. Aplikacja nadal działa.');}}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(save,300);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function safeSound(fn){try{fn();}catch(e){toast(e.message||'Nie można odtworzyć dźwięku.');}}
function options(items,selected){return items.map(x=>{const value=Array.isArray(x)?x[0]:x,label=Array.isArray(x)?x[1]:T.display(x);return '<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';}).join('');}
function select(id,label,items,selected){return '<label>'+label+'<select id="'+id+'">'+options(items,selected)+'</select></label>';}
function hero(label,title,description,badge){return '<div class="hero"><div><div class="eyebrow">'+label+'</div><h1>'+title+'</h1><p>'+description+'</p></div>'+(badge?'<div class="hero-badge">'+badge+'</div>':'')+'</div>';}
function bind(id,event,fn){const el=$(id);if(el)el.addEventListener(event,fn);}
function mapState(id,key,after){bind(id,'change',e=>{state[key]=typeof defaults[key]==='number'?+e.target.value:e.target.value;save();if(after)after();});}
function currentFormula(){return state.studio==='chord'?T.CHORDS[state.chord]:T.SCALES[state.scale];}
function selectedNotes(){
 if(state.view==='ear')return ear&&ear.resolved?ear.notes.map(n=>({pc:n%12,name:T.SHARPS[n%12],degree:''})):[];
 if(state.view==='practice'&&task){if(task.type==='chord')return T.notes(task.root,T.CHORDS[task.chord]);if(task.type==='scale')return T.notes(task.root,T.SCALES[task.scale]);return [{pc:task.notes[0]%12,name:T.SHARPS[task.notes[0]%12],degree:'1'}];}
 if(state.view!=='studio')return [];
 return T.notes(state.root,currentFormula());
}
function chordPitches(){if(state.view==='studio'&&state.studio!=='chord'&&state.keyChord>=0){const d=T.diatonicScale(state.root,currentFormula())[state.keyChord];if(d)return T.notes(d.root,T.CHORDS[d.type]).map(n=>n.pc);}if(state.view==='practice'&&task&&task.type==='chord')return task.notes.map(n=>n%12);if(state.view==='studio'&&state.studio==='chord')return T.notes(state.root,T.CHORDS[state.chord]).map(n=>n.pc);return [];}
function activePitches(){return Array.from(held.values()).map(v=>v.note);}
function follow(note){const p=$('piano');if(!p)return;const first=+p.dataset.start,last=+p.dataset.end;if(note<first||note>last){state.octave=Math.max(0,Math.min(7,Math.floor(note/12)-1));renderKeyboard();}}
function begin(id,n,velocity,external){
 if(n<21||n>108)return;if(held.has(id))end(id);
 if(!external)safeSound(()=>A.on(id,n,velocity));
 held.set(id,{note:n,velocity,external:!!external});state.stats.notes++;saveSoon();updateLive();
 if(external)follow(n);
 if(state.view==='ear'&&ear&&!ear.resolved&&state.earType==='repeat')answerEar(n%12);
 if(state.view==='practice')checkPractice(n);
}
function end(id){const item=held.get(id);if(!item)return;if(!item.external)safeSound(()=>A.off(id));held.delete(id);updateLive();}
function releaseLocal(){Array.from(held.keys()).forEach(id=>{if(id<10000)end(id);});pointers.clear();pcHeld.clear();}
function updateLive(){
 const values=activePitches(),matches=T.recognize(values);
 $('liveName').textContent=matches.length?matches[0].label:values.length===1?T.name(values[0]):values.length?'Grasz '+values.length+' dźwięki':'Twoja klawiatura';
 $('liveNotes').textContent=values.length?values.slice().sort((a,b)=>a-b).map(n=>T.name(n)).join(' · '):'Ekran · klawiatura komputerowa · USB MIDI';
 document.querySelectorAll('.pkey').forEach(k=>{const down=values.includes(+k.dataset.note);k.classList.toggle('pressed',down);k.setAttribute('aria-pressed',String(down));});
 if($('midiLast')&&values.length)$('midiLast').textContent=values.map(n=>T.name(n)+' / MIDI '+n).join(' · ');
}
function setSustain(down){sustain=down;safeSound(()=>A.sustain(down));$('sustain').classList.toggle('active',down);$('sustain').setAttribute('aria-pressed',String(down));}
function resetAudio(send){if(send)safeSound(()=>A.panic());held.clear();pointers.clear();pcHeld.clear();sustain=false;metroOn=false;currentBeat=-1;$('sustain').classList.remove('active');$('sustain').setAttribute('aria-pressed','false');updateLive();if(state.view==='metro')render();}
function renderKeyboard(){
 // Release local pointers before rebuilding DOM to prevent stuck notes on resize.
 releaseLocal();const p=$('piano'),width=p.clientWidth||600,maxOct=width<500?1:width<830?2:3;
 const oct=state.octaves?Math.min(state.octaves,maxOct):maxOct;
 const start=state.octave===0?21:12*(state.octave+1),finish=Math.min(108,start+12*oct),black=[1,3,6,8,10];
 const ns=[];for(let n=start;n<=finish;n++)ns.push(n);const whites=ns.filter(n=>!black.includes(n%12)),unit=100/whites.length;
 const selection=selectedNotes(),selected=chordPitches();let index=0,html='';
 ns.forEach(n=>{const isBlack=black.includes(n%12),left=isBlack?(index-.32)*unit:index*unit,w=isBlack?.64*unit:unit;
   const match=selection.find(x=>x.pc===n%12);
   html+='<button type="button" tabindex="0" class="pkey '+(isBlack?'black':'white')+(selected.includes(n%12)?' selected':'')+'" data-note="'+n+'" style="left:'+left+'%;width:'+w+'%" aria-label="'+esc(T.name(n))+'" aria-pressed="false"><span>'+esc(isBlack?T.SHARPS[n%12]:T.SHARPS[n%12])+'<small>'+(Math.floor(n/12)-1)+'</small></span></button>';
   if(match)html+='<span class="marker '+(isBlack?'black-mark ':'')+(match.degree==='1'?'root':'')+'" style="left:'+(left+w/2)+'%;width:'+Math.min(42,width*unit/100*.8)+'px"><b>'+esc(match.name)+'</b><small>'+esc(match.degree)+'</small></span>';
   if(!isBlack)index++;
 });
 p.innerHTML=html;p.dataset.start=start;p.dataset.end=finish;$('octaveLabel').textContent=T.name(start);$('octaveDown').disabled=state.octave===0;$('octaveUp').disabled=state.octave===7;updateLive();
}
function keyAt(event){const el=document.elementFromPoint(event.clientX,event.clientY);return el&&el.closest('.pkey');}
$('piano').addEventListener('pointerdown',e=>{const k=e.target.closest('.pkey');if(!k)return;e.preventDefault();const id=pointerSerial++;if(pointerSerial>900)pointerSerial=1;pointers.set(e.pointerId,id);$('piano').setPointerCapture(e.pointerId);begin(id,+k.dataset.note,state.velocity,false);});
$('piano').addEventListener('pointermove',e=>{const id=pointers.get(e.pointerId);if(!id)return;const k=keyAt(e),old=held.get(id);if(!k){end(id);return;}const n=+k.dataset.note;if(!old||old.note!==n){end(id);begin(id,n,state.velocity,false);}});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('piano').addEventListener(type,e=>{const id=pointers.get(e.pointerId);if(id){end(id);pointers.delete(e.pointerId);if(!pointers.size&&state.view==='practice'&&task&&!task.done&&task.type==='scale')follow(task.notes[task.index]);}}));
// Enter/Space allow a focused piano key to be auditioned by assistive keyboards.
$('piano').addEventListener('keydown',e=>{const k=e.target.closest('.pkey');if(k&&(e.code==='Enter'||e.code==='Space')&&!e.repeat){e.preventDefault();begin(950,+k.dataset.note,state.velocity,false);}});
$('piano').addEventListener('keyup',e=>{if(e.code==='Enter'||e.code==='Space')end(950);});
const keys=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon'];
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,select,textarea'))return;
 if(e.code==='Space'){if(e.target.closest('button'))return;e.preventDefault();setSustain(true);return;}
 const offset=keys.indexOf(e.code);if(offset>=0){e.preventDefault();const id=1000+offset,base=state.octave===0?21:12*(state.octave+1);pcHeld.set(e.code,id);begin(id,Math.min(108,base+offset),state.velocity,false);}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&!e.target.closest('button'))setSustain(false);const id=pcHeld.get(e.code);if(id){end(id);pcHeld.delete(e.code);if(!pcHeld.size&&state.view==='practice'&&task&&!task.done&&task.type==='scale')follow(task.notes[task.index]);}});
window.addEventListener('blur',()=>resetAudio(true));document.addEventListener('visibilitychange',()=>{if(document.hidden){save();resetAudio(true);}});
bind('octaveDown','click',()=>{state.octave=Math.max(0,state.octave-1);save();renderKeyboard();});bind('octaveUp','click',()=>{state.octave=Math.min(7,state.octave+1);save();renderKeyboard();});
bind('sustain','click',()=>setSustain(!sustain));bind('panic','click',()=>{resetAudio(true);toast('Wszystkie dźwięki i metronom zatrzymane.');});
bind('toggleKeyboard','click',()=>{collapsed=!collapsed;$('keyboardWrap').classList.toggle('hide',collapsed);$('toggleKeyboard').textContent=collapsed?'Pokaż':'Schowaj';$('toggleKeyboard').setAttribute('aria-expanded',String(!collapsed));if(!collapsed)renderKeyboard();});
function theme(){document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.palette=state.palette;$('themeToggle').textContent=state.theme==='dark'?'Jasny motyw':'Ciemny motyw';}
bind('themeToggle','click',()=>{state.theme=state.theme==='dark'?'light':'dark';theme();save();});
function view(name){safeSound(()=>A.stopExamples());releaseLocal();state.view=name;save();render();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
function render(){document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});({studio:renderStudio,theory:renderTheory,ear:renderEar,practice:renderPractice,metro:renderMetro,midi:renderMidi}[state.view]||renderStudio)();renderKeyboard();}
function pills(root,formula){return '<div class="pills">'+T.notes(root,formula).map((n,i)=>'<span class="pill '+(!i?'root':'')+'"><b>'+esc(n.name)+'</b><small>'+esc(n.degree)+'</small></span>').join('')+'</div>';}
function playNotes(notes,arp){safeSound(()=>A.sequence(notes.map((note,i)=>({note,at:arp?i*.33:0,duration:arp?.32:1.3}))));}
function showChord(root,type){state.root=T.ROOTS[T.pc(root)];state.chord=type;state.studio='chord';state.inversion=0;save();render();}
function renderStudio(){
 const chord=state.studio==='chord',formula=currentFormula(),name=T.display(state.root)+' '+(chord?state.chord:state.scale);
 let html=hero('INTERAKTYWNY ATLAS','Teoria, która staje się muzyką.','Wybierz wzór. Zobacz jego składniki, posłuchaj i od razu sprawdź go pod palcami.','<strong>18 / 24</strong>skal i typów akordów');
 html+='<div class="tabs">'+[['key','Tonacje'],['scale','Skale'],['chord','Akordy'],['circle','Koło kwintowe'],['progression','Progresje']].map(x=>'<button data-studio="'+x[0]+'" class="'+(state.studio===x[0]?'active':'')+'">'+x[1]+'</button>').join('')+'</div>';
 html+='<div class="two-col"><section class="card"><div class="fields '+(chord?'three':'')+'">'+select('root','ROOT',T.ROOTS,state.root);
 if(chord){state.inversion=Math.min(state.inversion,formula.length-1);html+=select('chord','CHORD',Object.keys(T.CHORDS),state.chord)+select('inversion','VOICING',formula.map((_,i)=>[i,i===0?'Root position':i+'. inversion']),state.inversion);}
 else if(state.studio==='key')html+=select('scale','TONACJA',[['Major (Ionian)','Major'],['Natural Minor (Aeolian)','Minor']],state.scale);
 else html+=select('scale','SCALE',Object.keys(T.SCALES),state.scale);
 html+='</div><h2>'+esc(name)+'</h2><div class="formula">FORMULA · <strong>'+formula.map(T.display).join(' · ')+'</strong></div>'+pills(state.root,formula)+'<div class="actions"><button id="listen" class="primary">▶ Posłuchaj</button><button id="arpeggio">Po kolei</button><button id="practiceThis">Ćwicz to</button></div>';
 html+='<p class="hint">'+(chord?'Pełny kolor klawisza = składnik akordu. Zagraj własny układ: rozpoznawanie nad klawiaturą uwzględni przewrót. Akordy symetryczne i niektóre voicingi mogą mieć kilka interpretacji.':'Etykiety nad klawiszami pokazują nazwę i stopień skali. Odstępy od root w półtonach: '+formula.map(d=>T.degree(d).semitones).join(' · ')+'. Melodic Minor w tym atlasie oznacza wzór ascending.')+'</p></section><section class="card">';
 if(state.studio==='circle'){
  const roots=['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'];
  html+='<h2>Circle of fifths</h2><div class="circle"><div class="circle-center"><b>'+T.display(state.root)+'</b>Major<br>+7 półtonów →</div>'+roots.map((r,i)=>{const a=(i*30-90)*Math.PI/180;return '<button data-circle="'+r+'" class="'+(r===state.root?'active':'')+'" style="left:'+(50+40*Math.cos(a))+'%;top:'+(50+40*Math.sin(a))+'%">'+T.display(r)+'</button>';}).join('')+'</div><p class="hint">C–G–D: kierunek kwint w górę. C–F–B♭: kierunek kwint w dół. F♯/G♭ jest punktem zmiany pisowni na kole.</p>';
 }else if(state.studio==='progression'){
  html+='<h2>Harmonia w ruchu</h2>'+select('progression','WZÓR',T.PROGRESSIONS.map((p,i)=>[i,p.name]),state.progression)+'<div class="pills">'+progressionChords().map((c,i)=>'<button data-prog="'+i+'">'+T.display(c[0])+' '+c[1]+'</button>').join('')+'</div><button class="primary" id="playProgression">▶ Posłuchaj progresji</button><p class="hint">Transpozycja do wybranego root. Każdy akord trwa dwa pulsy przy '+state.bpm+' BPM. Przykłady używają root position; możesz samodzielnie szukać płynniejszych przewrotów.</p>';
 }else if(chord){
  const mids=T.midi(state.root,formula,state.octave,state.inversion);
  html+='<div class="eyebrow">VOICING LAB</div><h2>'+(!state.inversion?'Root position':state.inversion+'. inversion')+'</h2><p>Od najniższego dźwięku:</p><div class="pills">'+mids.map(n=>'<span class="pill"><b>'+T.name(n)+'</b><small>MIDI '+n+'</small></span>').join('')+'</div><p class="hint">Slash chord podaje bas po ukośniku. Przykład C/E: C Major z E na dole. Dla rozbudowanych akordów to ćwiczenie rozkładania składników, nie jedyna zalecana pozycja dłoni.</p>';
 }else{
  const ds=T.diatonicScale(state.root,T.SCALES[state.scale]);const selected=ds[state.keyChord];
  html+='<div class="eyebrow">'+esc(state.scale)+' · HARMONY</div><h2>'+(ds.length?'Akordy diatoniczne':'Stopnie w praktyce')+'</h2>';
  if(ds.length)html+='<div class="chord-grid">'+ds.map((d,i)=>'<button data-diatonic="'+i+'" class="'+(i===state.keyChord?'active':'')+'"><small>'+d.roman+'</small>'+esc(d.root)+' '+d.type+'</button>').join('')+'</div><p class="hint">Akordy zbudowane co drugi stopień dokładnie tej skali. Kliknij akord: jego składniki zostaną podświetlone, a oznaczenia całej skali pozostaną nad klawiszami.</p>'+(selected?'<div class="actions"><button id="chordLab">'+esc(selected.root)+' '+selected.type+' → laboratorium</button></div>':'');
  else html+='<table class="table">'+T.notes(state.root,currentFormula()).map(n=>'<tr><td>'+n.degree+'</td><td>'+n.name+'</td><td>'+n.interval+' półtonów od root</td></tr>').join('')+'</table><p class="hint">Ten zestaw nie ma siedmiu stopni. Standardowa harmonizacja siedmioma triadami nie jest tu stosowana automatycznie. Zacznij od krótkich motywów opartych na składnikach akordu.</p>';

 }
 html+='</section></div>';$('content').innerHTML=html;
 document.querySelectorAll('[data-studio]').forEach(b=>b.onclick=()=>{state.studio=b.dataset.studio;state.keyChord=-1;if(state.studio==='key'&&!['Major (Ionian)','Natural Minor (Aeolian)'].includes(state.scale))state.scale='Major (Ionian)';save();render();});
 mapState('root','root',()=>{state.keyChord=-1;render();});mapState('scale','scale',()=>{state.keyChord=-1;render();});mapState('chord','chord',()=>{state.inversion=0;render();});mapState('inversion','inversion',render);mapState('progression','progression',render);
 bind('listen','click',()=>{let ns=T.midi(state.root,currentFormula(),state.octave,state.inversion);if(!chord)ns.push(ns[0]+12);playNotes(ns,!chord);});
 bind('arpeggio','click',()=>playNotes(T.midi(state.root,currentFormula(),state.octave,state.inversion),true));
 bind('practiceThis','click',()=>{state.practiceType=chord?'chord':'scale';newTask(false);view('practice');});
 document.querySelectorAll('[data-circle]').forEach(b=>b.onclick=()=>{state.root=b.dataset.circle;state.scale='Major (Ionian)';save();render();});
 document.querySelectorAll('[data-diatonic]').forEach(b=>b.onclick=()=>{state.keyChord=+b.dataset.diatonic;const d=T.diatonicScale(state.root,currentFormula())[state.keyChord];save();render();playNotes(T.midi(d.root,T.CHORDS[d.type],state.octave,0),false);});
 bind('chordLab','click',()=>{const d=T.diatonicScale(state.root,currentFormula())[state.keyChord];if(d)showChord(d.root,d.type);});
 document.querySelectorAll('[data-prog]').forEach(b=>b.onclick=()=>{const c=progressionChords()[+b.dataset.prog];showChord(c[0],c[1]);});
 bind('playProgression','click',()=>{const events=[];progressionChords().forEach((c,i)=>T.midi(c[0],T.CHORDS[c[1]],3,0).forEach(n=>events.push({note:n,at:i*120/state.bpm,duration:Math.min(1.8,110/state.bpm)})));safeSound(()=>A.sequence(events));});
}
function progressionChords(){const p=T.PROGRESSIONS[state.progression]||T.PROGRESSIONS[0],delta=T.pc(state.root)-T.pc(p.root);return p.chords.map(c=>[T.ROOTS[T.mod(T.pc(c[0])+delta,12)],c[1]]);}
function renderTheory(){
 const groups=['Wszystkie'].concat(Array.from(new Set(LESSONS.map(l=>l.group)))),lesson=LESSONS.find(l=>l.id===state.lesson)||LESSONS[0];
 const filtered=LESSONS.filter(l=>(state.group==='Wszystkie'||state.group===l.group)&&(l.title+' '+l.body+' '+l.group).toLowerCase().includes(query.toLowerCase()));
 const done=state.stats.read.includes(lesson.id),quiz=state.stats.quiz[lesson.id];
 let html=hero('BIBLIOTEKA · '+LESSONS.length+' LEKCJI','Zrozum, co grasz.','Od mapy klawiatury do dominant, voicingów i świadomej praktyki. Każda lekcja ma przykład oraz pytanie kontrolne.','<strong>'+state.stats.read.length+'/'+LESSONS.length+'</strong>przerobionych lekcji');
 html+='<div class="searchbar"><input id="lessonSearch" type="search" placeholder="Szukaj: interwały, Major, voicing…" value="'+esc(query)+'" aria-label="Szukaj w teorii">'+select('lessonGroup','DZIAŁ',groups,state.group)+'</div><div class="lesson-layout"><div class="lesson-list">'+(filtered.length?filtered.map(l=>'<button data-lesson="'+l.id+'" class="'+(lesson.id===l.id?'active':'')+'"><small>'+l.group+(state.stats.read.includes(l.id)?' · ✓':'')+'</small>'+l.title+'</button>').join(''):'<p class="empty">Brak pasujących lekcji.</p>')+'</div><article class="card"><div class="eyebrow">'+lesson.group+'</div><h2>'+lesson.title+'</h2><div class="lesson-body"><p>'+esc(lesson.body)+'</p></div><div class="hint"><strong>Praktyka</strong><br>'+esc(lesson.tip)+'</div><div class="actions"><button class="primary" id="lessonExample">Przykład w Studio</button><button id="lessonDone">'+(done?'✓ Przerobione':'Oznacz jako przerobione')+'</button></div><div class="quiz"><h3>'+lesson.q+'</h3><div class="answers">'+lesson.options.map((o,i)=>'<button data-quiz="'+i+'" '+(quiz?'disabled':'')+'>'+esc(o)+'</button>').join('')+'</div>'+(quiz?'<p class="feedback '+(quiz.correct?'':'wrong')+'">'+(quiz.correct?'Dobrze. ':'Pierwsza odpowiedź była błędna. ')+'Poprawnie: '+esc(lesson.options[lesson.answer])+'.</p>':'')+'</div><div class="actions"><button id="nextLesson">Następna lekcja →</button></div><p class="source-note">Autorskie objaśnienia. Dalsza lektura i dokumentacja: sekcja Źródła w ustawieniach. Quiz sprawdza jedną podstawową ideę, nie zastępuje pełnego kursu.</p></article></div>';
 $('content').innerHTML=html;
 bind('lessonSearch','input',e=>{const pos=e.target.selectionStart;query=e.target.value;renderTheory();$('lessonSearch').focus();try{$('lessonSearch').setSelectionRange(pos,pos);}catch(err){}});
 mapState('lessonGroup','group',renderTheory);document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{state.lesson=b.dataset.lesson;save();renderTheory();});
 bind('lessonExample','click',()=>{state.root=T.ROOTS[T.pc(lesson.root)];state.studio=lesson.kind;state[lesson.kind]=lesson.type;state.inversion=0;view('studio');});
 bind('lessonDone','click',()=>{if(!state.stats.read.includes(lesson.id))state.stats.read.push(lesson.id);save();renderTheory();});
 document.querySelectorAll('[data-quiz]').forEach(b=>b.onclick=()=>{if(state.stats.quiz[lesson.id])return;state.stats.quiz[lesson.id]={correct:+b.dataset.quiz===lesson.answer};save();renderTheory();});
 bind('nextLesson','click',()=>{state.lesson=LESSONS[(LESSONS.indexOf(lesson)+1)%LESSONS.length].id;save();renderTheory();});
}
function earPools(){
 if(state.earType==='interval')return state.difficulty==='basic'?[3,4,5,7,12]:Array.from({length:13},(_,i)=>i);
 if(state.earType==='chord')return state.difficulty==='basic'?['Major','Minor','Diminished','Augmented']:['Major','Minor','Diminished','Augmented','Major 7','Minor 7','Dominant 7','Half-diminished 7','Sus4'];
 if(state.earType==='scale')return state.difficulty==='basic'?['Major (Ionian)','Natural Minor (Aeolian)','Major Pentatonic','Minor Pentatonic']:['Major (Ionian)','Natural Minor (Aeolian)','Harmonic Minor','Dorian','Phrygian','Lydian','Mixolydian','Major Pentatonic','Minor Pentatonic'];
 return [];
}
function newEar(){
 safeSound(()=>A.stopExamples());const pool=earPools(),root=60+Math.floor(Math.random()*12);let correct,ns;
 if(state.earType==='repeat'){correct=root%12;ns=[root];}
 else{correct=pool[Math.floor(Math.random()*pool.length)];if(state.earType==='interval')ns=[root,root+correct];else ns=T.midi(T.ROOTS[root%12],state.earType==='chord'?T.CHORDS[correct]:T.SCALES[correct],4,0);if(state.earType==='scale')ns.push(ns[0]+12);}
 ear={correct,notes:ns,resolved:false,success:false,answer:null,root};render();playEar();
}
function playEar(){if(!ear)return;let ns=ear.notes.slice(),harmonic=state.earType==='chord'||(state.earType==='interval'&&state.direction==='harmonic');if(state.earType==='interval'&&state.direction==='down')ns.reverse();safeSound(()=>A.sequence(ns.map((n,i)=>({note:n,at:harmonic?0:i*.45,duration:harmonic?1.2:.43}))));}
function earName(x){return state.earType==='interval'?T.INTERVALS[x]:state.earType==='repeat'?T.display(T.ROOTS[x]):x;}
function answerEar(answer){if(!ear||ear.resolved)return;ear.resolved=true;ear.answer=answer;ear.success=answer===ear.correct;const stats=state.stats.ear[state.earType]||(state.stats.ear[state.earType]={attempts:0,correct:0});stats.attempts++;if(ear.success)stats.correct++;save();renderEar();renderKeyboard();}
function renderEar(){
 const stats=state.stats.ear[state.earType]||{attempts:0,correct:0},pool=earPools();
 let html=hero('SŁUCH · ROZPOZNAWANIE I PAMIĘĆ','Najpierw usłysz. Potem nazwij.','Wysokość bazowa zmienia się w każdym pytaniu. Słuchaj wielokrotnie; punktowana jest wyłącznie pierwsza odpowiedź.','<strong>'+(stats.attempts?Math.round(100*stats.correct/stats.attempts):0)+'%</strong>poprawnych odpowiedzi');
 html+='<div class="two-col"><section class="card"><div class="fields">'+select('earType','ĆWICZENIE',[['interval','Interwały'],['chord','Akordy'],['scale','Skale'],['repeat','Odtwórz usłyszany dźwięk']],state.earType)+select('difficulty','ZAKRES',[['basic','Podstawowy'],['full','Rozszerzony']],state.difficulty)+'</div>'+(state.earType==='interval'?select('direction','SPOSÓB ODTWARZANIA',[['up','W górę'],['down','W dół'],['harmonic','Jednocześnie']],state.direction):'')+'<div class="ear-orb" aria-hidden="true">♪</div><p class="question center">'+(!ear?'Gotowy na pytanie?':ear.resolved?esc(earName(ear.correct)):state.earType==='repeat'?'Znajdź usłyszany dźwięk':'Co słyszysz?')+'</p><div class="actions"><button id="newEar" class="primary">'+(ear?'Następne pytanie':'Nowe pytanie')+'</button><button id="replayEar" '+(!ear?'disabled':'')+'>↻ Posłuchaj ponownie</button></div><div class="stats"><div class="stat"><b>'+stats.correct+'/'+stats.attempts+'</b><small>trafienia / próby</small></div><div class="stat"><b>'+Object.values(state.stats.ear).reduce((n,s)=>n+s.attempts,0)+'</b><small>wszystkie pytania</small></div></div></section><section class="card"><h2>Twoja odpowiedź</h2>';
 if(state.earType==='repeat')html+='<p>Zagraj dźwięk na ekranie, klawiaturze komputerowej lub MIDI. Dowolna oktawa jest poprawna. To ćwiczenie pamięci wysokości, bez nagrywania mikrofonu.</p>';
 else html+='<div class="answers">'+pool.map((x,i)=>'<button data-ear-answer="'+i+'" '+(!ear||ear.resolved?'disabled':'')+'>'+esc(earName(x))+'</button>').join('')+'</div>';
 html+=ear&&ear.resolved?'<p class="feedback '+(ear.success?'':'wrong')+'">'+(ear.success?'✓ Trafione.':'Jeszcze nie. Poprawnie: '+esc(earName(ear.correct))+'.')+'</p><p class="hint">Dźwięki pytania: '+ear.notes.map(n=>T.name(n)).join(' · ')+'. Odtwórz przykład jeszcze raz, już znając odpowiedź.</p>':'<p class="hint">Klawiatura nie podświetla odpowiedzi przed rozwiązaniem. Rozpoznawanie skal opiera się na ich wzorze w ruchu w górę, a nie na analizie całego utworu.</p>';
 html+='</section></div>';$('content').innerHTML=html;
 ['earType','difficulty','direction'].forEach(k=>mapState(k,k,()=>{ear=null;safeSound(()=>A.stopExamples());render();}));bind('newEar','click',newEar);bind('replayEar','click',playEar);
 document.querySelectorAll('[data-ear-answer]').forEach(b=>b.onclick=()=>answerEar(pool[+b.dataset.earAnswer]));
}
function newTask(random){
 safeSound(()=>A.stopExamples());if(random)state.root=T.ROOTS[Math.floor(Math.random()*12)];
 const type=state.practiceType;let ns=type==='chord'?T.midi(state.root,T.CHORDS[state.chord],3,0):type==='scale'?T.midi(state.root,T.SCALES[state.scale],3,0):[60+Math.floor(Math.random()*12)];if(type==='scale')ns.push(ns[0]+12);
 task={type,root:state.root,chord:state.chord,scale:state.scale,notes:ns,index:0,done:false,feedback:'Zagraj pierwszy dźwięk.',error:false};state.octave=Math.max(0,Math.floor(ns[0]/12)-1);save();
}
function checkPractice(note){
 if(!task||task.done)return;
 if(task.type==='chord'){
  if(T.samePitches(activePitches(),task.notes)){task.done=true;task.feedback='✓ Poprawny zestaw dźwięków. Akord zaliczony.';}
  else{task.feedback='Zbierz wszystkie składniki jednocześnie, bez dodatkowych dźwięków.';updateTask();return;}
 }else{
  const expected=task.notes[task.index],okay=task.type==='note'?note%12===expected%12:note===expected;
  if(!okay){state.stats.misses++;task.feedback='Spróbuj jeszcze raz. Teraz: '+T.name(expected)+(task.type==='scale'?' (w tej oktawie).':' (dowolna oktawa).');task.error=true;saveSoon();updateTask();return;}
  task.index++;task.error=false;task.done=task.index===task.notes.length;task.feedback=task.done?'✓ Zadanie ukończone. Dobra robota.':'Dobrze. Następny dźwięk: '+T.name(task.notes[task.index]);
 }
 if(task.done){task.error=false;state.stats.practice++;save();}updateTask();
 // Keyboard does not jump under an active touch; follow happens after key release / next task.
}
function updateTask(){if($('taskFeedback')){$('taskFeedback').textContent=task.feedback;$('taskFeedback').classList.toggle('wrong',task.error);}if($('taskTarget'))$('taskTarget').textContent=task.done?'Zaliczone!':task.type==='chord'?T.display(task.root)+' '+task.chord:T.name(task.notes[task.index]);if($('taskProgress'))$('taskProgress').style.width=(task.done?100:100*task.index/task.notes.length)+'%';}
function renderPractice(){
 if(!task||task.type!==state.practiceType)newTask(false);
 let html=hero('PRAKTYKA · EKRAN / QWERTY / MIDI','Wiedza pod palcami.','Zadania korzystają z tej samej klawiatury co Studio. System sprawdza dźwięki, nie technikę dłoni.','<strong>'+state.stats.practice+'</strong>ukończonych zadań');
 html+='<div class="two-col"><section class="card"><div class="fields">'+select('practiceType','ZADANIE',[['note','Znajdź dźwięk'],['scale','Skala krok po kroku'],['chord','Zagraj akord']],state.practiceType)+select('practiceRoot','ROOT',T.ROOTS,state.root)+'</div>'+(state.practiceType==='scale'?select('practiceScale','SKALA',Object.keys(T.SCALES),state.scale):state.practiceType==='chord'?select('practiceChord','AKORD',Object.keys(T.CHORDS),state.chord):'')+'<div class="eyebrow" style="margin-top:24px">'+(task.type==='chord'?'ZAGRAJ JEDNOCZEŚNIE':'TERAZ ZAGRAJ')+'</div><div class="question" id="taskTarget"></div><div class="progressbar"><div id="taskProgress"></div></div><p class="feedback" id="taskFeedback"></p><div class="actions"><button id="nextTask" class="primary">Nowe zadanie</button><button id="hearTask">Posłuchaj wzoru</button><button id="showTarget">Pokaż rejestr</button></div></section><section class="card"><h2>Wzór do zagrania</h2><div class="pills">'+task.notes.map((n,i)=>'<span class="pill"><b>'+T.name(n)+'</b><small>'+(i+1)+'</small></span>').join('')+'</div><p class="hint">'+(task.type==='chord'?'Dowolny przewrót i oktawa. Trzymaj dokładnie właściwe klasy wysokości; podwojenia oktawowe są dozwolone. Nie trzeba naciskać wszystkich klawiszy w tej samej milisekundzie. Sustain nie zastępuje fizycznego trzymania składników.':task.type==='scale'?'Graj kolejno w podanej oktawie. W razie potrzeby zmień rejestr przyciskami −/+ lub użyj „Pokaż rejestr”. Pomyłka nie cofa ukończonych kroków.':'Znajdź wskazaną nazwę. W tym zadaniu dowolna oktawa jest poprawna.')+'</p><div class="stats"><div class="stat"><b>'+state.stats.notes+'</b><small>zagranych dźwięków</small></div><div class="stat"><b>'+state.stats.misses+'</b><small>pomyłek w zadaniach nutowych</small></div></div></section></div>';
 $('content').innerHTML=html;updateTask();mapState('practiceType','practiceType',()=>{newTask(false);render();});mapState('practiceRoot','root',()=>{newTask(false);render();});mapState('practiceScale','scale',()=>{newTask(false);render();});mapState('practiceChord','chord',()=>{newTask(false);render();});
 bind('nextTask','click',()=>{releaseLocal();newTask(true);render();});bind('hearTask','click',()=>playNotes(task.notes,task.type!=='chord'));bind('showTarget','click',()=>{follow(task.notes[Math.min(task.index,task.notes.length-1)]);});
}
function metroConfig(){const m=meters[state.meter];return {bpm:state.bpm,beats:m.beats,sub:m.sub||state.sub,mask:m.mask};}
function startMetro(){metroOn=!metroOn;safeSound(()=>A.metro(metroOn,metroConfig()));renderMetro();}
function changeMetro(){state.bpm=Math.max(30,Math.min(240,Math.round(state.bpm)));save();if(metroOn)safeSound(()=>A.metro(true,metroConfig()));renderMetro();}
function renderMetro(){
 const m=meters[state.meter],cfg=metroConfig();
 $('content').innerHTML=hero('PULS · PODZIAŁ · AKCENT','Czas na dobry rytm.','Na Androidzie klik generuje natywny zegar audio. Metronom zatrzymuje się po opuszczeniu aplikacji.','<strong>30–240</strong>BPM')+'<div class="two-col"><section class="card center"><div class="eyebrow">TEMPO</div><div class="bpm-number">'+state.bpm+' <small>BPM</small></div><div class="bpm-controls"><button id="bpmDown" aria-label="Tempo minus jeden">−</button><input id="bpm" type="number" min="30" max="240" value="'+state.bpm+'" aria-label="Tempo BPM"><button id="bpmUp" aria-label="Tempo plus jeden">+</button></div><div class="beat-dots">'+Array.from({length:cfg.beats},(_,i)=>'<span class="beat" data-beat="'+i+'">'+(i+1)+'</span>').join('')+'</div><div class="actions"><button id="metroStart" class="primary">'+(metroOn?'■ Zatrzymaj':'▶ Uruchom')+'</button><button id="tapTempo">Tap tempo</button></div><p class="hint">Jednostka BPM: <strong>'+m.unit+'</strong>.<br>Podział pulsu: '+cfg.sub+'. <span id="subBeat">Metronom '+(metroOn?'włączony':'wyłączony')+'.</span></p></section><section class="card"><h2>Ustawienia rytmu</h2><div class="fields">'+select('meter','METRUM',Object.keys(meters),state.meter)+select('sub','PODZIAŁ PULSU',[[1,'1 · główne pulsy'],[2,'2 · równe ósemki'],[3,'3 · triole'],[4,'4 · szesnastki']],state.sub)+'</div><p class="hint">6/8, 9/8 i 12/8 używają pulsów ćwierćnuty z kropką oraz podziału na trzy. 7/8 liczymy ósemkami, akcentując 2+2+3. W tych metrach podział jest ustawiany automatycznie.</p><h3 style="margin-top:24px">Ćwiczenie na dzisiaj</h3><p>Ustaw 60 BPM. Najpierw graj jeden dźwięk na puls, następnie dwa. Nie przyspieszaj przy gęstszym podziale. Zakończ czterema pulsami ciszy, cały czas licząc.</p><p class="muted">Słuchawki przewodowe lub głośnik urządzenia ułatwiają ocenę zgodności kliknięcia z grą. Latencja zależy od sprzętu i toru audio.</p></section></div>';
 $('sub').disabled=!!m.sub;
 bind('bpm','change',e=>{const n=+e.target.value;if(Number.isFinite(n)){state.bpm=n;changeMetro();}});bind('bpmDown','click',()=>{state.bpm--;changeMetro();});bind('bpmUp','click',()=>{state.bpm++;changeMetro();});mapState('meter','meter',changeMetro);mapState('sub','sub',changeMetro);bind('metroStart','click',startMetro);
 bind('tapTempo','click',()=>{const now=performance.now();if(taps.length&&now-taps[taps.length-1]>2500)taps=[];taps.push(now);if(taps.length>6)taps.shift();if(taps.length>=2){const gaps=taps.slice(1).map((v,i)=>v-taps[i]).sort((a,b)=>a-b),ms=gaps[Math.floor(gaps.length/2)];if(ms>0){state.bpm=Math.round(60000/ms);changeMetro();}}else toast('Stukaj regularnie, aby ustawić tempo.');});
}
function midiDevices(){if(!A.native)return {available:false,inputs:[],outputs:[]};try{return JSON.parse(NativePiano.devices());}catch(e){return {available:false,inputs:[],outputs:[]};}}
function renderMidi(){
 const devices=midiDevices(),ports=arr=>arr.length?arr.map(p=>[p.id+':'+p.port,p.name]):[['','Brak dostępnych portów']];
 $('content').innerHTML=hero('POŁĄCZENIA · PRYWATNOŚĆ · PERSONALIZACJA','Twój instrument. Twoje studio.','Wbudowane MIDI Androida, lokalne dane i brak konta. Wszystkie funkcje edukacyjne działają bez połączenia z internetem.','<strong>'+ (A.native?'Android':'WWW')+'</strong>'+(A.native?'natywne MIDI':'podgląd interfejsu'))+'<div class="two-col"><section class="card"><h2>Instrument zewnętrzny</h2><div class="status-box" id="midiStatus">'+esc(midiText)+'</div><div class="fields" style="margin-top:18px">'+select('midiInput','WEJŚCIE · INSTRUMENT → APLIKACJA',ports(devices.inputs),'')+select('midiOutput','WYJŚCIE · EKRAN → INSTRUMENT',ports(devices.outputs),'')+'</div><div class="actions"><button id="connectInput" class="primary" '+(!devices.inputs.length?'disabled':'')+'>Połącz wejście</button><button id="connectOutput" '+(!devices.outputs.length?'disabled':'')+'>Połącz wyjście</button><button id="refreshMidi">Odśwież</button><button id="disconnectMidi">Rozłącz</button></div><div class="actions"><button id="enableAudio">Włącz dźwięk</button></div><p id="midiLast" class="hint">Zagraj dźwięk, aby zobaczyć jego numer MIDI.</p><p class="hint">'+(A.native?'Podłącz zgodny instrument USB MIDI 1.0 przez kabel danych i, gdy potrzebny, adapter USB host/OTG. Wybierz port urządzenia. Velocity i CC64 sustain są obsługiwane. Dane wejściowe nie są odsyłane do MIDI, aby nie tworzyć pętli. Wyjście wysyła ekran/QWERTY na kanale 1.':'Podgląd WWW obsługuje dźwięk, dotyk i QWERTY. Natywne porty MIDI są dostępne w wersji APK, nie w tym podglądzie.')+'</p><p class="muted" style="margin-top:15px">Brak własnego parowania Bluetooth MIDI, MIDI 2.0/UMP oraz nagrywania audio. Moduł nie wymaga mikrofonu ani dostępu do plików. Urządzenie musi udostępniać port obsługiwany przez Androida.</p></section><section class="card"><h2>Brzmienie i wygląd</h2><div class="fields">'+select('tone','BRZMIENIE',[[0,'Piano-like · synteza'],[1,'Sine · czysty ton']],state.tone)+select('palette','PALETA',['lavender','mint','peach','sky'],state.palette)+select('octaves','WIDOK KLAWIATURY',[[0,'Automatyczny'],[1,'1 oktawa'],[2,'Do 2 oktaw'],[3,'Do 3 oktaw']],state.octaves)+select('velocity','DYNAMIKA EKRAN / QWERTY',[[55,'Delikatnie · 55'],[80,'Średnio · 80'],[95,'Standard · 95'],[115,'Mocno · 115']],state.velocity)+'</div><label>GŁOŚNOŚĆ APLIKACJI<input type="range" id="volume" min="0" max="1" step="0.01" value="'+state.volume+'"></label><p class="hint">Piano-like jest brzmieniem syntezowanym, nie biblioteką próbek fortepianu. MIDI zachowuje velocity z instrumentu. Wybór liczby oktaw ogranicza się automatycznie na małym ekranie, aby etykiety nie nachodziły na siebie.</p><h3 style="margin-top:22px">Postępy i prywatność</h3><p class="muted">Ustawienia, wyniki i oznaczone lekcje pozostają wyłącznie w danych aplikacji na tym urządzeniu. Brak reklam, analityki i wysyłania danych. Zdarzenia MIDI są przetwarzane chwilowo, bez zapisu nagrań. Odinstalowanie lub wyczyszczenie danych usuwa postępy.</p><button id="resetProgress" class="danger">Wyzeruj postępy</button><details style="margin-top:20px"><summary>Źródła i zakres materiału</summary><p class="source-note">Autorskie definicje i ćwiczenia; odniesienie: Open Music Theory, rozdziały o skalach, interwałach, triadach, metrum i harmonii — viva.pressbooks.pub/openmusictheory/; zweryfikowane rozdziały OMT 2e są także w Humanities LibreTexts. Implementacja MIDI i audio: developer.android.com/reference/android/media/midi oraz developer.android.com/reference/android/media/AudioTrack. Zestawy nut używają stroju równomiernie temperowanego. Atlas nie jest analizatorem nagrania ani substytutem nauczyciela techniki.</p></details></section></div>';
 bind('connectInput','click',()=>{const p=$('midiInput').value.split(':');if(p.length===2)NativePiano.connectInput(+p[0],+p[1]);});bind('connectOutput','click',()=>{const p=$('midiOutput').value.split(':');if(p.length===2)NativePiano.connectOutput(+p[0],+p[1]);});bind('refreshMidi','click',renderMidi);bind('disconnectMidi','click',()=>{if(A.native)NativePiano.disconnect();else toast('MIDI jest dostępne w APK Android.');});bind('enableAudio','click',()=>safeSound(()=>{A.init();toast('Dźwięk włączony. Zagraj na klawiaturze.');}));
 mapState('tone','tone',()=>A.settings(state.volume,state.tone));mapState('palette','palette',theme);mapState('octaves','octaves',renderKeyboard);mapState('velocity','velocity');bind('volume','input',e=>{state.volume=+e.target.value;safeSound(()=>A.settings(state.volume,state.tone));saveSoon();});
 bind('resetProgress','click',()=>{if(confirm('Usunąć wszystkie lokalne wyniki i oznaczenia lekcji? Tej operacji nie można cofnąć.')){state.stats=JSON.parse(JSON.stringify(defaults.stats));save();toast('Postępy wyzerowane.');renderMidi();}});
}
window.nativeEvent=function(type,data){
 if(type==='beat'){if(!metroOn)return;const cfg=metroConfig(),beat=Math.floor(data.step/cfg.sub);currentBeat=beat;document.querySelectorAll('[data-beat]').forEach(b=>b.classList.toggle('current',+b.dataset.beat===beat));if($('subBeat'))$('subBeat').textContent='Puls '+(beat+1)+' · część '+(data.step%cfg.sub+1)+'/'+cfg.sub;}
 if(type==='error')toast(data);
 if(type==='midiStatus'){midiText=data;if($('midiStatus'))$('midiStatus').textContent=data;}
 if(type==='reset')resetAudio(false);
 if(type==='midi'){
  const kind=data.status&240,ch=data.status&15,id=10000+ch*128+data.a;
  if(kind===144&&data.b>0)begin(id,data.a,data.b,true);
  else if(kind===128||(kind===144&&data.b===0))end(id);
  else if(kind===176&&(data.a===120||data.a===123)){Array.from(held.keys()).filter(k=>k>=10000&&Math.floor((k-10000)/128)===ch).forEach(end);}
 }
};
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderKeyboard,100);});
window.NextPiano={version:'2.0.0',getState:()=>JSON.parse(JSON.stringify(state)),go:view};
theme();safeSound(()=>A.settings(state.volume,state.tone));render();
})();
