export class AssetStore {
  constructor(name='shiyepress-assets-v1'){this.name=name;this.cache=new Map();this.loadedFonts=new Map();}
  async db(){if(!this.promise)this.promise=new Promise((resolve,reject)=>{const r=indexedDB.open(this.name,1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return this.promise;}
  async put(key,blob){const db=await this.db();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(blob,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});this.cache.delete('asset:'+key);}
  async get(key){const db=await this.db();return new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async image(src){
    if(!src)return null;if(this.cache.has(src))return this.cache.get(src);
    const promise=(async()=>{let blob;
      if(src.startsWith('asset:'))blob=await this.get(src.slice(6));
      else {const url=new URL(src,location.href);if(!['http:','https:'].includes(url.protocol))throw new Error('图片链接仅支持 http / https');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url,{signal:controller.signal,credentials:url.origin===location.origin?'same-origin':'omit',mode:'cors'});if(!r.ok)throw new Error(`图片响应 ${r.status}`);blob=await r.blob();}finally{clearTimeout(timer);}}
      if(!blob)throw new Error('本地图片已不可用，请重新上传或导入含图片的备份');
      if(blob.size>25*1024*1024)throw new Error('单张图片需小于 25 MB');
      const url=URL.createObjectURL(blob);try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('无法读取图片，请使用 PNG / JPEG / WebP'));image.src=url;});return image;}finally{URL.revokeObjectURL(url);}
    })();this.cache.set(src,promise);return promise;
  }
  async font(key){if(!key.startsWith('custom-'))return null;if(this.loadedFonts.has(key))return this.loadedFonts.get(key);const blob=await this.get(key.slice(7));if(!blob)throw new Error('本地字体不可用，请重新上传');const face=new FontFace(key,await blob.arrayBuffer());await face.load();document.fonts.add(face);this.loadedFonts.set(key,face);return face;}
}
