const {PNG}=require("pngjs"),fs=require("fs");
exports.read=(f)=>{const p=PNG.sync.read(fs.readFileSync(f));return {w:p.width,h:p.height,d:p.data}};
exports.write=(f,im)=>{const p=new PNG({width:im.w,height:im.h});Buffer.from(im.d.buffer||im.d).copy(p.data);fs.writeFileSync(f,PNG.sync.write(p))};
exports.make=(w,h)=>({w,h,d:new Uint8ClampedArray(w*h*4)});

// Cut a subject off a near-white background: border flood fill + edge unmatting.
exports.cutout=(im,{thr=236,band=7,extraBg=null}={})=>{
  const {w,h,d}=im,N=w*h,bg=new Uint8Array(N),q=new Int32Array(N);let qs=0,qe=0;
  const isW=(i)=>Math.min(d[i*4],d[i*4+1],d[i*4+2])>=thr;
  const push=(i)=>{if(!bg[i]&&isW(i)){bg[i]=1;q[qe++]=i}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(qs<qe){const i=q[qs++],x=i%w,y=(i/w)|0;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w)}
  if(extraBg)for(let i=0;i<N;i++)if(extraBg[i])bg[i]=1;   // regions the caller already knows are background (e.g. enclosed floor patches)
  // distance (chebyshev-ish BFS) from background, up to band+3
  const dist=new Int16Array(N).fill(32000);qs=qe=0;
  for(let i=0;i<N;i++)if(bg[i]){dist[i]=0;q[qe++]=i}
  while(qs<qe){const i=q[qs++],x=i%w,y=(i/w)|0,nd=dist[i]+1;if(nd>band+3)continue;
    for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&dist[j]>nd){dist[j]=nd;q[qe++]=j}}
  // nearest interior colour for edge pixels (multi-source BFS from interior)
  const src=new Int32Array(N).fill(-1);qs=qe=0;
  for(let i=0;i<N;i++)if(!bg[i]&&dist[i]>band){src[i]=i;q[qe++]=i}
  while(qs<qe){const i=q[qs++],x=i%w,y=(i/w)|0;
    for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&src[j]<0&&!bg[j]){src[j]=src[i];q[qe++]=j}}
  const out=exports.make(w,h);
  for(let i=0;i<N;i++){const o=i*4;
    if(bg[i])continue;
    if(dist[i]>band||src[i]<0){out.d[o]=d[o];out.d[o+1]=d[o+1];out.d[o+2]=d[o+2];out.d[o+3]=255;continue}
    const s=src[i]*4,fr=d[s],fg=d[s+1],fb=d[s+2];
    const vr=255-fr,vg=255-fg,vb=255-fb,vv=vr*vr+vg*vg+vb*vb;
    let a=1;if(vv>150){a=((255-d[o])*vr+(255-d[o+1])*vg+(255-d[o+2])*vb)/vv}
    a=Math.max(0,Math.min(1,a));if(a>0.97)a=1;
    out.d[o+3]=Math.round(a*255);
    // foreground colour: blend toward the interior colour as alpha drops
    const k=a>0.02?a:1;
    for(let c=0;c<3;c++){const v=(d[o+c]-(1-a)*255)/(a>0.02?a:1);out.d[o+c]=a<1?Math.max(0,Math.min(255,v*0.5+d[s+c]*0.5)):d[o+c]}
  }
  return out;
};
exports.bbox=(im,minA=8)=>{let x0=im.w,y0=im.h,x1=-1,y1=-1;for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++)if(im.d[(y*im.w+x)*4+3]>minA){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}return {x0,y0,x1,y1}};
exports.crop=(im,x0,y0,w,h)=>{const o=exports.make(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=x+x0,sy=y+y0;if(sx<0||sy<0||sx>=im.w||sy>=im.h)continue;const s=(sy*im.w+sx)*4,t=(y*w+x)*4;o.d[t]=im.d[s];o.d[t+1]=im.d[s+1];o.d[t+2]=im.d[s+2];o.d[t+3]=im.d[s+3]}return o};
exports.onBg=(im,rgb)=>{const o=exports.make(im.w,im.h);for(let i=0;i<im.w*im.h;i++){const a=im.d[i*4+3]/255;for(let c=0;c<3;c++)o.d[i*4+c]=im.d[i*4+c]*a+rgb[c]*(1-a);o.d[i*4+3]=255}return o};
