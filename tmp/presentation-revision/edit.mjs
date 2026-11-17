import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dep='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=dep+'/node/node_modules';
const {PresentationFile,FileBlob}=await import(pathToFileURL(dep+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const root='C:/Users/User/Desktop/cookiehome';const build=root+'/tmp/presentation-revision';
const p=await PresentationFile.importPptx(await FileBlob.load(build+'/original.pptx'));
p.slides.keep([3]);
const C={bg:'#F5F3ED',ink:'#203E35',body:'#3C4944',muted:'#66736C',rust:'#9D5D37',white:'#FFFFFF'};
function text(s,str,x,y,w,h,size=28,color=C.body,bold=false){const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=str;q.text.style={fontFamily:'Arial',fontSize:size,color,bold};return q;}
const challenge=p.slides.items[0];const features=challenge.duplicate();const gap=features.duplicate();
function reset(s,title,num){const titleShape=s.shapes.items.find(x=>x.position.top<100);const footer=s.shapes.items.find(x=>x.position.left>1100&&x.position.top>640);for(const q of s.shapes.items)if(q!==titleShape&&q!==footer)q.delete();titleShape.text=title;footer.text=num;return s;}
reset(challenge,'Why is the problem challenging?','04');
const challenges=[
 ['Simplify without distorting','An analogy must preserve the cookie’s purpose.'],
 ['Handle uncertain purposes','Missing declarations limit what we can explain.'],
 ['Interpret ambiguous answers','“Is this tracking me?” is a question, not consent.'],
 ['Make engagement useful','Enjoyment must lead to better understanding.']
];
challenges.forEach(([a,b],i)=>{text(challenge,a,70,165+i*108,445,72,29,C.ink,true);text(challenge,b,550,165+i*108,660,80,28);});
text(challenge,'The design must preserve meaning and the user’s intended choice.',70,619,1130,42,24,C.rust);
challenge.speakerNotes.text='The problem involves more than replacing technical terms with pictures. First, an analogy can simplify a request but must not misrepresent its purpose or safety. Second, cookie metadata alone does not establish purpose; public declarations can be incomplete or stale. Third, a question or an uncertain response must not be treated as permission. Clarify before applying a decision. Finally, engagement is useful only if users understand requests and retain control. Enjoyment alone cannot establish that consent is informed. Sources: project report, Chapters 2, 4 and 5; src/engine/input-adapter.js, src/engine/rules.js and server.js. These are design challenges, not claimed user-study findings.';
reset(features,'How each feature addresses the problem','05');
text(features,'Each feature has a proposed benefit to evaluate',70,140,1130,55,27,C.ink);
const vals=[['User difficulty','Design response','Intended benefit'],
['Technical cookie descriptions','Home and guest analogy','Understand the purpose'],
['Abstract privacy choices','Concrete scenarios','Connect requests to wishes'],
['Questions or unclear answers','Chatbot and clarification','Express the intended choice'],
['Limited attention','Scenario journey and progress','Stay engaged with the decision'],
['Uncertain purpose evidence','Details and uncertainty labels','Recognise what is unknown']];
const table=features.tables.add({rows:6,columns:3,left:65,top:210,width:1150,height:372,columnWidths:[365,392,393],values:vals});
table.borders.assign({fill:'#CAD3CB',width:1,style:'solid'});
for(let r=0;r<6;r++)for(let c=0;c<3;c++){const cell=table.getCell(r,c);cell.fill=r===0?C.ink:C.white;cell.text.style={fontFamily:'Arial',fontSize:23,color:r===0?C.white:C.body,bold:r===0};}
text(features,'Evaluate understanding, choice accuracy, effort and engagement.',70,635,1130,42,24,C.rust);
features.speakerNotes.text='This maps the user problem to each implemented design feature and its intended benefit. The benefits are hypotheses for evaluation. The home and guest analogy explains purpose; the technical details remain inspectable. Concrete scenarios make requests easier to relate to personal preferences. The chatbot provides a way to ask questions and clarify ambiguous answers, but it introduces interpretation risk, so structured decisions are validated by the rules engine. Progress feedback is intended to sustain attention; measure whether it helps without adding too much effort. Purpose evidence and uncertainty labels let users see limits rather than assume all purposes are verified. For each feature, gather task measures and participant explanations. Source: report Sections 2.2–2.3, Chapter 4 and Chapter 5; current prototype code.';
reset(gap,'The research gap','06');
text(gap,'Existing work',70,162,350,50,31,C.ink,true);
text(gap,'Consent interface studies explain how design affects choices.\nCookieBlock classifies cookies and enforces preferences.',450,162,760,120,27);
text(gap,'Gap in reviewed work',70,323,350,85,31,C.ink,true);
text(gap,'The reviewed works do not evaluate this gamified journey.\nIts effect on understanding and choice accuracy is untested.',450,323,760,115,27,C.ink);
text(gap,'Our contribution',70,500,350,55,31,C.ink,true);
text(gap,'A working Cookie Homes prototype and a planned\ncomparison with conventional consent controls.',450,500,760,100,27);
text(gap,'This gap is scoped to the reviewed works; effectiveness remains to be tested.',70,628,1130,38,22,C.rust);
gap.speakerNotes.text='Define the gap with reference to the reviewed works. Nouwens et al. study how consent interface design affects decisions. CookieBlock classifies cookies and enforces user preferences; its classification approach does not evaluate this project’s conversational home and guest journey. Cookie Homes asks how users understand requests and express the preferences that consent mechanisms act on. The contribution is the designed and implemented interaction plus a planned evaluation of understanding, fidelity to intent, usability and engagement. Do not claim that no gamified privacy system exists or that effectiveness has already been established. Sources: Nouwens, M., Liccardi, I., Veale, M., Karger, D. and Kagal, L. (2020). Dark Patterns after the GDPR: Scraping Consent Pop-ups and Demonstrating their Influence. CHI. https://doi.org/10.1145/3313831.3376321 ; Bollinger, D., Kubicek, K., Cotrini, C. and Basin, D. (2022). Automating Cookie Consent and GDPR Violation Detection. USENIX Security. https://www.usenix.org/conference/usenixsecurity22/presentation/bollinger ; project report Chapters 3–5.';
await (await PresentationFile.exportPptx(p)).save(build+'/edited-section.pptx');
for(let i=0;i<3;i++){const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(build+'/slide-'+(i+4)+'.png',new Uint8Array(await blob.arrayBuffer()));}
console.log('Built replacement slide and two new slides from source layout.');
