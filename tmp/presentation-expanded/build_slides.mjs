import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dep="C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies";
process.env.RUNTIME_NODE_MODULES=dep+'/node/node_modules';
const {PresentationFile,FileBlob}=await import(pathToFileURL(dep+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const b='C:/Users/User/Desktop/cookiehome/tmp/presentation-expanded';
const data=JSON.parse(await fs.readFile(b+'/content.json','utf8'));
const p=await PresentationFile.importPptx(await FileBlob.load(b+'/source.pptx'));
const original=[...p.slides.items], order=[], tables=[];
const C={bg:'#F5F3ED',ink:'#203E35',body:'#3C4944',muted:'#66736C',rust:'#9D5D37',white:'#FFFFFF'};
function tx(s,str,x,y,w,h,size=28,color=C.body,bold=false){
 const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=str;q.text.style={fontFamily:'Arial',fontSize:size,color,bold};q.text.insets=0;return q;
}
function clear(s,keepImages=false){
 for(const q of [...s.shapes.items])q.delete();
 if(s.tables.items.length)throw new Error('Expected a table-free source layout');
 if(!keepImages)for(const q of [...s.images.items])q.delete();
}
function base(d,keepImages=false){
 const s=original[keepImages?d.source-1:3].duplicate();clear(s,keepImages);
 tx(s,d.title,72,48,1140,62,42,C.ink,true);
 tx(s,String(d.n).padStart(2,'0'),1184,669,45,24,16,C.muted);
 order.push(s);return s;
}
function bottom(s,str,size=23){tx(s,str,78,626,1120,42,size,C.rust);}
function rows(s,vals,y=168,step=112,lw=390,size=28){
 vals.forEach(([a,v],i)=>{tx(s,a,78,y+i*step,lw-20,78,size,C.ink,true);tx(s,v,78+lw,y+i*step,1120-lw,82,size);});
}
function table(s,n,vals,widths,top=185,rowH=77,size=24){
 const t=s.tables.add({rows:vals.length,columns:vals[0].length,left:65,top,width:1150,height:vals.length*rowH,columnWidths:widths,values:vals});
 t.borders.assign({fill:'#CAD3CB',width:1,style:'solid'});
 for(let r=0;r<vals.length;r++)for(let c=0;c<vals[0].length;c++){
  const cell=t.getCell(r,c);cell.fill=r===0?C.ink:C.white;
  cell.text.style={fontFamily:'Arial',fontSize:size,color:r===0?C.white:C.body,bold:r===0};
 }
 tables.push(n);return t;
}
function notes(s,d){
 const refs=d.refs.map(id=>{const r=data.sources.find(r=>r.id===id);return r.id+' '+r.short+'. '+r.title+'. '+r.url;});
 s.speakerNotes.text=[d.seconds?'Target time: '+Math.floor(d.seconds/60)+':'+String(d.seconds%60).padStart(2,'0'):'Backup / questions',
 'Main point: '+d.cue,'Suggested script:\n'+d.script,'Presenter note: '+d.watch,'Transition: '+d.transition,
 refs.length?'Sources:\n'+refs.join('\n'):'',
 'Prototype status source: project report, README and source code reviewed 16 November 2026. Proposed study design remains subject to supervisor agreement.'].filter(Boolean).join('\n\n');
 if(d.n>=22)s.hidden=true;
}
for(const d of data.slides){
 let s;
 switch(d.kind){
 case 'cover':
  s=original[0];order.push(s);break;
 case 'motivation':
  s=base(d,true);
  tx(s,'A website visit begins\nwith a privacy choice',78,183,510,110,36,C.ink,true);
  tx(s,'Technical category labels\n\nSeveral layers of choices\n\nLimited time and attention',78,340,505,230,29);
  bottom(s,'Can users understand the request and express their choice?');
  break;
 case 'evidence':
  s=base(d);
  tx(s,'22–23',78,165,480,100,88,C.ink,true);
  tx(s,'percentage-point increase in consent',78,275,540,40,27);
  tx(s,'Removing first-page opt-out\nNouwens et al. (2020), n = 40',78,334,520,90,26,C.muted);
  tx(s,'Evidence beyond one study',690,169,500,50,31,C.ink,true);
  tx(s,'Utz et al. (2019)\n80,000+ unique users on one site\nPlacement and choices affected behaviour',690,245,500,130,26);
  tx(s,'Habib et al. (2022)\n1,109 participants\nVisibility affected usable choice',690,425,500,130,26);
  bottom(s,'These findings motivate testing the interface. They do not validate Cookie Homes.',22);
  break;
 case 'problem':
  s=base(d);
  tx(s,'Help users understand cookie purposes\nand express the choices they intend.',78,174,1120,130,41,C.ink,true);
  rows(s,[['Target outcomes','Understanding, choice fidelity and effort'],['Initial scope','Adult users, Chrome connector, Cookiebot inputs'],['Current stage','Working local interaction; user evaluation planned']],350,88,340,27);
  break;
 case 'challenges':
  s=base(d);rows(s,[['Simplify without distorting','An analogy must preserve the meaning of a request.'],['Handle uncertain purposes','A missing or stale declaration limits what we know.'],['Interpret ambiguous answers','“Maybe” should prompt clarification, not consent.'],['Make engagement useful','Enjoyment must support understanding and choice.']],165,111,460,28);break;
 case 'related':
  s=base(d);
  table(s,d.n,[['Reviewed work','Main contribution','Connection to Cookie Homes'],['Consent studies [R1–R3]','Design affects decisions\nand usability','Motivates a fair interface\ncomparison'],['CookieBlock [R4]','Purpose classification\nand cookie enforcement','Related data pipeline;\ndifferent evaluation focus'],['PriBot / Polisis [R5]','Privacy-policy questions\nin natural language','Prior conversational\nprivacy assistance']],[330,395,425],180,100,24);
  bottom(s,'Our contribution: a specific interaction design, implementation and evaluation.',22);break;
 case 'gap':
  s=base(d);
  tx(s,'Does this gamified consent journey improve understanding\nwhile preserving intended choices at acceptable effort?',78,169,1130,120,36,C.ink,true);
  rows(s,[['Primary question','Compare the complete interface with a clear dashboard.'],['Secondary question','Which elements help or hinder the decision process?'],['Claim boundary','The gap concerns this design within the reviewed work.']],350,91,330,27);break;
 case 'analogy':
  s=base(d);table(s,d.n,[['Cookie concept','Home representation','Meaning to preserve'],['Website','Home','The current site context'],['Cookie and purpose','Guest and request','What the site says the cookie does'],['Consent choice','Welcome or refuse','The supported user decision'],['Evidence and uncertainty','Guest details','What is known and what is missing']],[300,350,500],165,79,24);
  bottom(s,'Narrative, scenario tasks, progress and visible outcomes [R6]',23);break;
 case 'features':
  s=base(d);tx(s,'Proposed benefits to test',78,135,1100,40,26,C.muted);
  table(s,d.n,[['User difficulty','Feature','Proposed benefit'],['Technical descriptions','Home and guest analogy','Understand the purpose'],['Abstract privacy choices','Concrete scenarios','Relate the request to intent'],['Questions and uncertainty','Chat and clarification','Express a clear decision'],['Limited attention','Progress and outcomes','Follow the decision process'],['Uncertain purpose evidence','Details and uncertainty labels','Recognise what is unknown']],[365,392,393],205,64,23);break;
 case 'ai':
  s=base(d);rows(s,[['Explain in context','Answer questions about the selected guest.'],['Interpret everyday language','Map an explicit request to supported choices.'],['Clarify uncertainty','Ask before changing an unclear preference.']],170,125,460,29);
  bottom(s,'Compare against fixed controls. Validation cannot guarantee correct interpretation.',22);break;
 case 'architecture':
  s=original[6].duplicate();order.push(s);
  for(const q of s.shapes.items){if(String(q.text).trim()==='07')q.text='11';}
  break;
 case 'inputs':
  s=base(d);table(s,d.n,[['Input','Obtained from','What it tells us'],['Cookie metadata','Chrome cookies API','Stored record attributes'],['Consent snapshot JSON','Selected window.Cookiebot fields','Current category choices'],['Purpose declaration','Public site declaration pages','Declared purposes and categories']],[285,450,415],180,100,24);
  bottom(s,'Values are excluded from onward payloads. A declaration is not proof of behaviour.',22);break;
 case 'progress':
  s=base(d,true);
  tx(s,'Implemented',785,188,410,45,31,C.ink,true);
  tx(s,'Site-input connector\nHome and guest journey\nChat and local choice state',785,252,410,150,28);
  tx(s,'Planned',785,439,410,45,31,C.rust,true);
  tx(s,'Verified CMP write-back\nFull extension interface\nComparative user study',785,500,410,135,28);
  break;
 case 'demo':
  s=base(d);
  rows(s,[['1  Inspect','Show the source and purpose of one request.'],['2  Decide','Make a clear choice and inspect the local result.'],['3  Clarify','Try an uncertain response and review the outcome.']],174,130,310,31);
  bottom(s,'Current demo changes local state. Website consent remains unchanged.',24);break;
 case 'safeguards':
  s=base(d);tx(s,'Implemented controls',78,170,500,46,32,C.ink,true);
  tx(s,'Validate actions and guest IDs\n\nProtect the essential category\n\nClear decisions when ambiguity is flagged\n\nKeep unknown purposes visible',78,235,530,300,27);
  tx(s,'Remaining work',710,170,500,46,32,C.rust,true);
  tx(s,'Detect semantic interpretation errors\n\nReview before external write-back\n\nTest source quality and adversarial input\n\nReconcile two failing local tests',710,235,500,300,27);
  bottom(s,'Local suite on 16 Nov 2026: 11 passed, 2 failed. Live AI accuracy is unmeasured.',22);break;
 case 'alternatives':
  s=base(d);table(s,d.n,[['Approach','Reason to consider it','Trade-off'],['Category dashboard','Direct, familiar controls','Category labels need explanation'],['Fixed scenario cards','Context with predictable choices','Limited open-ended support'],['Conversational journey','Questions and flexible expression','Latency, errors and data handling']],[325,400,425],180,105,24);
  bottom(s,'Keep the simpler option if it meets the user need with less effort.',24);break;
 case 'study':
  s=base(d);rows(s,[['Core comparison','Cookie Homes vs a clear category dashboard'],['Fair tasks','Equivalent information, counterbalanced order'],['Reference choices','Explicit task intent plus participant confirmation'],['Optional comparison','Fixed scenario cards to examine chat contribution']],168,111,390,28);
  bottom(s,'Pilot first. Agree sample size, primary outcomes and analysis before the main study.',22);break;
 case 'metrics':
  s=base(d);table(s,d.n,[['Outcome','Proposed measure'],['Understanding','Purpose and consequence questions; transfer example'],['Choice fidelity','Agreement with intent; unintended changes; clarifications'],['Effort and usability','Completion, time and perceived difficulty'],['Engagement','Interest, attention and willingness to reuse'],['Reliability','Unsupported actions, uncertainty and write-back outcomes']],[320,830],160,76,24);
  bottom(s,'Acceptance rate alone is not success. Report null and negative findings.',23);break;
 case 'roadmap':
  s=base(d);table(s,d.n,[['Next-semester period','Priority','Expected output'],['Weeks 1–2','Protocol, baseline and integration risks','Agreed study and technical scope'],['Weeks 3–5','Extension journey and supported write-back','Installable prototype'],['Weeks 6–7','Pilot and reliability fixes','Revised tasks and interface'],['Weeks 8–10','User study and analysis','Evidence about user benefit'],['Weeks 11–12','Refinement and reporting','Final prototype and findings']],[285,470,395],160,74,23);
  bottom(s,'Fallback: explicit hand-off to site controls, with a narrower decision-support claim.',22);break;
 case 'conclusion':
  s=base(d);tx(s,'Can a gamified analogy help users\nmake informed cookie choices?',78,178,1130,140,44,C.ink,true);
  rows(s,[['Problem','Consent design can affect decisions and usability.'],['Progress','The interaction and data connector are implemented.'],['Next evidence','Compare understanding, intended choices and effort.']],366,83,250,28);break;
 case 'questions':
  s=base(d);for(const q of [...s.shapes.items])if(q.position.top<100)q.delete();
  tx(s,'Thank you',400,242,600,95,68,C.ink,true);
  tx(s,'Questions and discussion',400,370,700,65,34,C.body);
  bottom(s,'Backup slides: integration, study validity, data flow and references.',23);break;
 case 'writeback':
  s=base(d);rows(s,[['Candidate API','Cookiebot.submitCustomConsent at category level'],['Granularity conflict','Resolve mixed guest choices before applying a category.'],['Verification','Read CMP state back; assess site behaviour separately.'],['Fallback','Hand off clearly to the site’s consent controls.']],168,111,345,28);
  bottom(s,'Documented method [R8]. Current prototype does not implement write-back.',22);break;
 case 'validity':
  s=base(d);table(s,d.n,[['Threat','Planned response'],['Learning and order','Counterbalance order; use equivalent tasks'],['Novelty and demand effects','Neutral instructions; objective measures; limit claims'],['Uncertain preference reference','Confirm intent; separate learning from errors'],['Unequal interfaces','Use the same substantive information and a fair baseline'],['Small sample / component confounds','Report uncertainty; scope claims to the tested comparison']],[420,730],165,75,24);break;
 case 'privacy':
  s=base(d);rows(s,[['External processing','Messages and selected context can go to Gemini.'],['Data minimisation','Exclude cookie values; limit context and retention.'],['Source limits','Declarations and stored cookies are partial evidence.'],['Failure handling','Keep choices unchanged and show recoverable errors.']],168,111,350,28);
  bottom(s,'Before participants: clear disclosure, approved protocol and adversarial checks.',22);break;
 case 'references':
  s=base(d);
  d.referenceIds.forEach((id,i)=>{const r=data.sources.find(x=>x.id===id);const y=155+i*118;
   tx(s,id+'  '+r.short,78,y,1120,32,26,C.ink,true);
   tx(s,r.title,78,y+36,1120,60,24,C.body);
   tx(s,r.venue,78,y+94,1120,25,18,C.muted);
  });break;
 default:throw new Error(d.kind);
 }
 notes(s,d);
}
const keep=new Set(order.map(s=>s.id));
p.slides.keep(p.slides.items.map((s,i)=>keep.has(s.id)?i:null).filter(i=>i!==null));
order.forEach((s,i)=>s.moveTo(i));
await fs.writeFile(b+'/table-owners.json',JSON.stringify(tables));
await (await PresentationFile.exportPptx(p)).save(b+'/candidate.pptx');
await fs.mkdir(b+'/render',{recursive:true});
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(b+'/render/slide-'+(i+1)+'.png',new Uint8Array(await blob.arrayBuffer()));
}
console.log('Created '+p.slides.items.length+' slides with speaker notes; backup slides 22–26 hidden.');
