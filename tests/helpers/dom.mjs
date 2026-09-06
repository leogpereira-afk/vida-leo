import '../../publico/google-datas.js';
import ICAL from 'ical.js';
import {parseHTML} from 'linkedom';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../publico/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).replace(/if\(temSessao\(\)\)\{menu\(\);tela\(\);puxarNuvem[\s\S]*$/,'');
export function setup(){const {document,HTMLElement}=parseHTML(html);HTMLElement.prototype.scrollIntoView=function(){};HTMLElement.prototype.focus=function(){};
const storage={getItem:()=>null,setItem(){},removeItem(){}};
const ctx=vm.createContext({LeoGoogleDatas:globalThis.LeoGoogleDatas,ICAL,atob,btoa,document,window:{addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})},location:{hostname:'localhost',hash:''},history:{pushState(){}},localStorage:storage,sessionStorage:storage,console,structuredClone,Date,URL,Blob,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},alert(){},confirm:()=>false});
vm.runInContext(source,ctx);
vm.runInContext("fmResumo=async()=>({});arqTotal=async()=>({n:0,b:0,fila:0});arqPor=async()=>[];apiEquipe=async()=>({usuarios:[],historico:[]});",ctx);
return {ctx,document,run:s=>vm.runInContext(s,ctx)};}
