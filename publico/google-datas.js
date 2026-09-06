(function(){
// Pure extraction: mail is data, never commands. No model or external link execution.
const SCOPES='https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.app.created';
const CLIENT_ID='41350662840-21p2a062djc5du99idb12akjv2lq5gnj.apps.googleusercontent.com';
const ORIGIN='https://leogpereira-afk.github.io';
const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const shift=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const decode=s=>new TextDecoder().decode(Uint8Array.from(atob(String(s||'').replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
function mailText(payload){let plain=[],html=[];function walk(p,n=0){if(!p||n>12)return;if(p.body?.data&&!p.filename){if(p.mimeType==='text/plain')plain.push(decode(p.body.data));if(p.mimeType==='text/html')html.push(decode(p.body.data))}(p.parts||[]).forEach(x=>walk(x,n+1))}walk(payload);return (plain.length?plain.join('\n'):html.join('\n').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<(?:br|\/p|\/div|\/tr)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&')).slice(0,100000)}
const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00Z'))&&new Date(s+'T12:00Z').toISOString().slice(0,10)===s;
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function extractDates(msg,today=day(Date.now())){
 const header=n=>(msg.payload?.headers||[]).find(h=>h.name.toLowerCase()===n)?.value||'';
 const title=clean(header('subject')).slice(0,180)||'Data recebida por e-mail';
 const sender=clean(header('from')).slice(0,180);
 const lines=(title+'\n'+mailText(msg.payload)).split(/\n|(?<=[.!?])\s+/).map(clean).filter(Boolean);
 const items=[];const seen=new Set();
 for(const line of lines){
  const text=fold(line),kind=/renov|vigencia/.test(text)?'Renovação':/venc|boleto|fatura|pagamento|parcela|cobranca/.test(text)?'Financeiro':/compromisso|reuniao|consulta|agendad|audiencia|evento|entrevista|reserva|entrega|prazo/.test(text)?'Compromisso':'';
  if(!kind)continue;
  // A long paragraph can contain dates belonging to unrelated clauses: review it.
  const matches=[...text.matchAll(/\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})|(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4}))\b/g)];
  for(const m of matches){
   const date=m[1]?`${m[1]}-${m[2]}-${m[3]}`:m[4]?`${m[6]}-${m[5].padStart(2,'0')}-${m[4].padStart(2,'0')}`:`${m[9]}-${String(months.indexOf(m[8])+1).padStart(2,'0')}-${m[7].padStart(2,'0')}`;
   if(!dateOK(date)||date<today||seen.has(kind+date))continue;seen.add(kind+date);
   const uncertain=matches.length>1||line.length>350||/cancelad|pago|pagamento (?:recebido|confirmado)|quitad|exemplo|simulacao|se voce|caso voce|poder[aá]|previs[aã]o|nascimento|emissao/.test(text);
   // Explicit numeric dates beside an actionable label only. The rest stays reviewable.
   const before=text.slice(Math.max(0,m.index-55),m.index);
   const direct=/\b(?:vencimento|vence|vencera|renovacao|renova|renovara|prazo|agendad[oa]|reuniao|consulta|compromisso|evento|audiencia|entrega|pagamento|parcela|cobranca)(?:\s+(?:automatic[ao]|em|no dia|para|ate|dia|previst[ao]|da|de|do|fatura|boleto|assinatura|contrato))*\s*[:–-]?\s*$/.test(before);
   const automatic=direct&&!uncertain;
   items.push({key:`mail:${msg.id}:${kind}:${date}`,title:`${kind} · ${title}`,date,kind,status:automatic?'ready':'review',sourceId:msg.id,sourceVersion:Number(msg.internalDate)||0,excerpt:line.slice(0,400),sender,reason:automatic?'Data explícita vinculada ao compromisso':'Confira o significado desta data antes de criar o lembrete'});
  }
  if(!matches.length&&/\b\d{1,2}[\/-]\d{1,2}\b|amanha|hoje|proxima|segunda|terca|quarta|quinta|sexta/.test(text)&&!seen.has('amb:'+line)){
   seen.add('amb:'+line);items.push({key:`review:${msg.id}:${items.length}`,title:`${kind} · ${title}`,date:'',kind,status:'review',sourceId:msg.id,sourceVersion:Number(msg.internalDate)||0,excerpt:line.slice(0,400),sender,reason:'Data incompleta ou relativa; informe a data completa'});
  }
 }
 return items.slice(0,40);
}
function extractICS(text,msg,ICAL,today=day(Date.now())){
 const calendar=new ICAL.Component(ICAL.parse(text)),method=String(calendar.getFirstPropertyValue('method')||'').toUpperCase();
 if(!['','REQUEST','PUBLISH','CANCEL'].includes(method))return [];
 return calendar.getAllSubcomponents('vevent').map(e=>{
  const uid=e.getFirstPropertyValue('uid');if(!uid)return null;
  const base={key:'ics:'+uid,title:String(e.getFirstPropertyValue('summary')||'Convite'),kind:'Compromisso',sourceId:msg.id,sourceVersion:Number(e.getFirstPropertyValue('sequence'))||0,received:Number(msg.internalDate)||0,excerpt:'Convite de calendário recebido por e-mail',sender:'',date:''};
  if(method==='CANCEL'||e.getFirstPropertyValue('status')==='CANCELLED')return {...base,status:'review',reason:'Cancelamento recebido; confira o evento original'};
  const start=e.getFirstPropertyValue('dtstart'),end=e.getFirstPropertyValue('dtend');if(!start)return null;
  if(e.hasProperty('rrule')||e.hasProperty('recurrence-id')||e.hasProperty('rdate'))return {...base,key:base.key+':recorrente',status:'review',reason:'Convite recorrente: use a conexão do Google Agenda para importar a série'};
  function convert(t){if(t.isDate)return {date:t.toString()};const tz=String(t.zone.tzid);const p=t.toString();if(tz==='floating'||tz==='America/Sao_Paulo')return {dateTime:p.slice(0,19)+'-03:00',timeZone:'America/Sao_Paulo'};if(t.zone===ICAL.Timezone.utcTimezone||t.zone.component)return {dateTime:t.toJSDate().toISOString(),timeZone:'America/Sao_Paulo'};throw Error('Fuso não reconhecido')}
  try{
   const a=convert(start),b=end?convert(end):a.date?{date:shift(a.date,1)}:{dateTime:new Date(Date.parse(a.dateTime)+3600e3).toISOString(),timeZone:'America/Sao_Paulo'};
   const date=a.date||day(a.dateTime);if(date<today)return null;
   const rawTz=e.getFirstProperty('dtstart').getParameter('tzid');
   const unknown=rawTz&&start.zone.tzid==='floating'&&rawTz!=='America/Sao_Paulo';
   return {...base,date,start:a,end:b,status:unknown?'review':'ready',reason:unknown?'Fuso não reconhecido; confira horário':'Convite com data definida',location:String(e.getFirstPropertyValue('location')||'')};
  }catch{return {...base,status:'review',reason:'Confira a data e o fuso deste convite'}}
 }).filter(Boolean);
}
async function eventId(key){return 'leo'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),x=>x.toString(16).padStart(2,'0')).join('')}
function calendarEvent(item,id){
 if(!dateOK(item.date))throw Error('Data inválida');
 const start=item.start||{date:item.date},end=item.end||{date:shift(item.date,1)};
 return {id,summary:item.title.slice(0,200),description:`${item.reason||''}\n${item.excerpt||''}\nOrigem: Gmail (${item.sender||''})\nhttps://mail.google.com/mail/u/0/#all/${item.sourceId}`,start,end,location:item.location||'',visibility:'private',transparency:'transparent',reminders:{useDefault:false,overrides:[{method:'popup',minutes:1440},{method:'popup',minutes:60}]},extendedProperties:{private:{leoSource:id}}};
}
function gmailQuery(after,before){return `after:${after} before:${before} -in:spam -in:trash {filename:ics convite invitation vencimento vence renovação renovacao boleto fatura pagamento parcela cobrança cobranca compromisso reunião reuniao consulta agendado agendada prazo entrega reserva}`}

globalThis.LeoGoogleDatas={day,shift,decode,mailText,extractDates,extractICS,eventId,calendarEvent,gmailQuery};
})();
