from pathlib import Path
from docx import Document
import hashlib, zipfile, json
p=Path('C:/Users/User/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx')
d=Document(p)
data={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sections':[{'w':s.page_width/914400,'h':s.page_height/914400,'top':s.top_margin/914400,'bottom':s.bottom_margin/914400,'left':s.left_margin/914400,'right':s.right_margin/914400} for s in d.sections], 'paragraphs':[{'text':q.text,'style':q.style.name} for q in d.paragraphs], 'styles':[]}
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','List Bullet']:
 if name not in d.styles: continue
 s=d.styles[name];f=s.font;p=s.paragraph_format
 data['styles'].append({'name':name,'font':f.name,'size':f.size.pt if f.size else None,'bold':f.bold,'before':p.space_before.pt if p.space_before else None,'after':p.space_after.pt if p.space_after else None,'line':p.line_spacing})
print(json.dumps(data,indent=2,default=str))
Path('tmp/presentation-expanded/doc-template-evidence.json').write_text(json.dumps(data,indent=2,default=str))
