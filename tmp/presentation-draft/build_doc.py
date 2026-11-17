from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from copy import deepcopy
import hashlib, json
root=Path(r'C:\Users\User\Desktop\cookiehome')
build=root/'tmp/presentation-draft'
out=root/'output/presentation-draft'
ref=Path(r'C:\Users\User\.codex\plugins\cache\openai-curated-remote\openai-templates\0.1.1\skills\artifact-template-design-report\assets\reference.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
W='{'+ns['w']+'}'
with ZipFile(ref) as z: parts={n:z.read(n) for n in z.namelist()}
d=E.fromstring(parts['word/document.xml']); body=d.find('w:body',ns); orig=list(body)
inventory={n:{'size':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in parts.items()}
(build/'package-inventory.json').write_text(json.dumps(inventory,indent=2))
styles=E.fromstring(parts['word/styles.xml'])
evidence={'sections':[E.tostring(n).decode() for n in d.findall('.//w:sectPr',ns)],'styles':parts['word/styles.xml'].decode(),'paragraphs':[]}
for i,el in enumerate(orig):
 evidence['paragraphs'].append({'index':i,'type':E.QName(el).localname,'text':''.join(el.xpath('.//w:t/text()',namespaces=ns)),'properties':E.tostring(el.find('w:pPr',ns)).decode() if el.find('w:pPr',ns) is not None else ''})
(build/'template-evidence.json').write_text(json.dumps(evidence,indent=2))
(build/'artifact.md').write_text(f'''# Design Report template contract
Reference: {ref}
SHA256: {hashlib.sha256(ref.read_bytes()).hexdigest()}
Reference render: reference-render/page-1.png through page-6.png. Six physical pages; cover unnumbered, five numbered pages. Exact properties recorded in template-evidence.json; all package parts recorded in package-inventory.json.
Page system: retain all original section properties (two sections), US Letter 12240 by 15840 twips, portrait, 1440 twip margins, 720 twip header/footer offsets, numbered body starting at 1. Retain cover photo, footer fields and recurring header rule.
Typography: retain Helvetica Neue source styles (body 11 pt; H1 24 pt regular; H2 15 pt regular; Title 40 pt bold; subtitle 14 pt grey); preserve direct properties, lists, spacing, cell borders and shading. Title sanitizer is required for Google Docs; any title border removal is an intentional compatibility deviation.
Flow: cover, contents, executive summary with at-a-glance and introduction, key findings with literature/gap/implications, recommendations with conclusion, appendix. The appendix expands onto a sources page using the original page-break paragraph pattern to fit the requested architecture.
Slots: document.xml body child indexes 2 title; 3 subtitle/author/date table; 10–23 summary/motivation; 26–39 literature/gap/risk matrix; 42–51 implementation/evaluation/conclusion; 54–68 appendix architecture and sources. Replace the text in these slots, retain original formatting. Keep original cover image. Add the requested architecture after child 59 using an inline drawing, at 6.5 by 3.65625 inches. Source heading gets pageBreakBefore. Existing TOC text nodes and cached page numbers may be updated; preserve its content-control and hyperlinks.
Editable parts: document.xml, header text, settings.xml updateFields, document relationships and content types for the new image. Add architecture.png only. Preserve every other original package part byte for byte, especially styles, numbering, theme, original images, opaque customXml, footers, comments and relationships unrelated to the image.
Fidelity gate: retained reference hash unchanged; page/section properties unchanged; original preserve-only package bytes unchanged; all seven rendered pages reviewed; no placeholders; TOC matches final pages. Word export is used for rendering because the packaged LibreOffice renderer is unavailable on this Windows host.
''')
def replace(el,value):
 ts=el.findall('.//w:t',ns)
 if not ts:
  r=E.SubElement(el,W+'r');ts=[E.SubElement(r,W+'t')]
 if isinstance(value,tuple):
  ts[0].text=value[0]
  if len(ts)<2:
   r=E.SubElement(el,W+'r');ts.append(E.SubElement(r,W+'t'))
  ts[1].text=value[1]
  for t in ts[2:]:t.text=''
 else:
  ts[0].text=value
  for t in ts[1:]:t.text=''
 for t in ts:t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
texts={
2:'Cookie Homes',
11:'Cookie Homes explores whether a gamified interface can help users understand cookie purposes and express their privacy preferences. Websites become homes and cookies become guests with requests. Users can inspect technical evidence, discuss a scenario with a chatbot and review the resulting choice.',
12:'The current prototype combines a browser extension connector with a local website interface. It demonstrates data collection, scenario generation and local decision updates. Its benefit to users remains a research question; website consent write-back and a comparative user study are planned.',
16:'Motivation: improve the quality of cookie choices during everyday browsing.',
17:'Current scope: Cookiebot sites; browser metadata, consent signals and public declarations.',
18:'Main question: does the gamified journey improve understanding and engagement while preserving users’ intended choices?',
21:'Motivation and problem',
22:'The report’s F1 and FIFA examples show users encountering consent controls before continuing with a website. The controls differ in detail and granularity. These examples connect the project to everyday browsing, but do not establish how all users behave or which interface is best.',
23:'The problem is to make cookie requests understandable without distorting their meaning or steering users towards acceptance or rejection. This is challenging because purposes can be uncertain, preferences can depend on context, and conversational answers can be ambiguous.',
27:'Existing research supports examining consent interface design and cookie classification. Cookie Homes asks how a gamified experience affects users’ understanding and choices.',
28:'Literature and background',
29:'Nouwens et al. [1] showed that interface design changes consent choices in a study with 40 participants. CookieBlock [2] classifies cookies with machine learning and enforces preferences.',
30:'Key challenge',
31:'These works do not evaluate the conversational home and guest experience proposed here. This project studies its effects on understanding and preference elicitation; it does not claim that no related gamified systems exist.',
33:('Research question. ','Can a gamified scenario interface improve cookie understanding and engagement while accurately capturing users’ intended choices?'),
38:'Public declarations may be incomplete or inaccurate. The analogy must preserve the available evidence and make uncertainty visible.',
43:'Complete the supported Cookiebot journey, then evaluate user benefit. The following work connects the implementation to measurable research outcomes.',
44:('Complete the prototype. ','Move the interaction into the extension, investigate supported consent write-back, and add review and recovery controls. Preserve uncertain purpose labels and clarify ambiguous answers before changing state.'),
45:('Run a comparative study. ','Pilot matched tasks, then compare Cookie Homes with a category dashboard. Counterbalance order. Measure comprehension, completion rate, time, interpretation errors, decision confidence, engagement and perceived difficulty. Compare choices with stated intent and discuss mismatches with participants.'),
46:('Interpret the evidence. ','Use interviews to identify helpful or confusing elements. If feasible, compare a simplified variant with the same choice logic to separate the analogy’s effect from the chatbot’s. Otherwise report results for the whole interface. Agree sample size and analysis before recruitment.'),
50:'The prototype demonstrates the feasibility of a scenario based interaction. The expected outputs are a usable extension prototype, evidence about understanding and engagement, and recommendations for presenting cookie choices.',
51:'Improvement is a hypothesis to test. Mixed or negative results will still inform the design. A small exploratory study cannot establish broad effectiveness, and the current prototype does not yet apply choices to a website’s CMP.',
57:'Architecture and progress',
58:'The connector reads cookie metadata, the Cookiebot consent snapshot and a public declaration. The adapter normalises inputs and matches purposes. Cookie Homes turns the resulting records into scenarios, with the underlying evidence available for inspection.',
59:'Chat messages pass through the local server to Gemini for interpretation. The rules engine validates structured decisions and updates local state. Essential guests are protected. Unclear messages should trigger clarification; consent write-back is shown as planned.',
62:'Sources',
63:'[1] Nouwens, M., Liccardi, I., Veale, M., Karger, D. and Kagal, L. (2020). Dark Patterns after the GDPR: Scraping Consent Pop-ups and Demonstrating their Influence. CHI. https://doi.org/10.1145/3313831.3376321',
64:'[2] Bollinger, D., Kubicek, K., Cotrini, C. and Basin, D. (2022). Automating Cookie Consent and GDPR Violation Detection. USENIX Security, 2893–2910. https://www.usenix.org/conference/usenixsecurity22/presentation/bollinger',
65:'[3] Lee Chen Xuan. Designing a Gamified Application for User Privacy Preference Extraction. Continual Assessment Report, November 2026. Project source: report/report.tex.',
66:'[4] Cookie Homes implementation. extension/popup.js; src/engine/cookiebot-adapter.js; src/engine/input-adapter.js; src/engine/rules.js; src/ui/app.js; server.js. Reviewed for this architecture draft.',
68:('Evaluation note. ','A questionnaire records stated preferences, not an objective privacy truth. Learning may legitimately change a choice. Assess understanding and intended decisions together; acceptance rate alone is not a success measure.')}
for i,v in texts.items():replace(orig[i],v)
cover=orig[3].findall('.//w:p',ns)
for el,val in zip([p for p in cover if p.findall('.//w:t',ns)],['Gamified cookie consent design report','Prepared by Lee Chen Xuan','November 2026']):replace(el,val)
values=['Challenge','Risk','Design response','Purpose evidence','Incomplete declarations','Show uncertainty and metadata','Conversation','Ambiguous user intent','Clarify before changing a choice','Consent','CMP support varies','Begin with Cookiebot']
for cell,val in zip(orig[39].findall('.//w:tc',ns),values):replace(cell,val)
# Preserve the TOC control, hyperlinks and fields; edit its existing text nodes only.
renames={'Introduction':'Motivation and problem','Context and conditions':'Literature and background','Patterns in the evidence':'Key challenge','Notes':'Architecture and progress','Source placeholders':'Sources'}
for t in orig[7].findall('.//w:t',ns):
 if t.text in renames:t.text=renames[t.text]
for pp in orig[7].findall('.//w:p',ns):
 ts=pp.findall('.//w:t',ns)
 if any(t.text=='Sources' for t in ts):
  for t in ts:
   if t.text=='5':t.text='6'
# Add an architecture drawing without rebuilding other package parts.
pimg=E.Element(W+'p');pr=E.SubElement(pimg,W+'pPr');E.SubElement(pr,W+'spacing').set(W+'after','120')
drawing=E.fromstring('''<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5943600" cy="3343275"/><wp:docPr id="902" name="Cookie Homes architecture" descr="Current prototype architecture with planned consent write-back marked by a dashed border"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="902" name="Architecture"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCookieHomesArchitecture"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5943600" cy="3343275"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>''')
pimg.append(drawing);orig[59].addnext(pimg)
pp=orig[62].find('w:pPr',ns);pb=E.SubElement(pp,W+'pageBreakBefore');pb.set(W+'val','1')
rels=E.fromstring(parts['word/_rels/document.xml.rels']);rel=E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship');rel.attrib.update({'Id':'rIdCookieHomesArchitecture','Type':'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image','Target':'media/cookiehomes-architecture.png'})
ct=E.fromstring(parts['[Content_Types].xml']);ctns='{http://schemas.openxmlformats.org/package/2006/content-types}'
if not any(el.get('Extension')=='png' for el in ct):E.SubElement(ct,ctns+'Default',Extension='png',ContentType='image/png')
changes={'word/document.xml':E.tostring(d,xml_declaration=True,encoding='UTF-8',standalone=True),'word/_rels/document.xml.rels':E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True),'[Content_Types].xml':E.tostring(ct,xml_declaration=True,encoding='UTF-8',standalone=True),'word/media/cookiehomes-architecture.png':(build/'slides/slide-5.png').read_bytes()}
for n,data in parts.items():
 if n.startswith('word/header') and n.endswith('.xml'):
  tree=E.fromstring(data)
  for t in tree.findall('.//w:t',ns):
   if t.text=='Report title':t.text='Cookie Homes'
   elif t.text=='Date':t.text='November 2026'
  changes[n]=E.tostring(tree,xml_declaration=True,encoding='UTF-8',standalone=True)
settings=E.fromstring(parts['word/settings.xml']);u=settings.find('w:updateFields',ns)
if u is None:u=E.SubElement(settings,W+'updateFields')
u.set(W+'val','true');changes['word/settings.xml']=E.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
out.mkdir(exist_ok=True,parents=True)
dest=build/'Cookie_Homes_Design_Report_unsanitized.docx'
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
 for n,b in parts.items():z.writestr(n,changes.get(n,b))
 for n,b in changes.items():
  if n not in parts:z.writestr(n,b)
with ZipFile(dest) as z:
 for n,b in parts.items():
  if n not in changes:assert z.read(n)==b,n
assert hashlib.sha256(ref.read_bytes()).hexdigest()==hashlib.sha256(ref.read_bytes()).hexdigest()
print(dest)
print('Preserve-only original parts remain byte-identical. Edited:',', '.join(changes))
