from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from copy import deepcopy
import hashlib, json

root=Path('C:/Users/User/Desktop/cookiehome'); b=root/'tmp/presentation-expanded'
out=root/'output/presentation-expanded';out.mkdir(exist_ok=True)
ref=Path('C:/Users/User/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx')
data=json.loads((b/'content.json').read_text(encoding='utf-8'));faqs=json.loads((b/'faq.json').read_text(encoding='utf-8'))
with ZipFile(ref) as z: parts={n:z.read(n) for n in z.namelist()}
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};W='{'+ns['w']+'}'
d=E.fromstring(parts['word/document.xml']);body=d.find('w:body',ns);orig=list(body)
def replace(el,text):
 ts=el.findall('.//w:t',ns)
 if not ts:
  p=el if el.tag==W+'p' else el.find('.//w:p',ns)
  if p is None:p=E.SubElement(el,W+'p')
  r=E.SubElement(p,W+'r');ts=[E.SubElement(r,W+'t')]
 ts[0].text=text;ts[0].set('{http://www.w3.org/XML/1998/namespace}space','preserve')
 for t in ts[1:]:t.text=''
def para(text,role='body',new=False,bold=False):
 ix={'body':11,'h1':26,'h2':15,'bullet':16}[role]
 el=deepcopy(orig[ix]);pr=el.find('w:pPr',ns)
 if pr is None:pr=E.Element(W+'pPr');el.insert(0,pr)
 for child in list(pr):
  if E.QName(child).localname in ['pageBreakBefore','sectPr']:pr.remove(child)
 if new:E.SubElement(pr,W+'pageBreakBefore').set(W+'val','1')
 if role in ['h1','h2']:E.SubElement(pr,W+'keepNext').set(W+'val','1')
 # Keep the template's typography while tightening rehearsal-page spacing.
 sp=pr.find('w:spacing',ns)
 if sp is None:sp=E.SubElement(pr,W+'spacing')
 if role in ['body','bullet']:
  sp.set(W+'after','80');sp.set(W+'line','264');sp.set(W+'lineRule','auto')
 elif role=='h2':
  sp.set(W+'before','180');sp.set(W+'after','80')
 for child in list(el):
  if child is not pr:el.remove(child)
 r=E.SubElement(el,W+'r');rp=E.SubElement(r,W+'rPr')
 if bold:E.SubElement(rp,W+'b')
 t=E.SubElement(r,W+'t');t.text=text;t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
 return el
def add(text,role='body',new=False,bold=False):body.append(para(text,role,new,bold))
def tab(vals,widths):
 t=deepcopy(orig[39]);trs=t.findall('w:tr',ns);header=deepcopy(trs[0]);row=deepcopy(trs[1])
 for tr in trs:t.remove(tr)
 grid=t.find('w:tblGrid',ns)
 for c in list(grid):grid.remove(c)
 for width in widths:E.SubElement(grid,W+'gridCol').set(W+'w',str(width))
 for i,valsrow in enumerate(vals):
  tr=deepcopy(header if i==0 else row);cells=tr.findall('w:tc',ns)
  while len(cells)>len(valsrow):tr.remove(cells.pop())
  while len(cells)<len(valsrow):tr.append(deepcopy(cells[-1]));cells=tr.findall('w:tc',ns)
  pr=tr.find('w:trPr',ns)
  if pr is None:pr=E.Element(W+'trPr');tr.insert(0,pr)
  E.SubElement(pr,W+'cantSplit')
  if i==0:E.SubElement(pr,W+'tblHeader')
  for j,(c,value) in enumerate(zip(cells,valsrow)):
   replace(c,value);tcpr=c.find('w:tcPr',ns);cw=tcpr.find('w:tcW',ns)
   if cw is None:cw=E.SubElement(tcpr,W+'tcW')
   cw.set(W+'w',str(widths[j]));cw.set(W+'type','dxa')
  t.append(tr)
 body.append(t)

# Clone the reference package and cover. Its two section definitions remain unchanged.
for el in list(body):body.remove(el)
for el in orig[:5]:body.append(deepcopy(el))
replace(body[2],'Cookie Homes')
cells=body[3].findall('.//w:tc',ns)
replace(cells[0],'Presentation practice guide\nScripts, delivery notes and examiner questions')
replace(cells[1],'Prepared for Lee Chen Xuan\n16 November 2026')

add('How to use this guide','h1')
add('Prepare a clear 20–30 minute progress presentation. The central claim is that Cookie Homes provides an implemented way to investigate whether a gamified consent interface improves understanding and preserves intended choices. User benefit and end-to-end consent enforcement remain to be established.')
add('The deck contains 20 timed slides, one question slide and five hidden backup slides. The core schedule totals 24 minutes 45 seconds, including a three-minute demonstration. The same scripts appear in the PowerPoint speaker notes. Use the scripts as a rehearsal aid, then speak from the main-point cues.')
add('Reading order','h2')
for text in ['Pacing and delivery notes explain how to shorten or extend the talk.','Slides 1–20 provide a spoken script, a caution and a transition for each slide.','The demonstration checklist gives a timed sequence and a failure fallback.','Thirty examiner questions provide direct answers, follow-up guidance and slide references.','Backup notes and references support detailed questions.'] :add(text,'bullet')
add('Three distinctions to preserve','h2')
for text in ['Implemented behaviour versus planned work. The current guest state is local; it does not yet change website consent.','Evidence from prior studies versus results from Cookie Homes. No user benefit or live-model accuracy has been established for this prototype.','Purpose evidence versus verified behaviour. A public declaration can be absent, stale or incorrect.']:add(text,'bullet')

add('Pacing plan','h1',True)
tab([['Slides','Focus','Time'],['1–4','Motivation, evidence and problem','4:15'],['5–7','Challenges, related work and gap','3:15'],['8–10','Analogy, features and AI rationale','3:45'],['11–13','Architecture, inputs and progress','3:45'],['14','Live demonstration','3:00'],['15–16','Safeguards and alternatives','2:15'],['17–18','Evaluation and success criteria','2:45'],['19–20','Feasibility and conclusion','1:45'],['Total','Core talk, excluding questions','24:45']],[1100,6700,1560])
add('For a 20 minute slot','h2')
add('If questions are outside the slot, use the same argument with shorter examples: slides 2 and 3 at 60 seconds each; slides 5, 8, 9 and 10 at 45 seconds each; slide 12 at 45 seconds; a two-minute demo; and slide 16 at 30 seconds. This gives about 20:15. If questions must fit within 20–30 minutes, target about 20 minutes of speaking and reserve the balance for discussion.')
add('For a 30 minute talk','h2')
add('Keep the 24:45 core and add a one-minute transfer-comprehension example on slide 18, a one-minute comparison of chat with fixed controls on slide 16, and a two-minute explanation of category granularity on backup slide 22. Leave the remaining time for transitions. Do not add every FAQ answer to the main talk.')
add('Practice checkpoints','h2')
add('Reach the research question by 7:30, architecture by 11:15, the demo by 15:00, evaluation by 20:15 and the conclusion by 24:00. Rehearse aloud with a timer. Adjust examples before trying to speak faster.')

add('Delivery notes','h1',True)
for head,text in [
 ('Lead with the point','State each slide’s main point in one sentence before explaining details. Use one example instead of reading every row. On architecture, trace the implemented path and explicitly point to planned write-back.'),
 ('Defend the scope','Acknowledge a valid limitation directly. Follow with what the current implementation does, what it cannot yet establish, and the next test or fallback. Avoid promising a feature solely to answer an objection.'),
 ('Use careful language','Prefer “the prototype implements”, “the study will test” and “the source declares”. Avoid “AI understands perfectly”, “we eliminate bias”, “Cookiebot is accurate”, “the game proves informed consent” and “the website is now protected”.'),
 ('Treat comparisons fairly','A clear dashboard and fixed scenario cards are credible alternatives. The project should retain the simpler approach if evidence favours it. Do not frame every alternative as inferior.'),
 ('Present evidence precisely','Name the study, sample and tested change. Say percentage points for Nouwens. A screenshot illustrates a design; it does not establish manipulation or legal non-compliance. Do not claim the report’s website screenshots are a current audit.'),
 ('Keep the interaction neutral','Describe guests as a metaphor for cookie requests. Avoid language that praises acceptance, shames refusal or implies friendly characters are safe. Watch for emotional pressure from personification.'),
 ('Answer questions concisely','Let the question finish. Give a direct answer in the first sentence. Add evidence or the relevant limit, then the next step. Aim for 30–60 seconds and allow follow-up. Use the slide references in the FAQ to navigate.')]:
 add(head,'h2');add(text)

# Two slide scripts per page. Explicit breaks make the guide easy to navigate while practising.
elapsed=0
for i,s in enumerate(data['slides'][:20]):
 start=elapsed;elapsed+=s['seconds']
 fmt=lambda sec:f'{sec//60}:{sec%60:02d}'
 add(f"Slide {s['n']}  {s['title'].replace('?','').replace(':','')}",'h2',new=i%2==0)
 add(f"Target {fmt(s['seconds'])}  |  Running time {fmt(start)}–{fmt(elapsed)}  |  Main point: {s['cue']}",bold=True)
 add(s['script'])
 add('Take note: '+s['watch'])
 add('Transition: '+s['transition']+('  Sources: '+', '.join(s['refs'])+'.' if s['refs'] else ''))

add('Demonstration checklist','h1',True)
add('Before the presentation','h2')
for text in ['Reconcile the two current local test failures against the intended behaviour and rerun the suite. The recorded result on 16 November 2026 is 11 passes and 2 failures; no code changes were made for this presentation.','Check the local server, the extension permissions and the configured model on the presentation machine. Keep secrets and personal tabs off screen. Verify model availability, quota and latency without exposing the API key.','Choose a stable, authorised site and verify the declaration collection path. Keep an explicitly labelled fixture available if live collection fails. Do not present a fixture as a fresh live scan.','Prepare one optional guest, one clear choice, one uncertain response and one reversal. Rehearse them on the exact current build. Capture genuine screenshots of successful and failed states if you want a richer offline fallback.']:add(text,'bullet')
add('Three minute sequence','h2')
tab([['Time','Action','Say or show'],['0:00–0:35','Inspect input','Identify live data or fixture; show purpose evidence.'],['0:35–1:20','Make a clear choice','Select one guest; show exact local state change.'],['1:20–2:15','Try uncertainty','Ask a question or say “maybe”; inspect clarification.'],['2:15–3:00','Review and revise','Show summary and local reversal; restate no write-back.']],[1500,2300,5560])
add('If something fails','h2')
add('Allow one brief recovery attempt, then continue. Say: “The live interpretation is unavailable in this run. This screenshot shows the interface and I can explain the intended flow. I will not present this as a successful live result.” If the model makes a wrong decision, name the error and describe its local effect. Do not quietly replace the input or claim the output was intended.')

add('Examiner questions','h1',True)
add('These are plausible challenges to the project, not predictions about a particular professor. Practise the direct answers first, then use the follow-up notes if challenged. A strong answer acknowledges a real limitation and explains how the scope, comparison or next test addresses it.')
add('Priority questions to rehearse','h2')
for idx in [1,2,4,5,7,9,10,17,18,21,22,23,24,27,29]:add(f"Q{idx}: {faqs[idx-1]['q']}",'bullet')
add('Response structure','h2');add('Answer the question directly. State what evidence or implementation supports the answer. Name the unresolved limitation. Explain the next check or fallback. If the objection changes the research claim, say so rather than defending an unsupported claim.')

for i,q in enumerate(faqs):
 add(f"Q{i+1}  {q['q']}",'h2',new=i%3==0)
 add(q['answer'])
 add('If pressed: '+q['pressed'])
 add('Relevant slides: '+q['slides']+'.',bold=True)

add('Backup slide notes','h1',True)
add('Slides 22–26 are hidden. Use See All Slides in PowerPoint Presenter View to select a backup. Rehearse navigation beforehand. Slide 21 stays visible for questions. Full scripts are in the speaker notes.')
backup_cues={
 22:'Cookiebot documents category-level submitCustomConsent for preferences, statistics and marketing. This is a candidate integration path; current guest choices remain local. If guests in the same category have conflicting choices, show the conflict and obtain an explicit category decision. Do not imply per-cookie control through a category-level API. Integration needs active-site checks, review, execution in the supported context and consent-state read-back. Reading the state back does not prove that every tracker complied. Assess site behaviour separately and offer the site’s controls when the integration cannot be verified.',
 23:'Address learning, novelty, unequal information, a weak baseline, prior knowledge and demand effects. Counterbalance order and use equivalent tasks with the same substantive information. Combine objective questions and task outcomes with self-reports. Preferences may change through learning, so an initial questionnaire is not immutable ground truth. A small convenience sample supports exploratory findings, not claims about all web users. Comparing whole interfaces does not isolate the chatbot or game elements; those claims need component comparisons or must remain open.',
 24:'Cookie values are excluded from the connector payload, but metadata and purpose descriptions remain. Messages and selected context can pass through the local server to Gemini. Explain that flow and define minimisation and retention before testing. Treat public declarations as untrusted evidence. Structural validation does not fully prevent prompt injection or semantic errors; broader adversarial tests remain necessary. Missing declarations, unavailable SDK state and unsupported sites need visible limitations. Service failures should preserve choices and show a recoverable error.'
}
for s in data['slides'][21:24]:
 add(f"Slide {s['n']}  {s['title'].replace('Backup: ','')}",'h2')
 add(backup_cues[s['n']])

add('Preparation priorities','h1',True)
for head,text in [
 ('Clarify the specification','Resolve whether unknown-purpose guests may be accepted for the current site. The README and current rules allow an explicit site-specific acceptance, while a test still expects rejection. Reconcile this intentionally, then rerun tests. Review the stale guest-label assertion separately.'),
 ('Resolve consent granularity','Decide how conflicting local guest choices map to category-level CMP controls. Prepare a concrete conflict example and a user review flow. Do not automatically merge conflicting choices into broader consent.'),
 ('Strengthen the study protocol','Agree the primary outcome, baseline, task information, recruitment, sample-size rationale and analysis before the main study. Separate task accuracy from changing personal preferences. Do not infer component effects from a whole-interface comparison.'),
 ('Complete the literature position','Add relevant gamified privacy and conversational consent work before claiming broad novelty. Keep CookieBlock as a technical comparison and consent-interface studies as evidence for the design problem.'),
 ('Prepare privacy and reliability details','Explain what goes to Gemini, what remains local and what is retained. Test ambiguous, mixed, contradictory and malicious inputs, absent declarations, permission denial and service failures. Set a review boundary before future external changes.'),
 ('Keep claims aligned across materials','The current report overstates the certainty gained from relying on declarations. Declarations can be wrong, and CookieBlock also used CMP labels for training. During the presentation, use the more qualified explanation in slides 6, 12 and 15. The report itself has not been edited in this task.')]:
 add(head,'h2');add(text)

add('References','h1',True)
for i,r in enumerate(data['sources']):
 if i==4:add('References continued','h1',True)
 add(r['id']+'  '+r['short'],'h2')
 add(r['title']+'. '+r['venue']+'.')
 add(r['url']);add(r['note'])
add('Project evidence','h2')
add('Project report Chapters 2–5, README.md, extension/popup.js, extension/manifest.json, server.js and the input and rules engines. The source review and local test run were performed on 16 November 2026. A source review is not a live-model evaluation or a complete end-to-end audit.')

body.append(deepcopy(orig[69]))
# Word requires unique paragraph IDs for newly cloned elements.
pid='{http://schemas.microsoft.com/office/word/2010/wordml}paraId'
for i,el in enumerate(d.iter()):
 if pid in el.attrib:el.set(pid,f'{i+1:08X}')
# Preserve the schema order of paragraph properties after adding page/keep controls.
prop_order='pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange'.split()
for pr in d.findall('.//w:pPr',ns):
 children=list(pr)
 for child in children:pr.remove(child)
 seen={}
 for child in children:seen[E.QName(child).localname]=child
 for name,child in sorted(seen.items(),key=lambda x:prop_order.index(x[0]) if x[0] in prop_order else 99):pr.append(child)
# Leave the original cover structure intact; edit its text nodes only.
for el in list(body)[:5]:body.remove(el)
for i,el in enumerate(orig[:5]):body.insert(i,deepcopy(el))
replace(body[2],'Cookie Homes')
cover_cells=body[3].findall('.//w:tc',ns)
replace(cover_cells[0],'Presentation practice guide')
cover_meta=cover_cells[2].findall('.//w:t',ns)
cover_meta[0].text='Prepared for Lee Chen Xuan'
cover_meta[1].text='16 November 2026'
parts['word/document.xml']=E.tostring(d,xml_declaration=True,encoding='UTF-8',standalone=True)
for name in list(parts):
 if name.startswith('word/header') and name.endswith('.xml'):
  x=E.fromstring(parts[name])
  for t in x.findall('.//w:t',ns):
   if t.text=='Report title':t.text='Cookie Homes practice guide'
   if t.text=='Date':t.text='16 November 2026'
  parts[name]=E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)
settings=E.fromstring(parts['word/settings.xml']);u=settings.find('w:updateFields',ns)
if u is None:u=E.SubElement(settings,W+'updateFields')
u.set(W+'val','true');parts['word/settings.xml']=E.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
dest=out/'Cookie_Homes_Practice_Guide.docx'
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
 for name,value in parts.items():z.writestr(name,value)
with ZipFile(ref) as z:
 changed=[n for n in z.namelist() if z.read(n)!=parts[n]]
 assert all(n in ['word/document.xml','word/settings.xml'] or n.startswith('word/header') for n in changed),changed
 assert len(d.findall('.//w:sectPr',ns))==2
(b/'artifact.md').write_text('''# Practice guide template contract
Reference: C:/Users/User/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx
Reference SHA256: ba1e11258ff52659318a321462a5e598c7bed33cf991329eb91150788fcd1a7b
Reference evidence: ../presentation-draft/template-evidence.json and package-inventory.json. All six reference-render pages inspected. Cover photo, title block, two sections, header rule and page fields retained.
Page system: US Letter, one-inch margins, two original section definitions, original header/footer distances. Body starts at page 1 after cover.
Typography: source Helvetica Neue body 11 pt, H1 24 pt, H2 15 pt, title 40 pt. All source styles, numbering, theme, relationships and images preserved byte-for-byte.
Slots: cover title and subtitle table rewritten. Main content expands into a practice guide with pacing, delivery, scripts, demo checklist, examiner questions, preparation priorities and references. The report-specific contents field is removed because it would retain stale entries. Use Word Navigation headings instead.
Components: clone source paragraph roles and native table row/cell patterns. Group two slide scripts or three FAQ answers per page, subject to render fit. Extend with cloned page-break-before heading pattern.
Editable parts: document.xml, header wording and settings updateFields. All other parts are preserve-only. Package comparison enforces this.
Rendering: canonical renderer attempted but bundled LibreOffice is unavailable on this Windows host. Use Word PDF export and rasterize for visual review. No user desktop LibreOffice substitution.
''',encoding='utf-8')
print('Created',dest)
print('Changed template parts:',changed)
