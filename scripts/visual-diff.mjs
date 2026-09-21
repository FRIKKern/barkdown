// Tolerant pixels + local tiles. Never an automatic design/behavior verdict.
export function comparePixels(a,b,{tolerance=20,tile=32}={}) {
 if(a.width!==b.width||a.height!==b.height)return {kind:'dimensions',before:[a.width,a.height],after:[b.width,b.height],changedRatio:1};
 const diff=Buffer.alloc(a.data.length),tiles=new Map();let changed=0,error=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const i=(y*a.width+x)*4;let max=0;
  for(let c=0;c<3;c++){const d=Math.abs(a.data[i+c]-b.data[i+c]);max=Math.max(max,d);error+=d;}
  const key=`${Math.floor(x/tile)},${Math.floor(y/tile)}`;const t=tiles.get(key)||{pixels:0,changed:0};t.pixels++;
  if(max>tolerance){changed++;t.changed++;diff[i]=255;diff[i+1]=35;diff[i+2]=85;}else{for(let c=0;c<3;c++)diff[i+c]=Math.round(b.data[i+c]*.35);}
  diff[i+3]=255;tiles.set(key,t);
 }
 const ratio=changed/(a.width*a.height),hotTiles=[...tiles].filter(([,v])=>v.changed/v.pixels>.05).map(([at,v])=>({at,ratio:v.changed/v.pixels}));
 return {kind:ratio===0?'within-tolerance':hotTiles.length||ratio>.001?'review-required':'small-difference',changedRatio:ratio,meanError:error/(a.width*a.height*3),hotTiles,diff};
}
