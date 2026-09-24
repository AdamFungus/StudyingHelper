"""Build Microeconomics from the retrieved chat and its attached course PDFs."""
import json,re,pathlib
import pypdfium2 as pdfium
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'scripts/micro-source.json').read_text(encoding='utf-8'))
messages=[i['text'] for t in data['turns'] for i in t['items'] if i['type']=='agentMessage']
quiz_text,notes=messages[:2]
clean=lambda s:re.sub(r':chatgpt-content-reference\{[^}]*\}','',s).strip()
notes=clean(notes)
# Generated sandbox image links are not accessible; use the actual course figures.
notes=re.sub(r'!\[[^\]]*\]\(sandbox:[^\n]*(?:\n|$)','',notes)
parts=re.split(r'^# Chapter (\d+) — (.+)$',notes,flags=re.M)
chapters=[]
for i in range(1,len(parts),3):
    n=int(parts[i]); sections=re.split(r'^#{1,3} (.+)$',parts[i+2],flags=re.M); topics=[]; parent=''
    for j in range(1,len(sections),2):
        title=sections[j]; body=sections[j+1].strip().strip('-').strip()
        if not body: parent=title; continue
        if title in ['Result','Determinants','When Price Falls','When Price Rises','Who Gains?','Who Loses?','Alternatives']: title=f'{parent} — {title}'
        topics.append({'id':f'micro-c{n}-t{len(topics)+1}','title':title,'body':body,'format':'markdown','source':'Create Chapter Notes and Graphs · Revised chapter notes'})
        if title not in ['Result']: parent=title.split(' — ')[0]
    chapters.append({'id':n,'title':parts[i+1],'topics':topics,'deck':f'sources/microeconomics/chapter-{n}.pdf'})

supplements=[
 ('Economic Surplus and Market Efficiency','**Economic surplus** is the total value consumers place on the units exchanged minus their total production cost. On a demand–supply graph, it is the area below demand and above supply up to the quantity traded.\n\nIn the competitive market model used in these slides, total surplus is maximized at the free-market equilibrium quantity.',22),
 ('Price Controls and Deadweight Loss','Binding price floors and ceilings reduce the quantity traded below the competitive equilibrium. Some mutually beneficial trades no longer occur.\n\n**Deadweight loss** is the resulting loss of total economic surplus to society. The slides show it as the area between demand and supply over the units that are no longer exchanged.',23),
 ('Output Quotas','An **output quota** limits how much firms may produce. A binding quota below the competitive equilibrium quantity reduces output and raises the market price.\n\nThe lost gains from the units no longer traded create deadweight loss.',25),
 ('Efficiency and Policy Judgements','Governments may accept a loss of economic surplus to help a particular group.\n\n**Positive analysis** examines a policy’s actual effects. **Normative judgements** concern whether those effects are desirable. Economic surplus is one consideration in a policy decision; it does not settle distributional or social goals.',26)
]
for title,body,page in supplements:
    topics=chapters[4]['topics']; topics.append({'id':f'micro-c5-t{len(topics)+1}','title':title,'body':body,'format':'markdown','source':f'Added from Chapter 5 course slides, page {page} · Conversation preview ends before this section','sourcePage':page})

figures={
1:{'Budget Line':[8],'Reading the PPB':[10],'Economic Growth':[14]},
2:{'Positive Correlation':[20],'Negative Correlation':[20],'Cross-Sectional Data':[16],'Time-Series Data':[17],'Functions':[19],'Slope':[21],'Diminishing Marginal Response':[22],'Increasing Marginal Cost':[23]},
3:{'Law of Demand':[5],'Increase in Demand':[7],'Change in Demand vs. Quantity Demanded':[9],'Law of Supply':[12],'Increase in Supply':[14],'3.3 Market Equilibrium':[18],'Changes in Equilibrium':[20]},
4:{'Elasticity Along a Linear Demand Curve':[8],'Perfectly Inelastic Demand':[9],'Perfectly Elastic Demand':[9],'4.3 Excise Taxes':[24],'Tax Incidence':[26]},
5:{'Price Floor':[5],'Price Ceiling':[9],'Short Run vs. Long Run':[12],'Demand as Value':[19],'Supply as Cost':[21],'Economic Surplus and Market Efficiency':[22],'Price Controls and Deadweight Loss':[23,24],'Output Quotas':[25]}}
for chapter in chapters:
    n=chapter['id']; document=pdfium.PdfDocument(str(root/f'website/sources/microeconomics/chapter-{n}.pdf'))
    for topic in chapter['topics']:
        topic['figures']=[]
        for page in figures[n].get(topic['title'],[]):
            relative=f'sources/microeconomics/figures/ch{n}-page{page}.png'
            target=root/'website'/relative;target.parent.mkdir(parents=True,exist_ok=True)
            if not target.exists():
                rendered=document[page-1].render(scale=1.7).to_pil(); rendered.save(target)
            topic['figures'].append({'src':relative,'alt':f'{topic["title"]}: course diagram from Chapter {n}, page {page}','caption':f'Original course slide · Chapter {n}, page {page}'})

def plain_math(s):
    return s.replace('\\(','').replace('\\)','').replace('\\Delta','Δ').replace('\\times','×')
quizzes=[]
sections=re.split(r'^# Chapter (\d+) — (.+)$',quiz_text,flags=re.M)
chapter4_answers='B A B B C A B A B B A A A A B A B C A A B B A B B A B B B B'.split()
for i in range(1,len(sections),3):
    n=int(sections[i]); body=sections[i+2]; questions=[]
    question_body=body.split(f'### Chapter {n} Answer Key')[0]
    answer_text=body.split(f'### Chapter {n} Answer Key')[1]
    answers={int(num):letter for num,letter in re.findall(r'(\d+)\. \*\*([ABCD])\*\*',answer_text)}
    entries=re.split(r'^### (\d+)\.\s*$',question_body,flags=re.M)
    for j in range(1,len(entries),2):
        num=int(entries[j]); lines=entries[j+1].strip(); first=re.search(r'^A\. ',lines,re.M)
        prompt=plain_math(lines[:first.start()].strip()); opts=re.findall(r'^[ABCD]\. (.+)$',lines,re.M)
        assert len(opts)==4,(n,num,opts)
        answer=answers.get(num) or chapter4_answers[num-1]
        questions.append({'prompt':prompt,'options':[plain_math(x.strip()) for x in opts],'answer':'ABCD'.index(answer)})
    quizzes.append({'id':n,'questions':questions,'source':'Questions from Create Chapter Notes and Graphs.' + (' The remaining answer key was checked against the chapter notes because the preview cuts off after answer 13.' if n==4 else '')})

extra=json.loads((root/'scripts/micro-ch5-quiz.json').read_text(encoding='utf-8'))
quizzes.append({'id':5,'questions':extra,'source':'Supplemental questions created from the attached Chapter 5 slides. The original Chapter 5 quiz is outside the available conversation preview.'})
assert len(chapters)==5 and len(quizzes)==5
for q in quizzes: assert len(q['questions'])>=25
(root/'website/microeconomics-data.js').write_text('window.MICRO_CHAPTERS = '+json.dumps(chapters,ensure_ascii=False)+';\nwindow.MICRO_QUIZZES = '+json.dumps(quizzes,ensure_ascii=False)+';\n',encoding='utf-8')
print(json.dumps({'chapters':[(c['id'],len(c['topics'])) for c in chapters],'questions':[len(q['questions']) for q in quizzes],'topics':sum(len(c['topics']) for c in chapters)}))
