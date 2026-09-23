import json, zipfile, re, pathlib, xml.etree.ElementTree as ET
root = pathlib.Path(__file__).resolve().parents[1]
data = json.loads((root/'scripts/source-input.json').read_text(encoding='utf-8'))
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
chapters=[]
guide=re.sub(r':chatgpt-content-reference\{[^}]*\}', '', data['guide'])
parts=re.split(r'^# Chapter (\d+) — (.+)$',guide,flags=re.M)
for i in range(1,len(parts),3):
    num=int(parts[i])
    if num>3: break
    body=parts[i+2]
    sections=re.split(r'^#{1,2} (\d+\. .+)$',body,flags=re.M)
    topics=[]
    for j in range(1,len(sections),2):
        title=re.sub(r'^\d+\. ','',sections[j])
        topics.append({'id':f'c{num}-t{len(topics)+1}','title':title,'body':sections[j+1].strip().strip('-').strip(),'format':'markdown','source':'Create Study Guide Notes · Chapters 1–12 master notes'})
    chapters.append({'id':num,'title':parts[i+1],'topics':topics})
slides_out={}
for attachment in data['attachments']:
    match=re.search(r'Ch(\d+)', attachment['name'])
    if not match or int(match[1])<4: continue
    num=int(match[1]); slides=[]
    with zipfile.ZipFile(attachment['path']) as z:
        names=sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)],key=lambda n:int(re.search(r'slide(\d+)\.xml',n)[1]))
        for name in names:
            xml=ET.fromstring(z.read(name)); lines=[]
            for p in xml.findall('.//a:p',ns):
                line=''.join(t.text or '' for t in p.findall('.//a:t',ns)).strip()
                if line and not re.match(r'^©|^Copyright|^\d+\s*[-–]\s*\d+$',line): lines.append(line)
            slides.append(lines)
    slides_out[num]=slides
(root/'scripts/slides-extracted.json').write_text(json.dumps(slides_out,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'scripts/chapters-extracted.json').write_text(json.dumps(chapters,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({n:{'slides':len(s),'first':s[:3]} for n,s in slides_out.items()},ensure_ascii=False))
