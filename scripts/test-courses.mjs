import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',value:'',offsetTop:0,scrollTop:0,classList:{toggle(){}},setAttribute(){},insertAdjacentHTML(){},focus(){}});
  return elements.get(id);
};
const legacy = {version:1,notes:{'c1-t1':'Keep my Accounting note.'},reviewed:['c1-t1'],lastTopic:'c1-t1',quizScores:{'1':{highest:13,attempts:2}}};
const storage = new Map([['studyinghelper.v1',JSON.stringify(legacy)]]);
const context = vm.createContext({window:{addEventListener(){},scrollTo(){}},document:{getElementById:element,querySelector:element},location:{hash:''},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},FormData:class{constructor(form){this.form=form;}get(name){return this.form.answers[name];}},setTimeout(){},clearTimeout(){},console});
for (const file of ['content.js','quiz-data.js','microeconomics-data.js','courses.js']) vm.runInContext(read('website/'+file),context);
const courses=context.window.STUDY_COURSES;
assert.equal(courses.length,2);
const micro=courses[1];
assert.deepEqual(Array.from(micro.chapters,c=>c.id),[1,2,3,4,5,7,8]);
assert.deepEqual(Array.from(micro.quizzes,c=>c.id),[1,2,3,4,5,7,8]);
assert.equal(micro.quizzes.reduce((n,q)=>n+q.questions.length,0),190);
for(const id of [7,8]) assert.equal(micro.quizzes.find(q=>q.id===id).questions.length,30);
// Verified against the numbered answer tables in the supplied PDFs.
const suppliedKeys={
  7:'C A D B C B A D C A B D C A B D A C D B A D C C A B C D A C',
  8:'D B A C D A C B D B A C B D A C D B A C D B A C B D C A B D',
};
for(const id of [7,8]){
  const questions=micro.quizzes.find(q=>q.id===id).questions;
  assert.equal(questions.map(q=>'ABCD'[q.answer]).join(' '),suppliedKeys[id],'Imported keys must match the supplied PDFs');
  assert.deepEqual(Array.from(questions,q=>q.sourceQuestion),Array.from({length:30},(_,i)=>i+1));
}
for(const number of [3,4,5]){
  const question=micro.quizzes.find(q=>q.id===8).questions.find(q=>q.sourceQuestion===number);
  assert.ok(!/Question 1\b/.test(question.prompt),'Sampled questions cannot rely on another question');
  for(const technique of ['A: 25 labour, 50 capital','B: 35 labour, 35 capital','C: 50 labour, 25 capital','D: 30 labour, 60 capital']) assert.ok(question.prompt.includes(technique));
}
const allIds=courses.flatMap(c=>c.chapters.flatMap(ch=>ch.topics.map(t=>t.id)));
assert.equal(new Set(allIds).size,allIds.length,'Topic IDs must not collide between courses');
for(const chapter of micro.chapters){
  if(chapter.deck) assert.ok(fs.existsSync(new URL('../website/'+chapter.deck,import.meta.url)));
  for(const topic of chapter.topics){
    assert.ok(topic.body.trim(),topic.title);
    assert.ok(!/sandbox:|chatgpt-content-reference/.test(topic.body),'No unresolved chat references');
    for(const figure of topic.figures) assert.ok(fs.existsSync(new URL('../website/'+figure.src,import.meta.url)),figure.src);
  }
}
for(const quiz of micro.quizzes){
  assert.ok(quiz.questions.length>=25);
  assert.equal(new Set(quiz.questions.map(q=>q.prompt)).size,quiz.questions.length);
  for(const question of quiz.questions){
    assert.equal(question.options.length,4);
    assert.ok(question.options.every(value=>value.trim()));
    assert.ok(Number.isInteger(question.answer)&&question.answer>=0&&question.answer<4);
  }
}
const app=read('website/app.js').replace(/\r\n/g,'\n').replace('  render();\n})();','  window.testApi={validate,render,createQuizAttempt,quizScore,equation,getAttempt:()=>quizAttempt};\n  render();\n})();');
vm.runInContext(app,context);
const api=context.window.testApi;
assert.equal(api.validate(legacy).notes['c1-t1'],legacy.notes['c1-t1']);
assert.ok(element('main').innerHTML.includes('View Microeconomics'));
context.location.hash='#microeconomics/1';api.render();
let saved=JSON.parse(storage.get('studyinghelper.v1'));
assert.equal(saved.notes['c1-t1'],legacy.notes['c1-t1']);
assert.equal(saved.quizScores['1'].highest,13);
assert.equal(api.quizScore(1).attempts,0,'Microeconomics must not display the Accounting score');
element('personal-note').oninput({target:{value:'Separate economics note'}});
saved=JSON.parse(storage.get('studyinghelper.v1'));
assert.equal(saved.notes['micro-c1-t1'],'Separate economics note');
assert.equal(saved.notes['c1-t1'],legacy.notes['c1-t1']);
const attempt=api.createQuizAttempt(1);
assert.equal(attempt.questions.length,15);
assert.equal(new Set(attempt.questions.map(q=>q.prompt)).size,15);
for(const question of attempt.questions){
  const original=micro.quizzes[0].questions.find(q=>q.prompt===question.prompt);
  assert.equal(question.options[question.answer],original.options[original.answer].replace(/All of the above/gi,'All of these options').replace(/None of the above/gi,'None of these options'),'Shuffling must preserve the correct answer');
}
context.location.hash='#accounting/1';api.render();
assert.equal(api.quizScore(1).highest,13);
context.location.hash='#microeconomics/1/quiz';api.render();
const submit = correct => {
  const current=api.getAttempt();
  const answers=Object.fromEntries(current.questions.map((q,index)=>[`question-${index}`,String(correct?q.answer:(q.answer+1)%4)]));
  element('quiz-form').onsubmit({preventDefault(){},target:{reportValidity(){return true;},answers}});
};
submit(true);
saved=JSON.parse(storage.get('studyinghelper.v1'));
assert.equal(saved.quizScores['microeconomics:1'].highest,15);
assert.equal(saved.quizScores['microeconomics:1'].attempts,1);
assert.equal(saved.quizScores['1'].highest,13,'Submitting Microeconomics must not change Accounting scores');
element('retry-quiz').onclick();submit(false);
saved=JSON.parse(storage.get('studyinghelper.v1'));
assert.equal(saved.quizScores['microeconomics:1'].highest,15,'A lower score must not replace the highest score');
assert.equal(saved.quizScores['microeconomics:1'].attempts,2);
assert.equal(api.validate(saved).quizScores['microeconomics:1'].highest,15,'Combined backups must validate');
assert.ok(api.equation('\\frac{\\text{Value in given period}}{\\text{Value in base period}}\\times100').includes('(Value in given period) ÷ (Value in base period)'));
for(const id of [7,8]){
  const chapter=micro.chapters.find(c=>c.id===id);
  for(const topic of chapter.topics){
    context.location.hash=`#microeconomics/${id}/${topic.id}`;api.render();
    assert.ok(element('main').innerHTML.includes(topic.title));
    assert.ok(!/\\(?:[A-Za-z]+|\[|\])/.test(element('main').innerHTML),'Chapter formulas should render without raw LaTeX');
  }
  element('personal-note').oninput({target:{value:`Chapter ${id} personal note`}});
  element('reviewed').onchange({target:{checked:true}});
  context.location.hash=`#microeconomics/${id}/quiz`;api.render();
  assert.ok(element('main').innerHTML.includes('Bank: 30 questions.'));
  const current=api.getAttempt();
  assert.equal(current.questions.length,15);
  assert.equal(new Set(current.questions.map(q=>q.prompt)).size,15);
  for(const question of current.questions){
    const original=micro.quizzes.find(q=>q.id===id).questions.find(q=>q.prompt===question.prompt);
    assert.equal(question.options[question.answer],original.options[original.answer],'Chapter 7–8 answer shuffling must preserve the key');
  }
  submit(true);
  element('retry-quiz').onclick();submit(false);
  saved=JSON.parse(storage.get('studyinghelper.v1'));
  assert.equal(saved.quizScores[`microeconomics:${id}`].highest,15);
  assert.equal(saved.quizScores[`microeconomics:${id}`].attempts,2);
  assert.equal(saved.quizScores['1'].highest,13);
  assert.equal(saved.quizScores['microeconomics:1'].highest,15);
  assert.equal(api.validate(saved).notes[chapter.topics.at(-1).id],`Chapter ${id} personal note`);
  assert.ok(api.validate(saved).reviewed.includes(chapter.topics.at(-1).id));
}
context.location.hash='#';api.render();
assert.ok(element('main').innerHTML.includes('Chapters 01–05, 07–08'),'Chapter ranges should preserve the gap before Chapter 7');
context.location.hash='#microeconomics';api.render();
assert.ok(element('main').innerHTML.includes('01–05, 07–08'));
console.log('Courses verified: content assets, 190 Microeconomics questions, Chapter 7–8 routes/formulas/grading/retries/backups, answer shuffling, and separate course data.');
