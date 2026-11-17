from pathlib import Path
import zipfile, xml.etree.ElementTree as ET, json, shutil
ROOT=Path('C:/Users/User/Desktop/cookiehome')
BUILD=ROOT/'tmp/presentation-expanded'
src=ROOT/'output/presentation-draft/Cookie_Homes_Presentation_Updated.pptx'
shutil.copy2(src,BUILD/'source.pptx')
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
with zipfile.ZipFile(src) as z:
    p=ET.fromstring(z.read('ppt/presentation.xml'))
    rels={e.attrib['Id']:e.attrib['Target'] for e in ET.fromstring(z.read('ppt/_rels/presentation.xml.rels'))}
    slides=[]
    for i,e in enumerate(p.find('p:sldIdLst',ns),1):
        name='ppt/'+rels[e.attrib['{'+ns['r']+'}id']]
        x=ET.fromstring(z.read(name))
        texts=[e.text for e in x.findall('.//a:t',ns)]
        slides.append({'slide':i,'part':name,'texts':texts})
    (BUILD/'source-text.json').write_text(json.dumps(slides,indent=2),encoding='utf-8')
    print(json.dumps(slides,indent=2))
