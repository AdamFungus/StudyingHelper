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
assert.equal(micro.chapters.length,5);
assert.equal(micro.quizzes.reduce((n,q)=>n+q.questions.length,0),130);
const allIds=courses.flatMap(c=>c.chapters.flatMap(ch=>ch.topics.map(t=>t.id)));
assert.equal(new Set(allIds).size,allIds.length,'Topic IDs must not collide between courses');
for(const chapter of micro.chapters){
  assert.ok(fs.existsSync(new URL('../website/'+chapter.deck,import.meta.url)));
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
console.log('Courses verified: content assets, 130 Microeconomics questions, answer shuffling, quiz grading/retries, legacy backups, and separate course data.');
