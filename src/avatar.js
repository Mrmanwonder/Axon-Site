// Axon avatar presets. No user photographs are stored or uploaded.
// Every preset is either a static CSS gradient or an original dot-grid SVG.

const DOT_FACES = [
  ["dotFace01","Dot 01","2,5;3,4;4,3;5,3;6,4;7,5;2,6;7,6;3,7;6,7;3,9;4,10;5,10;6,9;2,11;7,11;3,12;4,13;5,13;6,12"],
  ["dotFace02","Dot 02","2,4;3,3;4,3;5,3;6,3;7,4;1,6;2,5;7,5;8,6;2,7;7,7;3,9;6,9;3,11;4,12;5,12;6,11"],
  ["dotFace03","Dot 03","2,5;3,4;4,3;5,3;6,4;7,5;2,6;7,6;1,7;8,7;3,8;6,8;3,10;4,11;5,11;6,10;2,12;7,12"],
  ["dotFace04","Dot 04","2,4;3,3;4,2;5,2;6,3;7,4;2,5;7,5;2,7;7,7;3,8;6,8;3,10;4,10;5,10;6,10;3,12;4,13;5,13;6,12"],
  ["dotFace05","Dot 05","1,5;2,4;3,3;4,3;5,3;6,4;7,5;2,6;7,6;2,8;3,7;6,7;7,8;3,10;6,10;3,12;4,12;5,12;6,12"],
  ["dotFace06","Dot 06","2,3;3,2;4,2;5,2;6,3;7,4;2,5;7,5;1,6;8,6;3,7;6,7;3,9;6,9;3,11;4,12;5,12;6,11"],
  ["dotFace07","Dot 07","2,5;3,3;4,2;5,2;6,3;7,5;2,6;7,6;3,7;6,7;2,9;3,9;6,9;7,9;3,11;4,12;5,12;6,11"],
  ["dotFace08","Dot 08","1,4;2,3;3,3;4,2;5,2;6,3;7,4;2,5;7,5;2,7;7,7;3,8;6,8;3,10;4,11;5,11;6,10;3,12;6,12"],
].map(([key,title,cells]) => ({
  key,title,kind:'dot-face',type:'dot-face',auto:false,
  c:['#19191d','#6f6f78','#f1f1f4'],
  cells: cells.split(';').map((pair) => pair.split(',').map(Number)),
}));

export const PRESETS = [
  { key:'halo', title:'Halo', kind:'gradient', type:'plane', auto:false, c:['#ff5005','#dbba95','#d0bce1'] },
  { key:'pensive', title:'Pensive', kind:'gradient', type:'sphere', c:['#809bd6','#910aff','#af38ff'] },
  { key:'mint', title:'Mint', kind:'gradient', type:'waterPlane', c:['#94ffd1','#6bf5ff','#ffffff'] },
  { key:'interstella', title:'Interstella', kind:'gradient', type:'sphere', c:['#73bfc4','#ff810a','#8da0ce'] },
  { key:'nightyNight', title:'Nighty night', kind:'gradient', type:'waterPlane', c:['#606080','#8d7dca','#212121'] },
  { key:'violaOrientalis', title:'Viola', kind:'gradient', type:'sphere', c:['#ffffff','#ffbb00','#0700ff'] },
  { key:'universe', title:'Universe', kind:'gradient', type:'waterPlane', c:['#5606ff','#fe8989','#000000'] },
  { key:'sunset', title:'Sunset', kind:'gradient', type:'sphere', c:['#ff7a33','#33a0ff','#ffc53d'] },
  { key:'mandarin', title:'Mandarin', kind:'gradient', type:'waterPlane', auto:false, c:['#ff6a1a','#c73c00','#FD4912'] },
  { key:'cottonCandy', title:'Cotton Candy', kind:'gradient', type:'waterPlane', c:['#ebedff','#f3f2f8','#dbf8ff'] },

  // Seven original soft volumetric families from the product spec.
  { key:'dreamBloom', title:'Dream Bloom', kind:'gradient', type:'volumetric', c:['#f6ddff','#7ee8ff','#5137d8','#19193e'] },
  { key:'aquaViolet', title:'Aqua Violet', kind:'gradient', type:'volumetric', c:['#bafcff','#50d8e8','#7959ef','#22234b'] },
  { key:'midnightLime', title:'Midnight Lime', kind:'gradient', type:'volumetric', c:['#e6ff8b','#78e7a8','#2447b8','#11152c'] },
  { key:'emberViolet', title:'Ember Violet', kind:'gradient', type:'volumetric', c:['#ffd0b0','#ff775f','#8e4be8','#251339'] },
  { key:'citrusMint', title:'Citrus Mint', kind:'gradient', type:'volumetric', c:['#fff29d','#c7f889','#58d9b0','#1e4b59'] },
  { key:'frostCobalt', title:'Frost Cobalt', kind:'gradient', type:'volumetric', c:['#f2fbff','#a2d4ff','#4167df','#17245d'] },
  { key:'copperRose', title:'Copper Rose', kind:'gradient', type:'volumetric', c:['#ffd5c2','#d88778','#9a5a8f','#3e243f'] },
  ...DOT_FACES,
];

const AUTO = PRESETS.filter((p) => p.auto !== false && p.kind !== 'dot-face');
const BY_KEY = new Map(PRESETS.map((p) => [p.key,p]));

function hash(str) {
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); }
  return h>>>0;
}

export function presetFor({ id='', avatar_seed=null }={}) {
  if(avatar_seed && BY_KEY.has(avatar_seed)) return BY_KEY.get(avatar_seed);
  return AUTO[hash(String(avatar_seed||id)) % AUTO.length];
}

export function isChosen(student) {
  return !!student?.avatar_seed && BY_KEY.has(student.avatar_seed);
}

function luminance(hex) {
  const h=hex.replace('#','');
  const n=parseInt(h.length===3?h.replace(/./g,(c)=>c+c):h,16);
  const [r,g,b]=[(n>>16)&255,(n>>8)&255,n&255].map((v)=>{
    const s=v/255; return s<=.03928?s/12.92:((s+.055)/1.055)**2.4;
  });
  return .2126*r+.7152*g+.0722*b;
}

function dotFaceSvg(preset) {
  const dots=preset.cells.map(([x,y],i)=>{
    const fill=i%7===0 ? '#73737e' : '#202026';
    return `<circle cx="${(x+2)*2}" cy="${(y+1)*2}" r=".72" fill="${fill}"/>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32"><g>${dots}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function backgroundFor(preset) {
  if(preset.kind==='dot-face') {
    return `${dotFaceSvg(preset)} center/78% 78% no-repeat, radial-gradient(circle at 30% 20%, #f4f4f7, #d8d8de 78%)`;
  }
  const [a,b,c,d=c] = preset.c;
  switch(preset.type) {
    case 'sphere':
      return `radial-gradient(circle at 30% 24%, ${a} 0%, transparent 58%),radial-gradient(circle at 74% 76%, ${c} 0%, transparent 62%),linear-gradient(150deg, ${b} 12%, ${c} 88%)`;
    case 'plane':
      return `radial-gradient(120% 100% at 12% 8%, ${a} 0%, transparent 55%),linear-gradient(140deg, ${b} 0%, ${c} 100%)`;
    case 'volumetric':
      return `radial-gradient(88% 78% at 18% 16%, ${a} 0%, transparent 58%),radial-gradient(76% 72% at 78% 26%, ${b} 0%, transparent 62%),radial-gradient(88% 80% at 62% 86%, ${c} 0%, transparent 64%),linear-gradient(155deg, ${d} 0%, ${c} 100%)`;
    default:
      return `radial-gradient(70% 60% at 22% 30%, ${a} 0%, transparent 70%),radial-gradient(70% 60% at 78% 68%, ${b} 0%, transparent 70%),linear-gradient(160deg, ${c} 0%, ${b} 100%)`;
  }
}

export function inkFor(preset) {
  if(preset.kind==='dot-face') return 'transparent';
  const mean=preset.c.slice(0,3).reduce((sum,hex)=>sum+luminance(hex),0)/Math.min(3,preset.c.length);
  return mean>.45?'rgba(12,12,16,.82)':'#fff';
}

export function avatarStyleFor(student) {
  const preset=presetFor(student??{});
  return {
    background:backgroundFor(preset),
    color:inkFor(preset),
    preset:preset.key,
    kind:preset.kind||'gradient',
  };
}

export function initialFor(label) {
  return (label??'').trim()[0]?.toUpperCase() ?? '?';
}
