import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dep="C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies";
const {PresentationFile,FileBlob}=await import(pathToFileURL(dep+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const b='C:/Users/User/Desktop/cookiehome/tmp/presentation-expanded';
const p=await PresentationFile.importPptx(await FileBlob.load(b+'/source.pptx'));
await fs.mkdir(b+'/source-render',{recursive:true});
console.log(await p.inspect({kind:'layout',maxChars:1500}));
for(let i=0;i<p.slides.items.length;i++){
 const s=p.slides.items[i];
 const blob=await p.export({slide:s,format:'png',scale:1});
 await fs.writeFile(b+'/source-render/slide-'+(i+1)+'.png',new Uint8Array(await blob.arrayBuffer()));
}
await fs.writeFile(b+'/source-shapes.json',JSON.stringify(p.slides.items.map((s,i)=>({slide:i+1,id:s.id,shapes:s.shapes.items.map(q=>({id:q.id,text:String(q.text),position:q.position,style:q.text.style})),images:s.images.items.map(q=>({id:q.id,frame:q.frame,alt:q.alt}))})),null,2));
console.log('Rendered all source slides.');
