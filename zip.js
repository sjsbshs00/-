const encoder=new TextEncoder();
const crcTable=Array.from({length:256},(_,i)=>{let v=i;for(let j=0;j<8;j++)v=(v&1)?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function header(size, signature) {const a=new Uint8Array(size),v=new DataView(a.buffer);v.setUint32(0,signature,true);return [a,v];}
export async function zipFiles(entries) {
  const pieces=[],central=[];let offset=0,centralSize=0;
  for(const {name,data} of entries) {
    const n=encoder.encode(name),b=data instanceof Blob?new Uint8Array(await data.arrayBuffer()):typeof data==='string'?encoder.encode(data):data;
    const crc=crc32(b),[h,v]=header(30,0x04034b50);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);
    pieces.push(h,n,b);
    const [c,w]=header(46,0x02014b50);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,b.length,true);w.setUint32(24,b.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);
    central.push(c,n);centralSize+=c.length+n.length;offset+=h.length+n.length+b.length;
  }
  const [end,v]=header(22,0x06054b50);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...pieces,...central,end],{type:'application/zip'});
}
export async function unzipOwn(file) {
  if(file.size>120*1024*1024)throw new Error('备份超过 120 MB，请拆分');
  const a=new Uint8Array(await file.arrayBuffer()),v=new DataView(a.buffer),out=new Map();let p=0;
  while(p+30<=a.length && v.getUint32(p,true)===0x04034b50){
    const method=v.getUint16(p+8,true),flags=v.getUint16(p+6,true),size=v.getUint32(p+18,true),nl=v.getUint16(p+26,true),el=v.getUint16(p+28,true),start=p+30+nl+el;
    if(method!==0 || flags&8)throw new Error('请导入由拾页导出的作品备份');
    if(start+size>a.length)throw new Error('备份文件不完整');
    const name=new TextDecoder().decode(a.slice(p+30,p+30+nl)),bytes=a.slice(start,start+size);
    if(crc32(bytes)!==v.getUint32(p+14,true))throw new Error('备份校验失败');
    if(!name.includes('..')&&!name.startsWith('/'))out.set(name,bytes);p=start+size;
  }
  if(!out.size)throw new Error('没有读取到作品文件');return out;
}
