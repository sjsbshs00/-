import {mountEditor} from './editor.js';
import {KEY,plainText} from './core.js';
let editor,opening,host,launcher,settingsButton,observer,enabled=true;
let saveImmediate;
const subscriptions=[];
function context(){return globalThis.SillyTavern?.getContext?.();}
function sources(){const c=context();return (c?.chat||[]).map((m,index)=>({id:String(index),index,text:plainText(m.mes||''),speaker:m.name||(m.is_user?c.name1:c.name2)||'角色',isUser:!!m.is_user,source:String(c.chatId||c.getCurrentChatId?.()||'')+'#'+index}));}
const adapter={
  async read(){return context()?.extensionSettings?.[KEY]||{docs:[]};},
  async write(data){const c=context();if(!c?.extensionSettings||typeof c.saveSettingsDebounced!=='function')throw new Error('当前酒馆缺少扩展设置接口，请更新酒馆');c.extensionSettings[KEY]=data;if(!saveImmediate){const main=await import('/script.js');saveImmediate=main.saveSettings;}if(typeof saveImmediate==='function')await saveImmediate();else c.saveSettingsDebounced();},
  getSources:sources,
  sourceName(){const c=context();return c?.groupId?'当前群聊':c?.name2||'当前聊天';}
};
async function openEditor(){
  if(editor){host.style.display='block';editor.updateSources(sources());return editor;}
  if(opening)return opening;
  opening=(async()=>{host=document.createElement('div');host.id='shiyepress-editor';host.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#f8f8f5;height:100dvh';document.body.append(host);try{editor=await mountEditor(host,{adapter,sources:sources(),onClose(){host.style.display='none';}});return editor;}catch(e){host.remove();throw e;}finally{opening=null;}})();return opening;
}
function notifyError(e){const c=context();if(c?.toastr)c.toastr.error(e.message,'拾页');else if(globalThis.toastr)globalThis.toastr.error(e.message,'拾页');else alert('拾页：'+e.message);}
function addMessageButtons(){if(!enabled)return;document.querySelectorAll('#chat .mes[mesid]').forEach(message=>{
  const group=message.querySelector('.mes_buttons');if(!group||group.querySelector('.shiyepress-bookmark'))return;
  const button=document.createElement('button');button.className='shiyepress-bookmark';button.type='button';button.title='收藏这条消息到拾页';button.setAttribute('aria-label','收藏到拾页');button.textContent='▧';button.style.cssText='background:transparent;border:0;color:inherit;padding:3px 6px;cursor:pointer;font-size:16px;opacity:.75';
  button.addEventListener('click',async()=>{try{const index=Number(message.getAttribute('mesid')),m=sources()[index];if(!m)return;const app=await openEditor();app.addExcerpt(m.text,m.speaker,m.isUser);}catch(e){notifyError(e);}});group.append(button);
});}
function initialize(){
  if(launcher||!enabled)return;
  launcher=document.createElement('button');launcher.id='shiyepress-launcher';launcher.type='button';launcher.textContent='▧ 拾页';launcher.title='打开聊天收藏与排版';launcher.setAttribute('aria-label','打开拾页');launcher.style.cssText='position:fixed;right:14px;top:calc(65px + env(safe-area-inset-top,0px));z-index:2500;border:1px solid #ced9ca;border-radius:8px;padding:7px 11px;min-height:44px;background:#f6f8f2;color:#52654e;cursor:pointer;font-size:12px;box-shadow:0 3px 12px #0001';launcher.onclick=()=>openEditor().catch(notifyError);document.body.append(launcher);
  const settings=document.querySelector('#extensions_settings2')||document.querySelector('#extensions_settings');if(settings){settingsButton=document.createElement('div');settingsButton.id='shiyepress-settings';settingsButton.innerHTML='<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>拾页 · 聊天收藏排版</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><p>选取聊天片段，排版成图片。作品可自动保存、再次编辑。</p><button type="button" class="menu_button" aria-label="打开拾页编辑器">打开拾页</button></div></div>';settingsButton.querySelector('button').onclick=()=>openEditor().catch(notifyError);settings.append(settingsButton);}
  const c=context();for(const name of ['CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_DELETED']){const event=c?.event_types?.[name];if(event){const handler=()=>{addMessageButtons();if(editor&&host.style.display!=='none')editor.updateSources(sources());};c.eventSource.on(event,handler);subscriptions.push([event,handler]);}}
  let scheduled=false;observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;addMessageButtons();});});const chat=document.querySelector('#chat');if(chat)observer.observe(chat,{childList:true,subtree:true});addMessageButtons();
}
export function onEnable(){enabled=true;initialize();}
export async function onDisable(){enabled=false;observer?.disconnect();const c=context();for(const [event,handler] of subscriptions)c?.eventSource?.removeListener?.(event,handler);subscriptions.length=0;launcher?.remove();settingsButton?.remove();document.querySelectorAll('.shiyepress-bookmark').forEach(b=>b.remove());launcher=null;settingsButton=null;if(editor)await editor.destroy();editor=null;host=null;}
const c=context();if(c?.eventSource&&c.event_types?.APP_READY)c.eventSource.on(c.event_types.APP_READY,initialize);else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
