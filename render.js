import {FONTS,blockStyle,blockFontSize} from './core.js';
import {layoutCards} from './cards.js';
const hexAlpha=(hex,a)=>`${hex}${Math.round(a*255).toString(16).padStart(2,'0')}`;
const graphemes=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
const segments=text=>graphemes?[...graphemes.segment(text)].map(v=>({text:v.segment,index:v.index})):Array.from(text).map((t,i,a)=>({text:t,index:a.slice(0,i).join('').length}));
const closePunct=/^[，。！？；：、）》」』】…,.!?;:)\]]$/;
function fontFor(style,size,attrs={},type='body') {return `${attrs.italic?'italic ':''}${attrs.bold||type==='h1'||type==='h2'?'600':'400'} ${size}px ${type==='code'&&!style.customBlockFont?FONTS.mono:FONTS[style.font]||`"${style.font}"`}`;}
function attrsAt(block,index){const a={};for(const s of block.spans||[])if(index>=s.start && index<s.end)for(const k of ['bold','italic','underline','strike','mark','color'])if(s[k])a[k]=s[k];return a;}
function charRuns(ctx,block,style,size,text=block.text) {
  return segments(text).map(v=>{const a=attrsAt(block,v.index);ctx.font=fontFor(style,size,a,block.type);return {...v,attrs:a,width:ctx.measureText(v.text).width+style.letterSpacing};});
}
function wrap(ctx,block,style,size,maxWidth,text=block.text,firstIndent=0) {
  const chars=charRuns(ctx,block,style,size,text),lines=[];let line=[],w=0;
  const push=()=>{lines.push({chars:line,width:w});line=[];w=0;};
  for(const ch of chars){
    if(ch.text==='\n'){push();continue;}
    if(w+ch.width>maxWidth-(lines.length===0?firstIndent:0) && line.length){
      if(closePunct.test(ch.text) && line.length>1){const previous=line.pop();w-=previous.width;push();line.push(previous);w+=previous.width;}
      else push();
    }
    line.push(ch);w+=ch.width;
  }
  if(line.length||!lines.length)push();return lines;
}
export async function layoutDocument(doc,assets) {
  const s=doc.style,W=s.width,M=Math.min(s.margin,W/4),bodyW=W-2*M,errors=[];
  const fonts=[s.font,...doc.blocks.map(b=>b.textStyle?.font).filter(Boolean)];
  await Promise.all([...new Set(fonts)].map(async font=>{try{await assets.font(font);}catch(e){errors.push(e.message);}}));
  await document.fonts.ready;
  const images=new Map(),srcs=[s.logo,s.backgroundImage,...doc.blocks.filter(b=>b.type==='image').map(b=>b.src)].filter(Boolean);
  if(doc.blocks.some(b=>b.type==='image'&&!b.src))errors.push('有图片段落尚未设置图片，请上传图片或填写链接');
  await Promise.all([...new Set(srcs)].map(async src=>{try{images.set(src,await assets.image(src));}catch(e){errors.push(`${e.message}（${src.startsWith('asset:')?'本地素材':src.slice(0,60)}）`);}}));
  const measure=document.createElement('canvas').getContext('2d'),paged=s.pageMode==='pages'||s.columns===2;
  if(['excerpt','editorial','collage'].includes(s.layout))return layoutCards(doc,images,errors,measure,{wrap});
  const PH=s.pageHeight,top=64,bottom=64,colGap=32,cols=s.layout==='vertical'?1:Math.round(s.columns),colW=(bodyW-(cols-1)*colGap)/cols;
  const pages=[{ops:[],height:PH}], plan={width:W,pages,images,errors,paged,style:s,doc};let page=0,col=0,y=top,firstBodyY=top;
  const current=()=>pages[page];const x=()=>M+col*(colW+colGap);
  function nextPage(){page++;col=0;y=top;pages.push({ops:[],height:PH});}
  function room(height){if(paged && y+height>PH-bottom && y>top){if(col<cols-1){col++;y=page===0?firstBodyY:top;}else nextPage();}}
  function add(op,h){room(h);current().ops.push({...op,x:op.x??x(),y,h});y+=h;}
  function gap(h){y+=h;}
  function simple(text,size,opts={}){const block={text,spans:[],type:opts.type||'body'},lines=wrap(measure,block,s,size,opts.maxW||colW);for(const line of lines)add({kind:'text',line,size,align:opts.align||'left',width:opts.maxW||colW,color:opts.color||s.ink,...opts},size*(opts.leading||1.5));}
  if(s.showTitle){
    if(s.logo){const img=images.get(s.logo);const h=52;add({kind:'image',image:img,width:h,height:h,x:(W-h)/2,fit:'contain'},h);gap(24);}
    add({kind:'rule',width:bodyW,color:s.accent,x:M},22);
    simple('SELECTED MOMENTS  /  '+(doc.date||'PRIVATE EDITION'),12,{color:s.accent,align:'center',maxW:bodyW,x:M});gap(20);
    simple(doc.title||'未命名摘录',Math.min(48,s.fontSize*1.8),{type:'h1',align:'center',maxW:bodyW,x:M});gap(12);
    if(doc.subtitle){simple(doc.subtitle,17,{align:'center',color:s.accent,maxW:bodyW,x:M});gap(12);}
    if(doc.author){simple(doc.author,14,{align:'center',color:s.accent,maxW:bodyW,x:M});gap(14);}
    add({kind:'rule',width:bodyW,color:hexAlpha(s.accent,0.35),x:M},24);gap(14);
    if(cols>1 && paged){firstBodyY=Math.min(y,PH-bottom-40);}
  }
  if(!doc.blocks.length){simple('从左侧选取片段，开始编排你的故事。',s.fontSize,{align:'center',color:s.accent,maxW:bodyW,x:M});gap(100);}
  let vcursor=0,vtop=y,vmaxH=0,vused=false;
  function flushVertical(){if(vused){y=vtop+vmaxH+s.paragraphGap;vcursor=0;vmaxH=0;vused=false;}}
  for(const b of doc.blocks){
    const bs=blockStyle(s,b);bs.customBlockFont=!!b.textStyle?.font;
    if(s.layout==='vertical'&&!['image','divider','pagebreak','code','h1','h2'].includes(b.type)){
      const size=blockFontSize(bs,b),step=size*bs.lineHeight,cell=size*1.4+bs.letterSpacing;
      if(!vused)vtop=y;
      if(paged&&PH-bottom-vtop<cell*4){nextPage();vtop=y;vcursor=0;vmaxH=0;}
      const rowCount=Math.max(1,Math.floor((paged?PH-bottom-vtop:520)/cell)),groups=[];let group=[];
      for(const ch of charRuns(measure,b,bs,size)){if(ch.text==='\n'){if(group.length)groups.push(group);group=[];continue;}group.push(ch);if(group.length>=rowCount){groups.push(group);group=[];}}
      if(group.length)groups.push(group);
      const ensureWidth=w=>{if(vcursor+w>bodyW&&vcursor>0){if(paged){nextPage();vtop=y;}else{y=vtop+vmaxH+s.paragraphGap*2;vtop=y;}vcursor=0;vmaxH=0;}};
      if(b.speaker&&s.showNames){ensureWidth(22+step);const chars=charRuns(measure,{...b,text:b.speaker,spans:[]},s,13);current().ops.push({kind:'vertical',groups:[chars],x:M+bodyW-vcursor-13,y:vtop,width:13,h:chars.length*18.2,size:13,step:22,blockId:b.id,type:'body',color:s.accent});vcursor+=22;vmaxH=Math.max(vmaxH,chars.length*18.2);}
      for(const g of groups){ensureWidth(Math.max(step,size));const h=g.length*cell;current().ops.push({kind:'vertical',groups:[g],x:M+bodyW-vcursor-size,y:vtop,width:size,h,size,step,cell,blockId:b.id,type:b.type,font:bs.font,color:bs.ink,customBlockFont:bs.customBlockFont});vcursor+=Math.max(step,size);vmaxH=Math.max(vmaxH,h);vused=true;}
      vcursor+=Math.min(120,bs.paragraphGap);continue;
    }
    flushVertical();
    if(b.type==='pagebreak'){if(paged)nextPage();else gap(70);continue;}
    if(b.type==='divider'){add({kind:'ornament',width:colW,color:s.accent,blockId:b.id},38);gap(s.paragraphGap);continue;}
    if(b.type==='image'){
      const img=images.get(b.src),ratio=b.ratio==='square'?1:b.ratio==='wide'?16/9:b.ratio==='portrait'?3/4:img?img.width/img.height:16/9;
      const imageW=colW*(b.imageWidth??100)/100,h=Math.min(imageW/ratio,paged?PH-top-bottom-60:950),offset=b.align==='right'?colW-imageW:b.align==='center'?(colW-imageW)/2:0;
      const captions=b.caption?wrap(measure,{text:b.caption,spans:[],type:'body'},s,14,imageW):[];
      room(h+(captions.length?9+captions.length*21:0));
      add({kind:'image',image:img,x:x()+offset,width:imageW,height:h,fit:b.fit||'cover',filter:b.filter||'none',radius:b.radius||0,position:b.position??50,positionX:b.positionX??50,zoom:b.zoom??1,blockId:b.id},h);
      if(captions.length){gap(9);for(const line of captions){room(21);add({kind:'text',line,size:14,x:x()+offset,width:imageW,align:'center',color:s.accent,blockId:b.id},21);}}
      gap(s.paragraphGap);continue;
    }
    const size=blockFontSize(bs,b),lineH=size*bs.lineHeight;
    room(lineH*2+24);
    if(b.speaker && s.showNames){simple(b.speaker,13,{color:s.accent,blockId:b.id,align:s.layout==='chat'&&b.isUser?'right':'left'});gap(9);}
    const chat=s.layout==='chat',quote=b.type==='quote',code=b.type==='code';
    const padding=chat?20:quote||code?16:0,available=colW-padding*2-(chat?36:quote?10:0);
    const entries=(b.type==='list'||b.type==='ordered')?b.text.split('\n').map((t,i)=>({text:(b.type==='list'?'• ':`${i+1}. `)+t})): [{text:b.text}];
    if(code||chat)gap(8);
    for(const entry of entries){
      const lines=wrap(measure,{...b,text:entry.text},bs,size,available,entry.text,(s.indent&&b.type==='body'&&!chat&&!quote)?size*2:0);
      lines.forEach((line,i)=>{
        room(lineH+((code||chat)?16:0));const offset=chat?(b.isUser?36:0):quote?10:0;
        let tx=x()+padding+offset;
        if(s.indent && i===0 && b.type==='body' && !chat && !quote)tx+=size*2;
        current().ops.push({kind:'text',line,size,x:tx,y,h:lineH,width:available-((s.indent&&i===0&&b.type==='body'&&!chat)?size*2:0),align:b.align||'left',color:bs.ink,font:bs.font,customBlockFont:bs.customBlockFont,type:b.type,blockId:b.id,bubble:(chat||code)?{key:b.id+'-'+page+'-'+col,x:x()+offset,y:y-8,w:colW-(chat?36:0),color:chat?(b.isUser?hexAlpha(s.accent,0.18):hexAlpha(s.accent,0.07)):hexAlpha(s.accent,0.08),radius:chat?14:4}:null,quote});y+=lineH;
      });
    }
    gap(bs.paragraphGap+((code||chat)?8:0));
  }
  flushVertical();
  if(!paged)pages[0].height=Math.max(360,y+bottom);
  return plan;
}
function roundRect(ctx,x,y,w,h,r=0){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);}
function paintPaper(ctx,plan,height,pageIndex){
  const s=plan.style,W=plan.width;ctx.fillStyle=s.bg;ctx.fillRect(0,0,W,height);
  const bg=plan.images.get(s.backgroundImage);if(bg){ctx.save();ctx.globalAlpha=s.backgroundOpacity;const r=Math.max(W/bg.width,height/bg.height);ctx.drawImage(bg,(W-bg.width*r)/2,(height-bg.height*r)/2,bg.width*r,bg.height*r);ctx.restore();}
  ctx.save();ctx.strokeStyle=hexAlpha(s.accent,0.075);ctx.fillStyle=hexAlpha(s.accent,0.12);ctx.lineWidth=0.7;
  if(s.paper==='grain'){let seed=1715;for(let i=0;i<W*height/100;i++){seed=(seed*16807)%2147483647;const x=seed%W;seed=(seed*16807)%2147483647;ctx.fillRect(x,seed%height,0.6,0.6);}}
  if(s.paper==='grid'||s.paper==='lines'){for(let y=0;y<height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}if(s.paper==='grid')for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}}
  if(s.paper==='dots')for(let y=16;y<height;y+=28)for(let x=16;x<W;x+=28){ctx.beginPath();ctx.arc(x,y,0.7,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  if(s.watermark&&s.watermarkRepeat){ctx.save();ctx.globalAlpha=s.watermarkOpacity;ctx.fillStyle=s.ink;ctx.font=fontFor(s,20);const ww=Math.max(200,ctx.measureText(s.watermark).width+65);for(let y=130;y<height;y+=200)for(let x=25;x<W;x+=ww){ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI/8);ctx.fillText(s.watermark,0,0);ctx.restore();}ctx.restore();}
  if(!plan.cardDesign&&pageIndex>0&&plan.paged){ctx.fillStyle=s.accent;ctx.font=fontFor(s,11);ctx.fillText((plan.doc.title||'拾页').slice(0,45),s.margin,30);}
  if(!plan.cardDesign&&s.showFooter){ctx.strokeStyle=hexAlpha(s.accent,0.25);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(s.margin,height-43);ctx.lineTo(W-s.margin,height-43);ctx.stroke();ctx.font=fontFor(s,11);ctx.fillStyle=s.accent;ctx.fillText((plan.doc.author||plan.doc.date||'')+'',s.margin,height-24);const right=plan.paged?`${pageIndex+1} / ${plan.pages.length}`:'FIN.';ctx.textAlign='right';ctx.fillText(right,W-s.margin,height-24);ctx.textAlign='left';}
  if(s.watermark&&!s.watermarkRepeat){ctx.save();ctx.globalAlpha=Math.max(0.2,s.watermarkOpacity);ctx.fillStyle=s.ink;ctx.font=fontFor(s,12);ctx.textAlign='center';ctx.fillText(s.watermark,W/2,height-24);ctx.restore();}
}
export function paintPage(plan,pageIndex=0,{scale=1,offset=0,height}={}){
  const p=plan.pages[pageIndex],H=height??p.height;if(H*scale>16384||plan.width*H*scale*scale>32000000)throw new Error('图片过长，请使用分页图片导出');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(plan.width*scale);canvas.height=Math.ceil(H*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(0,-offset);paintPaper(ctx,plan,p.height,pageIndex);
  const groups=new Map();for(const o of p.ops){if(o.bubble){const k=o.bubble.key,b=groups.get(k);if(b)b.h=Math.max(b.h,o.y+o.h+8-b.y);else groups.set(k,{...o.bubble,h:o.h+16});}}
  for(const b of groups.values()){ctx.fillStyle=b.color;roundRect(ctx,b.x,b.y,b.w,b.h,b.radius);ctx.fill();}
  for(const o of p.ops){
    if(o.y+o.h<offset||o.y>offset+H)continue;
    if(o.kind==='shape'){
      ctx.save();ctx.globalAlpha=o.opacity??1;ctx.fillStyle=o.color;ctx.strokeStyle=o.stroke||o.color;ctx.lineWidth=o.lineWidth||1;
      if(o.shape==='circle'){ctx.beginPath();ctx.arc(o.x+o.width/2,o.y+o.h/2,Math.min(o.width,o.h)/2,0,Math.PI*2);o.fill===false?ctx.stroke():ctx.fill();}
      else if(o.shape==='sketch'){ctx.beginPath();ctx.moveTo(o.x,o.y+o.h*.6);ctx.bezierCurveTo(o.x+o.width*.95,o.y-o.h*.1,o.x-o.width*.25,o.y+o.h*1.3,o.x+o.width,o.y+o.h*.3);ctx.bezierCurveTo(o.x+o.width*.1,o.y+o.h*.2,o.x+o.width*.6,o.y+o.h,o.x+o.width*.85,o.y+o.h*.5);ctx.stroke();}
      else {roundRect(ctx,o.x,o.y,o.width,o.h,o.radius||0);o.fill===false?ctx.stroke():ctx.fill();}ctx.restore();
    }
    if(o.kind==='rule'){ctx.strokeStyle=o.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(o.x+o.width,o.y);ctx.stroke();}
    if(o.kind==='ornament'){ctx.strokeStyle=o.color;ctx.fillStyle=o.color;ctx.lineWidth=0.8;const cy=o.y+16,cx=o.x+o.width/2;ctx.beginPath();ctx.moveTo(cx-60,cy);ctx.lineTo(cx-10,cy);ctx.moveTo(cx+10,cy);ctx.lineTo(cx+60,cy);ctx.stroke();ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.fillRect(-2,-2,4,4);ctx.restore();}
    if(o.kind==='image'){
      ctx.save();roundRect(ctx,o.x,o.y,o.width,o.height,o.radius||0);ctx.clip();const img=o.image;
      if(img){ctx.filter=o.filter==='grayscale'?'grayscale(1)':o.filter==='sepia'?'sepia(.65)':o.filter==='soft'?'saturate(.7) contrast(.9)':'none';const r=(o.fit==='contain'?Math.min:Math.max)(o.width/img.width,o.height/img.height)*(o.fit==='contain'?1:o.zoom??1),w=img.width*r,h=img.height*r,dy=(o.height-h)*(o.position??50)/100,dx=(o.width-w)*(o.positionX??50)/100;ctx.drawImage(img,o.x+dx,o.y+dy,w,h);}
      else{ctx.fillStyle=hexAlpha(plan.style.accent,0.1);ctx.fillRect(o.x,o.y,o.width,o.height);ctx.fillStyle=plan.style.accent;ctx.font=fontFor(plan.style,16);ctx.textAlign='center';ctx.fillText('图片未载入 · 可上传本地图片',o.x+o.width/2,o.y+o.height/2);ctx.textAlign='left';}ctx.restore();
    }
    if(o.kind==='text'){
      if(o.quote){ctx.strokeStyle=plan.style.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(o.x-12,o.y+2);ctx.lineTo(o.x-12,o.y+o.h-2);ctx.stroke();}
      let x=o.x+(o.align==='center'?(o.width-o.line.width)/2:o.align==='right'?o.width-o.line.width:0);const extra=o.align==='justify'&&o.line.chars.length>1?Math.max(0,(o.width-o.line.width)/(o.line.chars.length-1)):0;
      for(const c of o.line.chars){const a=c.attrs,base=o.y+o.size*0.92;ctx.font=fontFor({...plan.style,font:o.font||plan.style.font,customBlockFont:o.customBlockFont},o.size,a,o.type);ctx.fillStyle=a.color||o.color;
        if(a.mark){ctx.fillStyle=hexAlpha(plan.style.accent,0.22);ctx.fillRect(x,o.y+o.size*0.15,c.width,o.size*1.05);ctx.fillStyle=a.color||o.color;}
        ctx.fillText(c.text,x,base);if(a.underline||a.strike){ctx.strokeStyle=a.color||o.color;ctx.lineWidth=1;ctx.beginPath();const yy=base-(a.strike?o.size*0.32:-3);ctx.moveTo(x,yy);ctx.lineTo(x+c.width,yy);ctx.stroke();}x+=c.width+extra;
      }
    }
    if(o.kind==='vertical'){
      o.groups.forEach((g,i)=>{const x=o.x+o.width-o.size-i*o.step;g.forEach((c,j)=>{const yy=o.y+j*(o.cell||o.size*1.4),a=c.attrs;ctx.font=fontFor({...plan.style,font:o.font||plan.style.font,customBlockFont:o.customBlockFont},o.size,a,o.type);ctx.fillStyle=a.color||o.color||plan.style.ink;const punctMap={'，':'︐','。':'︒','！':'︕','？':'︖','：':'︓','；':'︔','（':'︵','）':'︶','「':'﹁','」':'﹂','『':'﹃','』':'﹄','、':'︑'};ctx.fillText(punctMap[c.text]||c.text,x,yy+o.size);if(a.underline){ctx.fillRect(x+o.size+2,yy,1,o.size);}if(a.mark){ctx.save();ctx.globalAlpha=0.15;ctx.fillStyle=plan.style.accent;ctx.fillRect(x,yy,o.size,o.cell||o.size*1.4);ctx.restore();}});});
    }
  }
  return canvas;
}
export const canvasBlob=(canvas,type='image/png',quality=0.95)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('浏览器无法生成图片，请降低清晰度或改用分页')),type,quality));
export function paginationForLong(plan,targetHeight=1000){
  if(plan.paged)return plan;
  const out={...plan,paged:true,pages:[]},top=64,bottom=64,groups=[];let current=null;
  for(const op of plan.pages[0].ops){
    const key=op.bubble?.key;if((key&&current?.key===key)||(op.kind==='vertical'&&current?.vertical&&Math.abs(op.y-current.ops[0].y)<1))current.ops.push(op);
    else {current={key,vertical:op.kind==='vertical',ops:[op]};groups.push(current);}
  }
  let page={ops:[],height:targetHeight},y=top,previousY=0;out.pages.push(page);
  const append=ops=>{const min=ops[0].y;let max=Math.max(...ops.map(o=>o.y+o.h));if(ops.length===1&&ops[0].kind==='image'&&ops[0].h>targetHeight-top-bottom){const o=ops[0],factor=(targetHeight-top-bottom)/o.h;ops=[{...o,height:o.height*factor,h:o.h*factor,width:o.width*factor,x:(plan.width-o.width*factor)/2}];max=min+ops[0].h;}
    if(ops.every(o=>o.kind==='vertical')&&max-min>targetHeight-top-bottom){const factor=(targetHeight-top-bottom)/(max-min);ops=ops.map(o=>({...o,x:plan.width/2+(o.x-plan.width/2)*factor,y:min+(o.y-min)*factor,h:o.h*factor,size:o.size*factor,width:o.width*factor,step:o.step*factor,cell:o.cell?o.cell*factor:undefined}));max=Math.max(...ops.map(o=>o.y+o.h));}
    const h=max-min,gap=Math.min(28,Math.max(0,min-previousY));
    if(y+gap+h>targetHeight-bottom&&page.ops.length){page={ops:[],height:targetHeight};out.pages.push(page);y=top;}
    const offset=y+gap-min;for(const op of ops)page.ops.push({...op,y:op.y+offset,bubble:op.bubble?{...op.bubble,y:op.bubble.y+offset,key:op.bubble.key+'-'+out.pages.length}:null});y+=gap+h;previousY=max;
  };
  for(const group of groups){if(group.ops.length>1&&group.ops.at(-1).y+group.ops.at(-1).h-group.ops[0].y>targetHeight-top-bottom)for(const op of group.ops)append([op]);else append(group.ops);}
  return out;
}
