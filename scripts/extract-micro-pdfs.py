import json,pathlib,shutil
from pypdf import PdfReader
root=pathlib.Path(__file__).resolve().parents[1]
source=json.loads((root/'scripts/micro-source.json').read_text(encoding='utf-8'))
pages={}
for index,a in enumerate(source['attachments'],1):
    reader=PdfReader(a['path'])
    pages[str(index)]=[p.extract_text() for p in reader.pages]
    target=root/f'website/sources/microeconomics/chapter-{index}.pdf'
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(a['path'],target)
(root/'scripts/micro-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf-8')
for chapter,content in pages.items():
    print(f'CHAPTER {chapter}')
    for i,p in enumerate(content,1):
        print(i, ' | '.join(p.splitlines()[:4]))
