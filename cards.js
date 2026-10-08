import {blockStyle,blockFontSize} from './core.js';

// Card layouts produce the same drawing operations as the article renderer.
// Preview selection, text formatting and every export therefore share one plan.
export function layoutCards(doc,images,errors,measure,{wrap}){
  const s=doc.style,W=s.width,M=Math.min(s.margin,W/4),BW=W-M*2,PH=s.pageHeight;
  const excerpt=s.layout==='excerpt',collage=s.layout==='collage',paged=s.pageMode==='pages';
  const pages=[],plan={width:W,pages,images,errors,paged,style:s,doc,cardDesign:s.layout};
  const footerSpace=excerpt?(s.showTitle?164:64):(s.showFooter?72:40);
  let page,y,bodyTop;
  const push=op=>page.ops.push(op);
  function staticText(text,x,yy,width,size,color=s.ink,opts={}){
    const block={text:String(text||''),spans:[],type:opts.type||'body'},style={...s,letterSpacing:opts.letterSpacing??s.letterSpacing};
    const lines=wrap(measure,block,style,size,width);
    for(let i=0;i<lines.length;i++)push({kind:'text',line:lines[i],size,x,y:yy+i*size*1.4,h:size*1.4,width,color,align:opts.align||'left',font:s.font,type:block.type,...opts});
    return lines.length*size*1.4;
  }
  const rule=(x,yy,width,color=s.accent)=>push({kind:'rule',x,y:yy,width,h:1,color});
  function newPage(){
    page={ops:[],height:PH};pages.push(page);const n=pages.length;
    if(excerpt){
      staticText('书 摘  /  READING NOTES',M,58,BW,12,s.accent,{letterSpacing:1.8});
      staticText('“',M-4,106,BW,84,s.accent,{letterSpacing:0});
      bodyTop=206;
    }else if(collage){
      if(s.showTitle){const titleH=staticText(doc.title||'拾光片段',M,54,BW,26,s.ink,{align:'center',letterSpacing:4});
        const subH=doc.subtitle?staticText(doc.subtitle,M,64+titleH,BW,12,s.accent,{align:'center',letterSpacing:1.4}):0;
        rule(M,92+titleH+subH,BW);bodyTop=140+titleH+subH;
      }else bodyTop=70;
    }else{
      staticText(String(n).padStart(2,'0'),M,44,100,60,s.accent,{letterSpacing:0});
      staticText(s.template==='forestpoem'?'山 野  /  FIELD NOTES':'片 段  /  PRIVATE EDITION',M+114,52,BW-114,11,s.accent,{letterSpacing:1.2});
      let titleH=0,subH=0;
      if(s.showTitle){titleH=staticText(doc.title||'拾光片段',M+114,80,BW-114,32,s.ink,{type:'h1'});if(doc.subtitle)subH=staticText(doc.subtitle,M+114,86+titleH,BW-114,13,s.accent);}
      const headerBottom=Math.max(142,101+titleH+subH);rule(M,headerBottom,BW);bodyTop=headerBottom+48;
      push({kind:'shape',shape:'sketch',x:W-M-80,y:34,width:70,h:60,color:s.accent,opacity:.28,fill:false});
    }
    if(s.logo){const width=26;push({kind:'image',image:images.get(s.logo),x:W-M-width,y:24,width,height:width,h:width,fit:'contain'});}
    y=bodyTop;
  }
  function room(height){if(paged&&y+height>PH-footerSpace&&y>bodyTop)newPage();}
  function textStream(block,width){
    const bs=blockStyle(s,block);bs.customBlockFont=!!block.textStyle?.font;
    const size=blockFontSize(bs,block),leading=size*bs.lineHeight,stream=[];
    if(block.speaker&&s.showNames){const label={text:block.speaker,spans:[],type:'body'};for(const line of wrap(measure,label,s,13,width))stream.push({kind:'text',line,size:13,h:20,width,color:s.accent,blockId:block.id,font:s.font});stream.push({kind:'gap',h:10});}
    const entries=['list','ordered'].includes(block.type)?block.text.split('\n').map((text,i)=>({text:(block.type==='list'?'• ':`${i+1}. `)+text})): [{text:block.text}];
    for(const entry of entries){const indent=s.indent&&block.type==='body'?Math.min(size*2,Math.max(0,width-size-bs.letterSpacing)):0;
      const lines=wrap(measure,{...block,text:entry.text},bs,size,width,entry.text,indent);
      for(let i=0;i<lines.length;i++)stream.push({kind:'text',line:lines[i],size,h:leading,width:width-(i===0?indent:0),dx:i===0?indent:0,align:block.align||'left',color:bs.ink,font:bs.font,customBlockFont:bs.customBlockFont,type:block.type,blockId:block.id});
    }
    stream.push({kind:'gap',h:bs.paragraphGap});return stream;
  }
  function imageStream(block,width,maxHeight=PH-footerSpace-bodyTop-40){
    const img=images.get(block.src),ratio=block.ratio==='square'?1:block.ratio==='wide'?16/9:block.ratio==='portrait'?3/4:img?img.width/img.height:16/9;
    const iw=width*(block.imageWidth??100)/100,ih=Math.max(1,Math.min(iw/ratio,maxHeight));
    const dx=block.align==='right'?width-iw:block.align==='left'?0:(width-iw)/2;
    const stream=[{kind:'image',image:img,width:iw,height:ih,h:ih,dx,fit:block.fit||'cover',filter:block.filter||'none',radius:block.radius||0,position:block.position??50,positionX:block.positionX??50,zoom:block.zoom??1,blockId:block.id}];
    if(block.caption){stream.push({kind:'gap',h:12});const label={text:block.caption,spans:[],type:'body'};for(const line of wrap(measure,label,s,12,iw))stream.push({kind:'text',line,size:12,h:19,width:iw,dx,align:'center',color:s.accent,font:s.font,blockId:block.id});}
    return stream;
  }
  function consume(stream,start,height,x,yy){let used=0,index=start;
    while(index<stream.length){const op=stream[index];if(used+op.h>height&&used>0)break;
      if(op.h>height&&op.kind!=='gap')break;
      if(op.kind!=='gap')push({...op,x:x+(op.dx||0),y:yy+used});
      used+=Math.min(op.h,Math.max(0,height-used));index++;
    }return {used,index};
  }
  newPage();
  if(!doc.blocks.length){staticText('选取喜欢的几句话，留成一页书摘。',M,y,BW,s.fontSize,s.accent);y+=160;}
  if(excerpt){
    for(const b of doc.blocks){
      if(b.type==='pagebreak'){if(paged)newPage();else y+=100;continue;}
      if(b.type==='divider'){room(36);rule(M,y+14,Math.min(80,BW));y+=36+s.paragraphGap;continue;}
      const stream=b.type==='image'?imageStream(b,BW):textStream(b,BW);let at=0;
      while(at<stream.length){const available=paged?PH-footerSpace-y:Infinity;if(available<stream[at].h&&y>bodyTop){newPage();continue;}
        const result=consume(stream,at,available,M,y);if(result.index===at){errors.push('当前字号或图片尺寸超出书摘页，请增大分页高度或缩小字号');break;}at=result.index;y+=result.used;if(at<stream.length&&paged)newPage();
      }
      if(b.type==='image')y+=s.paragraphGap;
    }
  }else{
    const groups=[];
    for(const b of doc.blocks){
      if(['divider','pagebreak'].includes(b.type)){groups.push({kind:b.type,block:b});continue;}
      const prev=groups.at(-1);
      if(b.type==='image'){
        if(prev?.kind==='row'&&prev.images.length===0)prev.images.push(b);
        else if(prev?.kind==='row'&&prev.text.length===0&&prev.images.length<3)prev.images.push(b);
        else groups.push({kind:'row',images:[b],text:[]});
      }else if(prev?.kind==='row'&&((prev.images.length===1&&prev.text.length===0)||(prev.images.length===0&&prev.text.length<2)))prev.text.push(b);
      else groups.push({kind:'row',images:[],text:[b]});
    }
    let groupNumber=0;
    for(const group of groups){
      if(group.kind==='pagebreak'){if(paged)newPage();else y+=110;continue;}
      if(group.kind==='divider'){room(50);push({kind:'ornament',x:M,y,width:BW,h:32,color:s.accent,blockId:group.block.id});y+=50+s.paragraphGap;continue;}
      groupNumber++;const gutter=28,hasPair=group.images.length===1&&group.text.length>0;
      const sideWidth=BW*.41,textWidth=hasPair?BW-sideWidth-gutter:BW;
      let streams=[],positions=[],widths=[];
      if(group.images.length>1){const width=(BW-(group.images.length-1)*18)/group.images.length;streams=group.images.map(b=>imageStream(b,width,180));positions=group.images.map((_,i)=>M+i*(width+18));widths=streams.map(()=>width);}
      else if(hasPair){const imageOnLeft=groupNumber%2===0;streams=[group.text.flatMap(b=>textStream(b,textWidth)),imageStream(group.images[0],sideWidth)];positions=imageOnLeft?[M+sideWidth+gutter,M]:[M,M+textWidth+gutter];widths=[textWidth,sideWidth];}
      else if(group.images.length){streams=[imageStream(group.images[0],BW*.8,320)];positions=[M+BW*.1];widths=[BW*.8];}
      else {streams=[group.text.flatMap(b=>textStream(b,BW))];positions=[M];widths=[BW];}
      let cursors=streams.map(()=>0),part=0;
      while(streams.some((stream,i)=>cursors[i]<stream.length)){
        const firstMax=Math.max(...streams.map((stream,i)=>stream[cursors[i]]?.h||0));room(firstMax+32);
        const available=paged?PH-footerSpace-y-32:Infinity;
        if(available<firstMax){errors.push('当前字号或图片尺寸超出版式页，请增大分页高度或缩小字号');break;}
        staticText(`（ ${String(groupNumber).padStart(2,'0')}${part?' · 续':''} ）`,M,y,BW,11,s.accent,{letterSpacing:1.8});
        const startY=y+28;
        if(collage){const bgH=Math.min(available,Math.max(80,...streams.map((stream,i)=>stream.slice(cursors[i]).reduce((h,o)=>h+o.h,0))));push({kind:'shape',x:M-10,y:startY-8,width:BW+20,h:bgH+12,color:s.accent,opacity:.085});}
        const results=streams.map((stream,i)=>consume(stream,cursors[i],available,positions[i],startY));
        const used=Math.max(...results.map(result=>result.used),0);
        if(!results.some((result,i)=>result.index>cursors[i])){errors.push('排版空间不足，请增大页面尺寸');break;}
        cursors=results.map(result=>result.index);y=startY+used+s.paragraphGap;
        if(streams.some((stream,i)=>cursors[i]<stream.length)&&paged)newPage();part++;
      }
    }
  }
  if(!paged)page.height=Math.max(PH,y+footerSpace);
  for(let i=0;i<pages.length;i++){
    page=pages[i];const H=page.height;
    if(excerpt&&s.showTitle){rule(M,H-145,48);const title=/^《.*》$/.test(doc.title)?doc.title:`《${doc.title||'未命名摘录'}》`;staticText(title,M,H-120,BW,20,s.ink);if(doc.subtitle)staticText(doc.subtitle,M,H-86,BW,13,s.accent);}
    if(s.showFooter){if(!excerpt)rule(M,H-57,BW);staticText(doc.author||'私人摘录',M,H-40,BW-90,12,s.accent);staticText(paged?`${String(i+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`:doc.date,W-M-86,H-40,86,11,s.accent,{align:'right',letterSpacing:0});}
  }
  return plan;
}
