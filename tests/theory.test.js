'use strict';
const assert=require('node:assert/strict');const T=require('../app/src/main/assets/theory.js');
let count=0;function check(fn){fn();count++;}
check(()=>assert.equal(T.spell('F#','7'),'E♯'));
check(()=>assert.equal(T.spell('C','bb7'),'B♭♭'));
check(()=>assert.deepEqual(T.notes('C',T.SCALES['Natural Minor (Aeolian)']).map(n=>n.name),['C','D','E♭','F','G','A♭','B♭']));
check(()=>assert.deepEqual(T.midi('C',T.CHORDS.Major,4,1),[64,67,72]));
check(()=>assert.equal(T.recognize([64,67,72])[0].label,'C Major / E'));
check(()=>assert.equal(T.recognize([60,64,67])[0].label,'C Major'));
check(()=>assert.equal(T.recognize([60,63,67,70])[0].type,'Minor 7'));
check(()=>assert.deepEqual(T.diatonic('A',true).map(x=>x.roman),['i','ii°','♭III','iv','v','♭VI','♭VII']));
check(()=>assert.equal(T.name(71),'B4'));
check(()=>assert(T.samePitches([60,64,67,72],[48,52,55])));
check(()=>assert(!T.samePitches([60,64,65,67],[60,64,67])));
check(()=>assert.equal(T.diatonicScale('A',T.SCALES['Harmonic Minor'])[4].type,'Major'));
check(()=>assert.equal(T.diatonicScale('C',T.SCALES.Dorian)[3].type,'Major'));
check(()=>assert.deepEqual(T.diatonicScale('C',T.SCALES['Major Pentatonic']),[]));
check(()=>assert(T.midi('C',T.CHORDS.Major,0,0).every(n=>n>=21&&n<=108)));
for(const root of T.ROOTS)for(const formula of [...Object.values(T.SCALES),...Object.values(T.CHORDS)]){
 check(()=>T.notes(root,formula).forEach(n=>assert.equal(T.pc(n.name),n.pc)));
 check(()=>T.midi(root,formula,4,0).forEach((n,i)=>assert.equal(n%12,T.notes(root,formula)[i].pc)));
 for(let inv=0;inv<formula.length;inv++)check(()=>{const ns=T.midi(root,formula,4,inv);assert(T.samePitches(ns,T.midi(root,formula,4,0)));for(let i=1;i<ns.length;i++)assert(ns[i]>ns[i-1]);});
}
console.log(`Theory: ${count} assertions/groups passed.`);
