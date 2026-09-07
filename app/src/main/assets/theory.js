/* Original, dependency-free theory model. B is always B natural (never H). */
(function (global) {
  'use strict';
  const ROOTS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const SHARPS = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const FLATS = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  const NAT = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const BASE = [0,2,4,5,7,9,11];
  const SCALES = {
    'Major (Ionian)': ['1','2','3','4','5','6','7'],
    'Natural Minor (Aeolian)': ['1','2','b3','4','5','b6','b7'],
    'Harmonic Minor': ['1','2','b3','4','5','b6','7'],
    'Melodic Minor (ascending)': ['1','2','b3','4','5','6','7'],
    'Dorian': ['1','2','b3','4','5','6','b7'],
    'Phrygian': ['1','b2','b3','4','5','b6','b7'],
    'Lydian': ['1','2','3','#4','5','6','7'],
    'Mixolydian': ['1','2','3','4','5','6','b7'],
    'Locrian': ['1','b2','b3','4','b5','b6','b7'],
    'Major Pentatonic': ['1','2','3','5','6'],
    'Minor Pentatonic': ['1','b3','4','5','b7'],
    'Minor Blues': ['1','b3','4','b5','5','b7'],
    'Major Blues': ['1','2','b3','3','5','6'],
    'Whole Tone': ['1','2','3','#4','#5','b7'],
    'Diminished (half-whole)': ['1','b2','#2','3','#4','5','6','b7'],
    'Diminished (whole-half)': ['1','2','b3','4','b5','b6','6','7'],
    'Lydian Dominant': ['1','2','3','#4','5','6','b7'],
    'Phrygian Dominant': ['1','b2','3','4','5','b6','b7']
  };
  const CHORDS = {
    'Major': ['1','3','5'], 'Minor': ['1','b3','5'], 'Diminished': ['1','b3','b5'],
    'Augmented': ['1','3','#5'], 'Sus2': ['1','2','5'], 'Sus4': ['1','4','5'],
    'Power (5)': ['1','5'], 'Major 6': ['1','3','5','6'], 'Minor 6': ['1','b3','5','6'],
    'Dominant 7': ['1','3','5','b7'], 'Major 7': ['1','3','5','7'], 'Minor 7': ['1','b3','5','b7'],
    'Minor Major 7': ['1','b3','5','7'], 'Half-diminished 7': ['1','b3','b5','b7'],
    'Diminished 7': ['1','b3','b5','bb7'], 'Add9': ['1','3','5','9'], 'Minor Add9': ['1','b3','5','9'],
    'Dominant 9': ['1','3','5','b7','9'], 'Major 9': ['1','3','5','7','9'], 'Minor 9': ['1','b3','5','b7','9'],
    'Dominant 7 sus4': ['1','4','5','b7'], 'Dominant 7 b9': ['1','3','5','b7','b9'],
    'Dominant 7 #9': ['1','3','5','b7','#9'], 'Dominant 13': ['1','3','5','b7','9','13']
  };
  const INTERVALS = ['Perfect unison','Minor 2nd','Major 2nd','Minor 3rd','Major 3rd','Perfect 4th','Tritone','Perfect 5th','Minor 6th','Major 6th','Minor 7th','Major 7th','Perfect octave'];
  const PROGRESSIONS = [
    {name:'Pop · I–V–vi–IV',root:'C',chords:[['C','Major'],['G','Major'],['A','Minor'],['F','Major']]},
    {name:'Jazz · ii–V–I',root:'C',chords:[['D','Minor 7'],['G','Dominant 7'],['C','Major 7']]},
    {name:'Minor · iiø–V–i',root:'A',chords:[['B','Half-diminished 7'],['E','Dominant 7'],['A','Minor']]},
    {name:'Kadencja · I–IV–V–I',root:'C',chords:[['C','Major'],['F','Major'],['G','Major'],['C','Major']]},
    {name:'Minor pop · i–♭VI–♭III–♭VII',root:'A',chords:[['A','Minor'],['F','Major'],['C','Major'],['G','Major']]},
    {name:'Turnaround · I–vi–ii–V',root:'C',chords:[['C','Major 7'],['A','Minor 7'],['D','Minor 7'],['G','Dominant 7']]},
    {name:'12-bar blues · C',root:'C',chords:[['C','Dominant 7'],['C','Dominant 7'],['C','Dominant 7'],['C','Dominant 7'],['F','Dominant 7'],['F','Dominant 7'],['C','Dominant 7'],['C','Dominant 7'],['G','Dominant 7'],['F','Dominant 7'],['C','Dominant 7'],['G','Dominant 7']]}
  ];
  function mod(n,m) { return ((n % m) + m) % m; }
  function pc(root) { const r = root.replace(/♯/g,'#').replace(/♭/g,'b'); if (!/^[A-G][#b]*$/.test(r)) throw Error('Invalid note'); return mod(NAT[r[0]] + r.slice(1).split('').reduce((a,x)=>a+(x==='#'?1:-1),0),12); }
  function display(s) { return s.replace(/b/g,'♭').replace(/#/g,'♯'); }
  function degree(d) { const m = /^([b#]*)(\d+)$/.exec(d); if (!m) throw Error('Invalid degree'); const n = +m[2]; return {n:n, semitones:BASE[(n-1)%7]+12*Math.floor((n-1)/7)+m[1].split('').reduce((a,x)=>a+(x==='#'?1:-1),0)}; }
  function spell(root, d) {
    const letters='CDEFGAB', item=degree(d), letter=letters[mod(letters.indexOf(root[0])+item.n-1,7)];
    const target=mod(pc(root)+item.semitones,12), diff=mod(target-NAT[letter]+6,12)-6;
    return letter + (diff<0?'♭'.repeat(-diff):'♯'.repeat(diff));
  }
  function notes(root, formula) { return formula.map(d=>({degree:display(d),name:spell(root,d),pc:mod(pc(root)+degree(d).semitones,12),interval:degree(d).semitones})); }
  function midi(root, formula, octave, inversion) {
    let result=formula.map(d=>12*(octave+1)+pc(root)+degree(d).semitones);
    // Inversions apply to chord voicings; a scale always starts on its root.
    const inv = Object.values(SCALES).includes(formula) ? 0 : mod(inversion || 0,result.length);
    for(let i=0;i<inv;i++){let x=result.shift()+12;while(x<=result[result.length-1])x+=12;result.push(x);}
    while(result[0]<21)result=result.map(n=>n+12);
    while(result[result.length-1]>108)result=result.map(n=>n-12);
    return result;
  }
  function name(note, preferFlats) { return (preferFlats?FLATS:SHARPS)[mod(note,12)] + (Math.floor(note/12)-1); }
  function recognize(held) {
    if (!held.length) return [];
    const sorted=held.slice().sort((a,b)=>a-b), bass=mod(sorted[0],12), pitches=Array.from(new Set(sorted.map(n=>mod(n,12))));
    const matches=[];
    pitches.forEach(root=>Object.keys(CHORDS).forEach(type=>{
      const expected=Array.from(new Set(CHORDS[type].map(d=>mod(root+degree(d).semitones,12))));
      if(expected.length===pitches.length && expected.every(n=>pitches.includes(n))) matches.push({root:root,type:type,bass:bass,label:display(ROOTS[root])+' '+type+(bass!==root?' / '+display(ROOTS[bass]):'')});
    }));
    return matches.sort((a,b)=>(a.root===bass?-1:0)-(b.root===bass?-1:0));
  }
  function diatonic(root, minor) {
    const defs=minor?SCALES['Natural Minor (Aeolian)']:SCALES['Major (Ionian)'];
    const scale=notes(root,defs), types=minor?['Minor','Diminished','Major','Minor','Minor','Major','Major']:['Major','Minor','Minor','Major','Major','Minor','Diminished'];
    const romans=minor?['i','ii°','♭III','iv','v','♭VI','♭VII']:['I','ii','iii','IV','V','vi','vii°'];
    return scale.map((n,i)=>({root:n.name,type:types[i],roman:romans[i]}));
  }
  function diatonicScale(root, formula) {
    if(formula.length!==7)return [];
    const scale=notes(root,formula), romans=['I','II','III','IV','V','VI','VII'];
    return scale.map((n,i)=>{
      const ints=[0,mod(scale[(i+2)%7].pc-n.pc,12),mod(scale[(i+4)%7].pc-n.pc,12)].sort((a,b)=>a-b).join(',');
      const type={'0,4,7':'Major','0,3,7':'Minor','0,3,6':'Diminished','0,4,8':'Augmented'}[ints];
      if(!type)return null;
      let roman=type==='Minor'||type==='Diminished'?romans[i].toLowerCase():romans[i];
      if(type==='Diminished')roman+='°';if(type==='Augmented')roman+='+';
      const alteration=formula[i].replace(/\d/g,'');
      return {root:n.name,type,roman:display(alteration)+roman};
    }).filter(Boolean);
  }
  function samePitches(actual, expected) { const a=Array.from(new Set(actual.map(n=>mod(n,12)))).sort(), b=Array.from(new Set(expected.map(n=>mod(n,12)))).sort(); return a.join(',')===b.join(','); }
  const api={ROOTS,SHARPS,FLATS,SCALES,CHORDS,INTERVALS,PROGRESSIONS,mod,pc,display,degree,spell,notes,midi,name,recognize,diatonic,diatonicScale,samePitches};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else global.Theory=api;
})(typeof window!=='undefined'?window:globalThis);
