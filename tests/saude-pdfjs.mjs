import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const vendor=new URL('../publico/vendor/pdfjs-6.4.299/',import.meta.url);
test('arquivos PDF.js correspondem ao manifesto local e o patch limita-se ao fallback global',()=>{
 const manifest=readFileSync(new URL('SHA256SUMS',vendor),'utf8').trim().split('\n');
 for(const line of manifest){const [hash,file]=line.split('  ');assert.equal(createHash('sha256').update(readFileSync(new URL(file,vendor))).digest('hex'),hash,file)}
 // Reverter o patch documentado precisa reproduzir os hashes upstream.
 const upstream=Object.fromEntries(readFileSync(new URL('UPSTREAM-SHA256SUMS',vendor),'utf8').trim().split('\n').map(l=>l.split('  ').reverse()));
 for(const file of ['pdf.min.mjs','pdf.worker.min.mjs']){
  const s=readFileSync(new URL(file,vendor),'utf8');assert.doesNotMatch(s,/\b(?:eval|Function)\s*\(/);
  // O fallback do core-js varia conforme a minificação. O manifesto registra
  // os originais; a reconstrução deve ser exata e única.
  const patched='||globalThis',revertido=s.replace(patched,'||Function("return this")()');
  assert.notEqual(revertido,s);assert.equal(createHash('sha256').update(revertido).digest('hex'),upstream[file]);
 }
});
function canvasPath(){for(const r of [createRequire(import.meta.url),createRequire(resolve(dirname(process.execPath),'../node_modules/__canvas_probe.cjs'))]){try{return r.resolve('@napi-rs/canvas')}catch{}}return null}
function pdfFicticio(){
 const objetos=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(const txt of ['Documento ficticio A','Pagina ficticia B']){const s=`BT /F1 18 Tf 40 400 Td (${txt}) Tj ET\n`;objetos.push(`<< /Length ${s.length} >>\nstream\n${s}endstream`)}
 let pdf='%PDF-1.4\n',offsets=[0];for(const [i,o] of objetos.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objetos.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objetos.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);
}
test('motor real renderiza PDF fictício em Canvas sem eval, sem rede, com duas páginas e zoom',t=>{
 const canvas=canvasPath();if(!canvas){t.skip('Canvas nativo opcional não disponível no Node; execute no runtime desktop ou no navegador.');return}
 const code=`import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {DOMMatrix,Path2D,ImageData,createCanvas}=require(${JSON.stringify(canvas)});Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});globalThis.fetch=()=>{throw Error('Rede não autorizada neste teste')};const p=await import(${JSON.stringify(new URL('pdf.min.mjs',vendor).href)});p.GlobalWorkerOptions.workerSrc=${JSON.stringify(new URL('pdf.worker.min.mjs',vendor).href)};const task=p.getDocument({data:new Uint8Array(Buffer.from(${JSON.stringify(pdfFicticio().toString('base64'))},'base64')),useSystemFonts:true,disableFontFace:true,isEvalSupported:false,enableXfa:false,disableWorkerRendering:true});try{const doc=await task.promise,results=[];for(const [n,scale] of [[1,1],[2,1.5]]){const page=await doc.getPage(n),vp=page.getViewport({scale}),canvas=createCanvas(vp.width,vp.height);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:vp}).promise;const px=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let dark=0;for(let i=0;i<px.length;i+=4)if(px[i]<100&&px[i+1]<100&&px[i+2]<100)dark++;results.push({width:canvas.width,height:canvas.height,dark,text:(await page.getTextContent()).items.map(i=>i.str).join(' ')})}console.log(JSON.stringify({version:p.version,pages:doc.numPages,results}))}finally{await task.destroy()}`;
 const run=spawnSync(process.execPath,['--disallow-code-generation-from-strings','--input-type=module'],{input:code,encoding:'utf8',timeout:30000,cwd:dirname(new URL(import.meta.url).pathname)});assert.equal(run.status,0,(run.stderr||'').slice(-1500));const lines=run.stdout.trim().split('\n'),r=JSON.parse(lines.at(-1));assert.equal(r.version,'6.4.299');assert.equal(r.pages,2);assert.equal(r.results[0].width,400);assert.equal(r.results[1].width,600);assert.ok(r.results.every(x=>x.dark>100));assert.equal(r.results[0].text,'Documento ficticio A');assert.equal(r.results[1].text,'Pagina ficticia B');
});
