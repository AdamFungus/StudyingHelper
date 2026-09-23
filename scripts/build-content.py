import json,re,pathlib,shutil,zipfile,posixpath,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'website'; out.mkdir(exist_ok=True)
chapters=json.loads((root/'scripts/chapters-extracted.json').read_text(encoding='utf-8'))
slides=json.loads((root/'scripts/slides-extracted.json').read_text(encoding='utf-8'))
inputs=json.loads((root/'scripts/source-input.json').read_text(encoding='utf-8'))
for key,deck in slides.items():
    num=int(key); topics=[]
    src=next(a['path'] for a in inputs['attachments'] if re.search(fr'Ch{num:02d}',a['name']))
    ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    archive=zipfile.ZipFile(src)
    for index,lines in enumerate(deck[1:],2):
        if not lines: continue
        title=re.sub(r'\s+(?:Part \d+|Continued|– Part \d+| - \d+)$','',lines[0]).replace('\uf0e0','–')
        if title.startswith(('Learning Objectives','End of Chapter Summary')): continue
        if num==5 and title.startswith('Bundling of'): title='Revenue Recognition for Bundled Goods & Services'; lines=['',*lines]
        xml=ET.fromstring(archive.read(f'ppt/slides/slide{index}.xml'))
        tables=[]
        for table in xml.findall('.//a:tbl',ns):
            tables.append([[' '.join(t.text or '' for t in cell.findall('.//a:t',ns)) for cell in row.findall('a:tc',ns)] for row in table.findall('a:tr',ns)])
        content='\n\n'.join(lines[1:]).replace('\uf0e0','→')
        if tables:
            # Table text is rendered as rows, not as disconnected paragraphs.
            paragraphs=[]
            for shape in xml.findall('.//p:sp',ns):
                for paragraph in shape.findall('.//a:p',ns):
                    value=''.join(t.text or '' for t in paragraph.findall('.//a:t',ns)).strip()
                    if value and value!=lines[0] and not re.match(r'^©|^Copyright|^\d+\s*[-–]\s*\d+$',value): paragraphs.append(value)
            content='\n\n'.join(paragraphs)
        images=[]
        relpath=f'ppt/slides/_rels/slide{index}.xml.rels'
        if relpath in archive.namelist():
            rels={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(archive.read(relpath))}
            for picture in xml.findall('.//p:pic',ns):
                blip=picture.find('.//a:blip',ns)
                if blip is None: continue
                target=rels.get(blip.attrib.get('{'+ns['r']+'}embed'))
                if not target: continue
                asset=posixpath.normpath(posixpath.join('ppt/slides',target))
                if pathlib.PurePosixPath(asset).suffix.lower() not in ['.png','.jpg','.jpeg','.gif','.svg']: continue
                name=f'sources/images/ch{num}-{pathlib.PurePosixPath(asset).name}'
                (out/'sources/images').mkdir(parents=True,exist_ok=True)
                (out/name).write_bytes(archive.read(asset))
                images.append({'src':name,'alt':f'{title} — original slide {index}'})
        block={'body':content,'tables':tables,'images':images,'slide':index}
        if topics and topics[-1]['title']==title:
            topics[-1]['body']+='\n\n'+content
            topics[-1]['slides'].append(index)
            topics[-1]['blocks'].append(block)
        else:
            topics.append({'id':f'c{num}-t{len(topics)+1}','title':title,'body':content,'blocks':[block],'format':'plain','slides':[index],'source':f'Libby · Financial Accounting, Eighth Canadian Edition · Chapter {num} slides'})
    title=' '.join(deck[0][:-1])
    chapters.append({'id':num,'title':title,'topics':topics,'deck':f'sources/chapter-{num}.pptx'})
    archive.close()
    (out/'sources').mkdir(exist_ok=True)
    shutil.copyfile(src,out/f'sources/chapter-{num}.pptx')
guide=inputs['guide']; core=guide.split('## Core accounting language used throughout the course')[1].split('# Chapter 1')[0]
core=re.sub(r':chatgpt-content-reference\{[^}]*\}','',core).strip().strip('-').strip()
chapters[0]['topics'].insert(0,{'id':'c1-core','title':'Core equations & debit and credit rules','body':core,'format':'markdown','source':'Create Study Guide Notes · Chapters 1–12 master notes'})
(out/'content.js').write_text('window.STUDY_CHAPTERS = '+json.dumps(chapters,ensure_ascii=False)+';\n',encoding='utf-8')
print(f'Built {len(chapters)} chapters and {sum(len(c["topics"]) for c in chapters)} topics.')
