export const KEY = 'shiyepress_v1';
export const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp = (n, min, max, fallback) => Number.isFinite(Number(n)) ? Math.max(min, Math.min(max, Number(n))) : fallback;
export const FONTS = {serif:'"Noto Serif CJK SC", "Songti SC", SimSun, serif', sans:'"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif', mono:'"SFMono-Regular", Consolas, monospace', kai:'KaiTi, STKaiti, "Noto Serif CJK SC", serif'};
export const TEMPLATES = [
  {id:'booknote',name:'阅读书摘',note:'引号 · 书页留白',bg:'#f8f6f0',ink:'#353832',accent:'#8b947f',paper:'plain',font:'serif',layout:'excerpt',settings:{fontSize:30,lineHeight:1.85,letterSpacing:.4,paragraphGap:30,margin:76,width:720,pageHeight:960,pageMode:'pages',columns:1,showNames:false,showTitle:true,showFooter:true}},
  {id:'inkfolio',name:'黑白书页',note:'编号 · 图文并置',bg:'#f4f3ef',ink:'#282a29',accent:'#767b75',paper:'plain',font:'serif',layout:'editorial',settings:{fontSize:25,lineHeight:1.8,letterSpacing:.3,paragraphGap:34,margin:56,width:720,pageHeight:960,pageMode:'pages',columns:1,showNames:false,showTitle:true,showFooter:true}},
  {id:'whitecollage',name:'灰白拼贴',note:'图片组 · 错位留白',bg:'#ffffff',ink:'#414542',accent:'#8e968f',paper:'plain',font:'serif',layout:'collage',settings:{fontSize:24,lineHeight:1.8,letterSpacing:.4,paragraphGap:64,margin:56,width:720,pageHeight:1080,pageMode:'pages',columns:1,showNames:false,showTitle:true,showFooter:true}},
  {id:'forestpoem',name:'深绿诗页',note:'山野 · 深色诗笺',bg:'#18362b',ink:'#e6eadc',accent:'#a9b69f',paper:'plain',font:'serif',layout:'editorial',settings:{fontSize:26,lineHeight:1.85,letterSpacing:.6,paragraphGap:44,margin:58,width:720,pageHeight:960,pageMode:'pages',columns:1,showNames:false,showTitle:true,showFooter:true}},
  {id:'journal', name:'留白杂志', note:'克制 · 灰白', bg:'#faf9f6', ink:'#343430', accent:'#647264', paper:'plain', font:'serif', layout:'article'},
  {id:'letter', name:'旧日信笺', note:'暖纸 · 手札', bg:'#f5efe2', ink:'#4e463c', accent:'#8b6951', paper:'grain', font:'kai', layout:'article'},
  {id:'night', name:'黑白夜刊', note:'深色 · 夜读', bg:'#202224', ink:'#eeeae4', accent:'#aab7b4', paper:'plain', font:'sans', layout:'article'},
  {id:'bloom', name:'淡粉札记', note:'花瓣 · 温柔', bg:'#fbf1f1', ink:'#594b4b', accent:'#ad797d', paper:'plain', font:'serif', layout:'article'},
  {id:'chat', name:'对话剪影', note:'气泡 · 角色', bg:'#f2f4f0', ink:'#303e38', accent:'#668175', paper:'plain', font:'sans', layout:'chat'},
  {id:'vertical', name:'古籍竖笺', note:'右起 · 竖排', bg:'#f4f0e5', ink:'#3e4238', accent:'#687454', paper:'grain', font:'serif', layout:'vertical'}
];
export const defaultStyle = () => ({template:'journal', bg:'#faf9f6', ink:'#343430', accent:'#647264', paper:'plain', font:'serif', layout:'article', width:720, margin:68, fontSize:24, lineHeight:1.9, letterSpacing:0.5, paragraphGap:26, showNames:true, showTitle:true, showFooter:true, indent:false, watermark:'', watermarkOpacity:0.1, watermarkRepeat:false, logo:'', backgroundImage:'', backgroundOpacity:0.15, pageHeight:1000, pageMode:'long', columns:1});
export function makeDocument(title = '未命名摘录') {return {id:id(), title, subtitle:'', author:'', date:new Date().toLocaleDateString('zh-CN'), tags:'', collection:'未分类', created:Date.now(), updated:Date.now(), style:defaultStyle(), blocks:[]};}
export function makeBlock(text='', extra={}) {return {id:id(), type:'body', text, speaker:'', isUser:false, align:'left', spans:[], ...extra};}
export const isFontKey = value => typeof value==='string' && (Object.hasOwn(FONTS,value)||/^custom-[\w-]+$/.test(value));
export function normalizeTextStyle(input) {
  if(!input || typeof input!=='object')return {};
  const out={};
  if(isFontKey(input.font))out.font=input.font;
  if(/^#[\da-f]{6}$/i.test(input.color))out.color=input.color;
  for(const [k,min,max] of [['fontSize',12,80],['lineHeight',1.1,3.5],['letterSpacing',0,12],['paragraphGap',0,120]]){
    if(input[k]!==undefined && Number.isFinite(Number(input[k])))out[k]=clamp(input[k],min,max,min);
  }
  return out;
}
export function blockStyle(style,block) {const local=normalizeTextStyle(block.textStyle);return {...style,...local,ink:local.color||style.ink};}
export function blockFontSize(style,block) {return block.textStyle?.fontSize??(style.fontSize*(block.type==='h1'?1.6:block.type==='h2'?1.25:block.type==='code'?0.8:1));}
export function plainText(raw) {
  return String(raw ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
}
export function markdownBlocks(raw, extra={}) {
  const text=plainText(raw), parts=[], out=[];let chunk=[],inCode=false;
  for(const line of text.split('\n')){if(/^```/.test(line)){if(!inCode&&chunk.length){parts.push(chunk.join('\n'));chunk=[];}chunk.push(line);inCode=!inCode;if(!inCode){parts.push(chunk.join('\n'));chunk=[];}}else if(!line.trim()&&!inCode){if(chunk.length)parts.push(chunk.join('\n'));chunk=[];}else chunk.push(line);}
  if(chunk.length)parts.push(chunk.join('\n'));
  for (const part of parts) {
    if (part.trim().startsWith('```')) {
      const v=part.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
      out.push(makeBlock(v,{...extra,type:'code'})); continue;
    }
    if (!part.trim()) continue;
    const img=/^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(part.trim());if(img){out.push(makeBlock('',{...extra,type:'image',src:img[2],caption:img[1],ratio:'auto',fit:'contain'}));continue;}
    let type='body', value=part;
    if (/^#{1,2}\s/.test(part)) {type=part.startsWith('##')?'h2':'h1';value=part.replace(/^#{1,2}\s+/,'');}
    else if (/^>\s?/.test(part)) {type='quote';value=part.replace(/^>\s?/gm,'');}
    else if (/^[-*]\s/.test(part)) {type='list';value=part.replace(/^[-*]\s+/gm,'');}
    else if (/^\d+\.\s/.test(part)) {type='ordered';value=part.replace(/^\d+\.\s+/gm,'');}
    else if (/^([-*_])\1{2,}$/.test(part.trim())) {type='divider';value='';}
    const spans=[]; let clean='', pos=0;
    const re=/(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g; let m;
    while ((m=re.exec(value))) {clean+=value.slice(pos,m.index); const start=clean.length; clean+=m[2]||m[3]||m[4]; spans.push({start,end:clean.length,...(m[2]?{bold:true}:m[3]?{italic:true}:{mark:true})});pos=re.lastIndex;}
    clean+=value.slice(pos);out.push(makeBlock(clean,{...extra,type,spans}));
  }
  return out;
}
export function setTemplate(doc, tid) {const t=TEMPLATES.find(t=>t.id===tid);if(t) Object.assign(doc.style,{template:tid,bg:t.bg,ink:t.ink,accent:t.accent,paper:t.paper,font:t.font,layout:t.layout,...t.settings});}
export function updateBlockText(block, next) {
  const prev=block.text||''; let start=0;
  while(start<prev.length && start<next.length && prev[start]===next[start])start++;
  let a=prev.length,b=next.length;
  while(a>start && b>start && prev[a-1]===next[b-1]){a--;b--;}
  const delta=b-a;
  block.spans=(block.spans||[]).map(s=>{
    if(s.end<=start)return s;
    if(s.start>=a)return {...s,start:s.start+delta,end:s.end+delta};
    return {...s,start:Math.min(s.start,start),end:Math.max(start,s.end>a?s.end+delta:b)};
  }).filter(s=>s.start<s.end && s.end<=next.length);
  block.text=next;
}
export function normalizeDocument(input) {
  if(!input || typeof input!=='object' || !Array.isArray(input.blocks))throw new Error('不是拾页作品文件');
  if(input.blocks.length>2500)throw new Error('作品段落超过 2500 段，请拆分导入');
  const doc=makeDocument(String(input.title||'未命名摘录').slice(0,500));
  for (const k of ['subtitle','author','date','tags','collection'])doc[k]=String(input[k]??doc[k]).slice(0,3000);
  doc.id=typeof input.id==='string'?input.id.slice(0,100):doc.id;doc.created=Number(input.created)||doc.created;doc.updated=Number(input.updated)||doc.updated;
  const s=input.style||{}; for(const k of Object.keys(doc.style))if(k in s)doc.style[k]=s[k];
  for(const k of ['bg','ink','accent'])if(!/^#[\da-f]{6}$/i.test(doc.style[k]))doc.style[k]=defaultStyle()[k];
  for(const [k,min,max] of [['width',480,1200],['margin',20,160],['fontSize',14,52],['lineHeight',1.15,3],['letterSpacing',0,8],['paragraphGap',0,90],['watermarkOpacity',0,0.45],['backgroundOpacity',0,0.6],['pageHeight',480,1800],['columns',1,2]])doc.style[k]=clamp(s[k]??doc.style[k],min,max,defaultStyle()[k]);
  for(const k of ['showNames','showTitle','showFooter','indent','watermarkRepeat'])doc.style[k]=Boolean(doc.style[k]);
  for(const k of ['watermark','logo','backgroundImage'])doc.style[k]=String(doc.style[k]||'').slice(0,4000);
  if(!['article','chat','vertical','excerpt','editorial','collage'].includes(doc.style.layout))doc.style.layout='article';
  if(!['long','pages'].includes(doc.style.pageMode))doc.style.pageMode='long';
  if(!['plain','grain','grid','lines','dots'].includes(doc.style.paper))doc.style.paper='plain';
  if(!isFontKey(doc.style.font))doc.style.font='serif';
  const types=['body','h1','h2','quote','list','ordered','code','image','divider','pagebreak'];
  doc.blocks=input.blocks.map(b=>{
    const text=String(b.text??'').slice(0,120000);const q=makeBlock(text,{type:types.includes(b.type)?b.type:'body',speaker:String(b.speaker||'').slice(0,150),isUser:!!b.isUser,align:['left','center','right','justify'].includes(b.align)?b.align:'left'});
    q.id=typeof b.id==='string'?b.id.slice(0,100):q.id;
    if(b.textStyle && typeof b.textStyle==='object')q.textStyle=normalizeTextStyle(b.textStyle);
    q.spans=Array.isArray(b.spans)?b.spans.filter(s=>s && s.start>=0 && s.end>s.start && s.end<=text.length).slice(0,3000).map(s=>({start:s.start,end:s.end,bold:!!s.bold,italic:!!s.italic,underline:!!s.underline,strike:!!s.strike,mark:!!s.mark,...(/^#[\da-f]{6}$/i.test(s.color)?{color:s.color}:{})})):[];
    for(const k of ['src','caption','source'])if(b[k])q[k]=String(b[k]).slice(0,5000);
    q.ratio=['auto','square','wide','portrait'].includes(b.ratio)?b.ratio:'auto';q.fit=b.fit==='contain'?'contain':'cover';q.filter=['none','grayscale','sepia','soft'].includes(b.filter)?b.filter:'none';q.radius=clamp(b.radius||0,0,60,0);q.position=clamp(b.position??50,0,100,50);
    q.positionX=clamp(b.positionX??50,0,100,50);q.zoom=clamp(b.zoom??1,1,3,1);q.imageWidth=clamp(b.imageWidth??100,20,100,100);
    return q;
  }); return doc;
}
export function assetReferences(docs) {return [...new Set(docs.flatMap(d=>[d.style.logo,d.style.backgroundImage,d.style.font.startsWith('custom-')?`asset:${d.style.font.slice(7)}`:'',...d.blocks.flatMap(b=>[b.type==='image'?b.src:'',b.textStyle?.font?.startsWith('custom-')?`asset:${b.textStyle.font.slice(7)}`:''])]).filter(v=>v?.startsWith('asset:')).map(v=>v.slice(6)))];}
export function documentMarkdown(doc) {
  const lines=[`# ${doc.title}`,doc.subtitle,doc.author?`作者：${doc.author}`:'',''];
  for(const b of doc.blocks){const p=b.type==='h1'?'# ':b.type==='h2'?'## ':b.type==='quote'?'> ':'';lines.push(b.type==='image'?`![${b.caption||''}](${b.src||''})`:b.type==='divider'?'---':b.type==='pagebreak'?'<!-- pagebreak -->':b.type==='code'?`\x60\x60\x60\n${b.text}\n\x60\x60\x60`:b.type==='list'?b.text.split('\n').map(t=>'- '+t).join('\n'):b.type==='ordered'?b.text.split('\n').map((t,i)=>`${i+1}. ${t}`).join('\n'):p+b.text,'');}
  return lines.filter(x=>x!==undefined).join('\n');
}
