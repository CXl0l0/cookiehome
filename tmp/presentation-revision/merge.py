from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import Path, PurePosixPath
from lxml import etree as E
import json, re
build=Path(r'C:\Users\User\Desktop\cookiehome\tmp\presentation-revision')
with ZipFile(build/'original.pptx') as z: orig={n:z.read(n) for n in z.namelist()}
with ZipFile(build/'edited-section.pptx') as z: gen={n:z.read(n) for n in z.namelist()}
parts=dict(orig)
P='http://schemas.openxmlformats.org/presentationml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
A='http://schemas.openxmlformats.org/drawingml/2006/main'
ns={'p':P,'r':R,'a':A}
def xml(b):return E.fromstring(b)
def serial(el):return E.tostring(el,xml_declaration=True,encoding='UTF-8',standalone=True)
layout=next(e.get('Target') for e in xml(orig['ppt/slides/_rels/slide4.xml.rels']) if e.get('Type').endswith('/slideLayout'))
noteMaster=next(e.get('Target') for e in xml(orig['ppt/notesSlides/_rels/notesSlide4.xml.rels']) if e.get('Type').endswith('/notesMaster'))
for generated,num,order in [(1,4,4),(2,10,5),(3,11,6)]:
 source=f'ppt/slides/slide{generated}.xml'; target=f'ppt/slides/slide{num}.xml'
 parts[target]=gen[source]
 rel=xml(gen[f'ppt/slides/_rels/slide{generated}.xml.rels'])
 for e in rel:
  if e.get('Type').endswith('/slideLayout'):e.set('Target',layout)
  elif e.get('Type').endswith('/notesSlide'):e.set('Target',f'../notesSlides/notesSlide{num}.xml')
  else:raise ValueError('Unexpected slide relationship '+str(e.attrib))
 parts[f'ppt/slides/_rels/slide{num}.xml.rels']=serial(rel)
 note=xml(gen[f'ppt/notesSlides/notesSlide{generated}.xml'])
 for field in note.findall('.//a:fld',ns):
  if field.get('type')=='slidenum':
   for t in field.findall('.//a:t',ns):t.text=str(order)
 parts[f'ppt/notesSlides/notesSlide{num}.xml']=serial(note)
 rel=xml(gen[f'ppt/notesSlides/_rels/notesSlide{generated}.xml.rels'])
 for e in rel:
  if e.get('Type').endswith('/notesMaster'):e.set('Target',noteMaster)
  elif e.get('Type').endswith('/slide'):e.set('Target',f'../slides/slide{num}.xml')
  else:raise ValueError('Unexpected notes relationship '+str(e.attrib))
 parts[f'ppt/notesSlides/_rels/notesSlide{num}.xml.rels']=serial(rel)
# Maintain the original package and slide IDs; insert only two new IDs.
pres=xml(orig['ppt/presentation.xml']); ids=pres.find('p:sldIdLst',ns)
assert len(ids)==9
rel=xml(orig['ppt/_rels/presentation.xml.rels'])
nextRel=max(int(e.get('Id')[3:]) for e in rel if re.fullmatch(r'rId\d+',e.get('Id','')))+1
nextId=max(int(e.get('id')) for e in ids)+1
for offset,num in enumerate([10,11]):
 rid=f'rId{nextRel+offset}'
 e=E.Element('{'+P+'}sldId',id=str(nextId+offset));e.set('{'+R+'}id',rid);ids.insert(4+offset,e)
 E.SubElement(rel,'{'+REL+'}Relationship',Id=rid,Type=R+'/slide',Target=f'slides/slide{num}.xml')
parts['ppt/presentation.xml']=serial(pres);parts['ppt/_rels/presentation.xml.rels']=serial(rel)
ct=xml(orig['[Content_Types].xml'])
for num in [10,11]:
 E.SubElement(ct,'{'+CT+'}Override',PartName=f'/ppt/slides/slide{num}.xml',ContentType='application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
 E.SubElement(ct,'{'+CT+'}Override',PartName=f'/ppt/notesSlides/notesSlide{num}.xml',ContentType='application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml')
parts['[Content_Types].xml']=serial(ct)
for num in range(5,10):
 path=f'ppt/slides/slide{num}.xml'; old=f'<a:t>{num:02}</a:t>'.encode();new=f'<a:t>{num+2:02}</a:t>'.encode()
 assert orig[path].count(old)==1,(path,orig[path].count(old))
 parts[path]=orig[path].replace(old,new,1)
if 'docProps/app.xml' in orig:
 app=xml(orig['docProps/app.xml']);slides=app.find('{http://schemas.openxmlformats.org/officeDocument/2006/extended-properties}Slides')
 if slides is not None:slides.text='11'
 parts['docProps/app.xml']=serial(app)
with ZipFile(build/'candidate.pptx','w',ZIP_DEFLATED) as z:
 for n,b in parts.items():z.writestr(n,b)
# Confirm all unrelated content, including user edits, is byte-for-byte intact.
edited={'ppt/presentation.xml','ppt/_rels/presentation.xml.rels','[Content_Types].xml','docProps/app.xml','ppt/slides/slide4.xml','ppt/slides/_rels/slide4.xml.rels','ppt/notesSlides/notesSlide4.xml','ppt/notesSlides/_rels/notesSlide4.xml.rels'}|{f'ppt/slides/slide{i}.xml' for i in range(5,10)}
assert all(parts[n]==b for n,b in orig.items() if n not in edited)
for i in range(5,10):assert parts[f'ppt/slides/slide{i}.xml'].replace(f'<a:t>{i+2:02}</a:t>'.encode(),f'<a:t>{i:02}</a:t>'.encode(),1)==orig[f'ppt/slides/slide{i}.xml']
print('11 slides; original user edits preserved exactly outside slide 4 and footer numbering.')
