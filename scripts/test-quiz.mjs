import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../website/quiz-data.js', import.meta.url), 'utf8');
const context = {window:{}};
vm.runInNewContext(source, context);
const quizzes = context.window.STUDY_QUIZZES;

assert.equal(quizzes.length, 12, 'quiz bank should contain 12 chapters');
for (const [index, chapter] of quizzes.entries()) {
  assert.equal(chapter.id, index + 1, 'chapter ids should be sequential');
  assert.equal(chapter.questions.length, 15, `Chapter ${chapter.id} should contain 15 questions`);
  const prompts = new Set();
  for (const question of chapter.questions) {
    assert.equal(typeof question.prompt, 'string');
    assert.ok(question.prompt.trim());
    assert.equal(question.options.length, 4, 'each question should have four choices');
    assert.ok(question.options.every(option => typeof option === 'string' && option.trim()));
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(!prompts.has(question.prompt), `Chapter ${chapter.id} contains a duplicate question`);
    prompts.add(question.prompt);
  }
}

console.log('Quiz data verified: 12 chapters × 15 questions.');

