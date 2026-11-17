from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
from copy import deepcopy
b=Path('tmp/presentation-expanded');ref=Path('C:/Users/User/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx')
with ZipFile(ref) as z:orig={n:z.read(n) for n in z.namelist()}
with ZipFile('output/presentation-expanded/Cookie_Homes_Practice_Guide.docx') as z:gen={n:z.read(n) for n in z.namelist()}
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
tests={'repack':orig,'doconly':{**orig,'word/document.xml':gen['word/document.xml']},'headeronly':{**orig,'word/header1.xml':gen['word/header1.xml']},'settingsonly':{**orig,'word/settings.xml':gen['word/settings.xml']}}
o=E.fromstring(orig['word/document.xml']);ob=o.find('w:body',ns)
tests['roundtrip']={**orig,'word/document.xml':E.tostring(o,xml_declaration=True,encoding='UTF-8',standalone=True)}
for key in ['origcover','resetcover','nocover']:
 x=E.fromstring(gen['word/document.xml']);body=x.find('w:body',ns)
 for i,e in enumerate(list(body)):
  if i<5 or (key=='origcover' and not e.tag.endswith('sectPr')):body.remove(e)
 if key!='nocover':
  for i,e in enumerate(list(ob)[:5]):body.insert(i,deepcopy(e))
 tests[key]={**orig,'word/document.xml':E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)}
for key in ['notables','coveronly']:
 x=E.fromstring(gen['word/document.xml']);body=x.find('w:body',ns)
 for i,e in enumerate(list(body)):
  if (key=='notables' and e.tag.endswith('tbl') and i>4) or (key=='coveronly' and i>4 and not e.tag.endswith('sectPr')):body.remove(e)
 tests[key]={**orig,'word/document.xml':E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)}
for name,parts in tests.items():
 with ZipFile(b/(name+'.docx'),'w',ZIP_DEFLATED) as z:
  for n,v in parts.items():z.writestr(n,v)
for key in ['titleedit','metaedit','guidetmp']:
 parts=deepcopy(tests['resetcover']) if key!='guidetmp' else deepcopy(gen)
 if key!='guidetmp':
  x=E.fromstring(parts['word/document.xml']);body=x.find('w:body',ns)
  if key=='titleedit':body[2].find('.//w:t',ns).text='Cookie Homes'
  if key=='metaedit':
   cells=body[3].findall('.//w:tc',ns)
   cells[0].find('.//w:t',ns).text='Presentation practice guide'
  parts['word/document.xml']=E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)
 with ZipFile(b/(key+'.docx'),'w',ZIP_DEFLATED) as z:
  for n,v in parts.items():z.writestr(n,v)
