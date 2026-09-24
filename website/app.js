(() => {
  'use strict';
  const courses = window.STUDY_COURSES;
  let activeCourse = courses[0];
  let chapters = activeCourse.chapters;
  let quizzes = activeCourse.quizzes;
  const KEY = 'studyinghelper.v1';
  let allTopics = chapters.flatMap(c => c.topics);
  const validIds = new Set(courses.flatMap(course => course.chapters.flatMap(chapter => chapter.topics.map(topic => topic.id))));
  const scoreKey = (id, course = activeCourse) => course.id === 'accounting' ? String(id) : `${course.id}:${id}`;
  const validChapterIds = new Set(courses.flatMap(course => course.chapters.map(chapter => scoreKey(chapter.id, course))));
  let quizByChapter = new Map(quizzes.map(quiz => [quiz.id, quiz]));
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = {version:1, notes:{}, reviewed:[], lastTopic:null, quizScores:{}};
  let quizAttempt = null;
  let storageBlocked = false;
  let notificationTimer;
  function notify(message, persistent = false) {
    clearTimeout(notificationTimer); $('status').textContent = message;
    if (!persistent) notificationTimer = setTimeout(() => $('status').textContent = '', 6000);
  }
  function validate(data) {
    if (!data || data.version !== 1 || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes) || !Array.isArray(data.reviewed)) throw Error('Invalid backup');
    const notes = {};
    for (const [id, value] of Object.entries(data.notes)) {
      if (!validIds.has(id) || typeof value !== 'string' || value.length > 500000) throw Error('Invalid note');
      notes[id] = value;
    }
    if (!data.reviewed.every(id => validIds.has(id))) throw Error('Invalid progress');
    const quizScores = {};
    if (data.quizScores !== undefined) {
      if (!data.quizScores || typeof data.quizScores !== 'object' || Array.isArray(data.quizScores)) throw Error('Invalid quiz scores');
      for (const [id, value] of Object.entries(data.quizScores)) {
        if (!validChapterIds.has(id) || !value || !Number.isInteger(value.highest) || value.highest < 0 || value.highest > 15 || !Number.isInteger(value.attempts) || value.attempts < 0) throw Error('Invalid quiz score');
        quizScores[id] = {highest:value.highest, attempts:value.attempts};
      }
    }
    return {version:1, notes, reviewed:[...new Set(data.reviewed)], lastTopic: validIds.has(data.lastTopic) ? data.lastTopic : null, quizScores};
  }
  try { const raw = localStorage.getItem(KEY); if (raw) state = validate(JSON.parse(raw)); }
  catch { storageBlocked = true; notify('Saved data could not be read. Your existing data has not been changed. Export new notes before closing, or restore a valid backup.', true); }
  function save() {
    try {
      if (storageBlocked) throw Error('Storage unavailable');
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch { notify('Could not save in this browser. Keep this page open and export your data to preserve your notes.', true); return false; }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({...state, exportedAt:new Date().toISOString()}, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `studyinghelper-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notify('Backup export started. Check your browser downloads for the JSON file.');
  }
  $('export').onclick = exportData;
  $('import').onclick = () => $('backup-file').click();
  $('backup-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 10000000) throw Error('Too large');
      const incoming = validate(JSON.parse(await file.text()));
      let conflicts = 0;
      for (const [id, note] of Object.entries(incoming.notes)) {
        if (state.notes[id] && state.notes[id] !== note && note) {
          state.notes[id] += '\n\n—— Restored backup ——\n\n' + note; conflicts++;
        } else if (note) state.notes[id] = note;
      }
      state.reviewed = [...new Set([...state.reviewed, ...incoming.reviewed])];
      for (const [id, score] of Object.entries(incoming.quizScores)) {
        const current = state.quizScores[id] || {highest:0, attempts:0};
        state.quizScores[id] = {highest:Math.max(current.highest, score.highest), attempts:Math.max(current.attempts, score.attempts)};
      }
      storageBlocked = false;
      if (save()) notify(`Backup restored. ${conflicts ? 'Different versions of notes were kept together.' : 'Your current notes were kept.'}`);
      render();
    } catch { notify('That file is not a valid StudyingHelper backup. Your notes have not been changed.'); }
    event.target.value = '';
  };
  function inline(text) { return escape(text.replace(/\\\(([\s\S]*?)\\\)/g, (_, value) => mathText(value))).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function mathText(raw) {
    return raw.replace(/\\(?:text|mathrm)\{([^{}]*)\}/g,'$1')
      .replace(/\\Delta/g,'Δ').replace(/\\eta/g,'η').replace(/\\infty/g,'∞')
      .replace(/\\uparrow/g,' ↑ ').replace(/\\downarrow/g,' ↓ ').replace(/\\Rightarrow/g,' ⇒ ')
      .replace(/\\times/g,' × ').replace(/\\%/g,'%').replace(/_\{([^}]+)\}/g,'_$1');
  }
  function equation(raw) {
    let text = mathText(raw).trim().replace(/\\(?:boxed|text|mathrm)\s*\{/g, '{');
    // Unwrap nested presentation groups before translating fractions.
    for (let i = 0; i < 4; i++) text = text.replace(/\{([^{}]*)\}/g, (whole, inner, offset) => {
      const before = text.slice(0, offset);
      return /\\frac\s*$/.test(before) || /\\frac\s*\{[^{}]*\}\s*$/.test(before) ? whole : inner;
    });
    text = text.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1) ÷ ($2)');
    return escape(text.replace(/\\neq/g, ' ≠ ').replace(/\\times/g,' × ').replace(/\\%/g,'%').replace(/\\\$/g,'$').replace(/\\ /g,' ').replace(/[{}]/g,'').replace(/\s+/g,' ').trim());
  }
  function markdown(raw) {
    const formulas = [];
    raw = raw.replace(/\\\[([\s\S]*?)\\\]/g, (_, value) => { formulas.push(equation(value)); return '\n\n@@FORMULA'+(formulas.length-1)+'@@\n\n'; });
    const lines = raw.split('\n'); let html = '', list = null;
    const endList = () => { if (list) html += `</${list}>`; list = null; };
    for (let i=0;i<lines.length;i++) {
      const line=lines[i].trim();
      if (!line || /^---+$/.test(line)) { endList(); continue; }
      const formula = line.match(/^@@FORMULA(\d+)@@$/);
      if (formula) { endList(); html += `<div class="formula">${formulas[+formula[1]]}</div>`; continue; }
      const heading = line.match(/^(#{1,6})\s+(.+)/);
      if (heading) { endList(); const tag = heading[1].length < 3 ? 'h3' : 'h4'; html += `<${tag}>${inline(heading[2])}</${tag}>`; continue; }
      if (line.startsWith('|')) {
        endList(); const rows=[];
        while (i<lines.length && lines[i].trim().startsWith('|')) { const cells=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()); if (!cells.every(c=>/^:?-+:?$/.test(c))) rows.push(cells); i++; } i--;
        html += '<div class="table-wrap"><table><thead><tr>'+rows[0].map(c=>`<th scope="col">${inline(c)}</th>`).join('')+'</tr></thead><tbody>'+rows.slice(1).map(r=>'<tr>'+r.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>'; continue;
      }
      const bullet=line.match(/^(-|\d+\.)\s+(.+)/);
      if (bullet) { const type=bullet[1]==='-'?'ul':'ol'; if (list!==type) { endList(); list=type; html+=`<${type}>`; } html+=`<li>${inline(bullet[2])}</li>`; continue; }
      endList(); html += line.startsWith('>') ? `<blockquote>${inline(line.slice(1).trim())}</blockquote>` : `<p>${inline(line)}</p>`;
    }
    endList(); return html;
  }
  const topicUrl = (c,t) => `#${activeCourse.id}/${c.id}/${t.id}`;
  const reviewedCount = c => c.topics.filter(t => state.reviewed.includes(t.id)).length;
  const quizScore = chapterId => state.quizScores[scoreKey(chapterId)] || {highest:0, attempts:0};
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function createQuizAttempt(chapterId) {
    const source = quizByChapter.get(chapterId);
    if (!source || source.questions.length < 15) throw Error(`Quiz data missing for Chapter ${chapterId}`);
    return {
      chapterId,
      courseId:activeCourse.id,
      result:null,
      questions:shuffle(source.questions).slice(0, 15).map(question => {
        const options = shuffle(question.options.map((text, index) => ({text:text.replace(/All of the above/gi,'All of these options').replace(/None of the above/gi,'None of these options'), correct:index === question.answer})));
        return {prompt:question.prompt, options:options.map(option => option.text), answer:options.findIndex(option => option.correct)};
      })
    };
  }
  function chapterNav(chapter, activeId) {
    const score = quizScore(chapter.id);
    return `<details class="topic-nav" open><summary>IN THIS CHAPTER · ${chapter.topics.length} TOPICS + QUIZ</summary><nav aria-label="Chapter sections"><a class="topic-link quiz-link ${activeId==='quiz'?'active':''}" ${activeId==='quiz'?'aria-current="page"':''} href="#${activeCourse.id}/${chapter.id}/quiz"><span class="number">QZ</span><span>Chapter quiz<small>${score.attempts?`Highest ${score.highest}/15`:'15 randomized questions'}</small></span></a>${chapter.topics.map((topic,index)=>`<a class="topic-link ${topic.id===activeId?'active':''}" ${topic.id===activeId?'aria-current="page"':''} href="${topicUrl(chapter,topic)}"><span class="number">${state.reviewed.includes(topic.id)?'✓':String(index+1).padStart(2,'0')}</span><span>${escape(topic.title)}</span></a>`).join('')}</nav></details>`;
  }
  function renderQuiz(chapter) {
    if (!quizAttempt || quizAttempt.chapterId !== chapter.id || quizAttempt.courseId !== activeCourse.id) quizAttempt = createQuizAttempt(chapter.id);
    const result = quizAttempt.result;
    const saved = quizScore(chapter.id);
    document.title = `Chapter ${chapter.id} quiz — StudyingHelper`;
    $('main').innerHTML = `<a class="back" href="#${activeCourse.id}">← All chapters</a><div class="eyebrow">${escape(activeCourse.shortTitle.toUpperCase())} / CHAPTER ${String(chapter.id).padStart(2,'0')}</div><h1 class="chapter-title">${escape(chapter.title)}</h1><div class="reader-layout">${chapterNav(chapter,'quiz')}<div class="reader"><section class="article quiz-intro"><div class="topic-counter">CHAPTER QUIZ · 15 QUESTIONS</div><h2>Test your understanding</h2><p class="lead">Questions and answer choices are shuffled for every attempt. Submit all 15 answers to receive your mark.</p><p class="quiz-provenance">${escape(quizByChapter.get(chapter.id).source || "Questions from Create Chapter Quiz Bank.")} Bank: ${quizByChapter.get(chapter.id).questions.length} questions.</p>${result?`<div class="quiz-result" role="status"><div><span class="quiz-mark">${result.score}/15</span><div><strong>${Math.round(result.score/15*100)}% on this attempt</strong><br><span>Highest score: ${saved.highest}/15 · ${saved.attempts} ${saved.attempts===1?'attempt':'attempts'}</span>${result.newHigh?'<br><em>New highest score!</em>':''}</div></div><button class="primary" id="retry-quiz" type="button">Redo quiz</button></div>`:`<div class="quiz-best"><strong>${saved.attempts?`Highest score: ${saved.highest}/15`:'No attempts yet'}</strong><span>${saved.attempts?`${saved.attempts} ${saved.attempts===1?'attempt':'attempts'} saved on this computer`:'Your highest score will be saved on this computer.'}</span></div>`}</section><form id="quiz-form" class="quiz-form">${quizAttempt.questions.map((question,index)=>`<fieldset class="quiz-question ${result?(result.answers[index]===question.answer?'is-correct':'is-wrong'):''}"><legend><span>${index+1}</span>${escape(question.prompt)}</legend><div class="quiz-options">${question.options.map((option,optionIndex)=>{const checked=result?.answers[index]===optionIndex; const correct=result&&question.answer===optionIndex; return `<label class="quiz-option ${correct?'correct-answer':''} ${result&&checked&&!correct?'wrong-answer':''}"><input type="radio" name="question-${index}" value="${optionIndex}" ${optionIndex===0&&!result?'required':''} ${checked?'checked':''} ${result?'disabled':''}><span>${escape(option)}</span>${correct?'<strong>Correct answer</strong>':''}</label>`;}).join('')}</div>${result&&result.answers[index]!==question.answer?`<p class="answer-note">Your answer was incorrect. The correct answer is <strong>${escape(question.options[question.answer])}</strong>.</p>`:''}</fieldset>`).join('')}<div class="quiz-submit">${result?'<button class="primary" id="retry-quiz-bottom" type="button">Try another order</button>':'<button class="primary" type="submit">Submit quiz</button>'}<a class="secondary" href="#${activeCourse.id}/${chapter.id}">Back to chapter notes</a></div></form></div></div>`;
    if (result) {
      const retry = () => { quizAttempt = createQuizAttempt(chapter.id); renderQuiz(chapter); window.scrollTo(0,0); };
      $('retry-quiz').onclick = retry;
      $('retry-quiz-bottom').onclick = retry;
    } else {
      $('quiz-form').onsubmit = event => {
        event.preventDefault();
        if (!event.target.reportValidity()) return;
        const form = new FormData(event.target);
        const answers = quizAttempt.questions.map((_, index) => Number(form.get(`question-${index}`)));
        const score = answers.reduce((total, answer, index) => total + (answer === quizAttempt.questions[index].answer ? 1 : 0), 0);
        const previous = quizScore(chapter.id);
        const newHigh = !previous.attempts || score > previous.highest;
        state.quizScores[scoreKey(chapter.id)] = {highest:Math.max(previous.highest, score), attempts:previous.attempts + 1};
        save();
        quizAttempt.result = {answers, score, newHigh};
        renderQuiz(chapter);
        window.scrollTo(0,0);
      };
    }
    const active=document.querySelector('.topic-link.active'); const nav=document.querySelector('.topic-nav'); nav.scrollTop=Math.max(0,active.offsetTop-nav.offsetTop-70);
  }
  function render() {
    const route = location.hash.slice(1).split('/');
    const course = courses.find(item => item.id === route[0]);
    if (course) {
      activeCourse = course; chapters = course.chapters; quizzes = course.quizzes;
      allTopics = chapters.flatMap(chapter => chapter.topics);
      quizByChapter = new Map(quizzes.map(quiz => [quiz.id, quiz]));
    }
    $('library-link').classList.toggle('active', !course);
    $('library-link').setAttribute('aria-current', !course ? 'page' : 'false');
    for (const item of courses) {
      const selected = item.id === course?.id;
      $(item.id + '-link').classList.toggle('active', selected);
      $(item.id + '-link').setAttribute('aria-current', selected ? 'page' : 'false');
    }
    $('breadcrumb').innerHTML = course ? `<a href="#">Study library</a> / <strong>${escape(course.title)}</strong>` : 'Workspace / <strong>Study library</strong>';
    document.title = 'StudyingHelper — Study library';
    if (!course) { quizAttempt = null; renderLibrary(); return; }
    const chapter = chapters.find(c=>String(c.id)===route[1]);
    if (!chapter) { renderCourse(); return; }
    if (route[2] === 'quiz') { renderQuiz(chapter); return; }
    quizAttempt = null;
    const topic = chapter.topics.find(t=>t.id===route[2]) || chapter.topics[0];
    const index=chapter.topics.indexOf(topic);
    state.lastTopic=topic.id; save();
    document.title=`${topic.title} — StudyingHelper`;
    $('main').innerHTML=`<a class="back" href="#${activeCourse.id}">← All chapters</a><div class="eyebrow">${escape(activeCourse.shortTitle.toUpperCase())} / CHAPTER ${String(chapter.id).padStart(2,'0')}</div><h1 class="chapter-title">${escape(chapter.title)}</h1><div class="reader-layout">${chapterNav(chapter,topic.id)}<div class="reader"><article class="article"><div class="topic-counter">TOPIC ${String(index+1).padStart(2,'0')} / ${chapter.topics.length}</div><h2>${escape(topic.title)}</h2><div class="prose">${topic.format==='markdown'?markdown(topic.body):topic.body.split(/\n\n+/).filter(Boolean).map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('')}${!topic.body.trim()?'<p>This topic is illustrated in the original slides. Open the chapter slides below to view the example.</p>':''}</div><div class="source-small">${escape(topic.source)}${topic.slides?` · Slides ${topic.slides.join(', ')}<br>Slide text is included here. Consult the original slides for visual examples and diagrams. <a href="${chapter.deck}" download>Download chapter slides</a>`:''}</div><div class="reader-actions"><label class="review-control"><input id="reviewed" type="checkbox" ${state.reviewed.includes(topic.id)?'checked':''}> Mark as reviewed</label><span class="meta" id="chapter-progress">${reviewedCount(chapter)} of ${chapter.topics.length} reviewed</span></div></article><section class="personal"><div class="personal-head"><label for="personal-note">Your notes</label><span class="save-status" id="save-status" role="status">${storageBlocked?'Not saved':'Saved on this computer'}</span></div><textarea id="personal-note" placeholder="Add an explanation in your own words, a question, or an example…">${escape(state.notes[topic.id]||'')}</textarea></section><nav class="pagination" aria-label="Topic navigation">${index>0?`<a class="secondary" href="${topicUrl(chapter,chapter.topics[index-1])}">← Previous topic</a>`:'<span></span>'}${index<chapter.topics.length-1?`<a class="primary" href="${topicUrl(chapter,chapter.topics[index+1])}">Next topic →</a>`:`<a class="primary" href="#${activeCourse.id}/${chapter.id}/quiz">Take chapter quiz →</a>`}</nav></div></div>`;
    if (topic.figures?.length) {
      document.querySelector('.prose').insertAdjacentHTML('beforeend', topic.figures.map(figure => `<figure class="source-figure"><a href="${figure.src}" target="_blank" rel="noopener"><img src="${figure.src}" alt="${escape(figure.alt)}" loading="lazy"></a><figcaption>${escape(figure.caption)} · Select to enlarge.</figcaption></figure>`).join(''));
    }
    if (activeCourse.id === 'microeconomics') {
      document.querySelector('.source-small').insertAdjacentHTML('beforeend', `<br><a href="${chapter.deck}" target="_blank" rel="noopener">Open original chapter slides (PDF)</a>`);
    }
    if (topic.blocks) {
      const hasContent = topic.blocks.some(b => b.body.trim() || b.images.length || b.tables.length);
      if (hasContent) document.querySelector('.prose').innerHTML = topic.blocks.map(block =>
        block.body.split(/\n\n+/).filter(Boolean).map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('') +
        block.tables.map(rows=>'<div class="table-wrap"><table><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>`<td>${escape(cell)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>').join('') +
        block.images.map(img=>`<figure class="source-figure"><a href="${img.src}" target="_blank" rel="noopener"><img src="${img.src}" alt="${escape(img.alt)}" loading="lazy"></a><figcaption>Original course visual · Slide ${block.slide}. Select to enlarge.</figcaption></figure>`).join('')
      ).join('');
    }
    $('personal-note').oninput = event => { state.notes[topic.id]=event.target.value; $('save-status').textContent=save()?'Saved on this computer':'Not saved — export your data'; };
    $('reviewed').onchange = event => {
      state.reviewed=state.reviewed.filter(id=>id!==topic.id); if(event.target.checked) state.reviewed.push(topic.id); save();
      $('chapter-progress').textContent=`${reviewedCount(chapter)} of ${chapter.topics.length} reviewed`;
      document.querySelector('.topic-link.active .number').textContent=event.target.checked?'✓':String(index+1).padStart(2,'0');
    };
    const active=document.querySelector('.topic-link.active'); const nav=document.querySelector('.topic-nav'); nav.scrollTop=Math.max(0,active.offsetTop-nav.offsetTop-70);
  }
  function renderLibrary() {
    const lastCourse = courses.find(course => course.chapters.some(chapter => chapter.topics.some(topic => topic.id === state.lastTopic)));
    const lastChapter = lastCourse?.chapters.find(chapter => chapter.topics.some(topic => topic.id === state.lastTopic));
    const lastTopic = lastChapter?.topics.find(topic => topic.id === state.lastTopic);
    $('main').innerHTML = `<div class="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h1>Your study library.</h1><p class="lead">A place for your course notes, chapter by chapter.</p><div class="section-head"><h2>Study guides</h2><span class="count">${courses.length} guides</span></div><div class="library-guides">${courses.map((course,index) => `<div class="guide-card ${course.id}"><div class="book-cover" aria-hidden="true"><small>STUDY GUIDE / ${String(index+1).padStart(2,'0')}</small><div>${course.cover}</div><span>${escape(course.edition)}<br>Chapters 01–${String(course.chapters.length).padStart(2,'0')}</span></div><div class="card-content"><span class="pill">INCLUDED IN YOUR LIBRARY</span><h2>${escape(course.title)}</h2><p class="meta">${course.chapters.length} chapters · ${course.chapters.reduce((total,chapter)=>total+chapter.topics.length,0)} topics<br>${course.quizzes.reduce((total,quiz)=>total+quiz.questions.length,0)} practice questions</p><a href="#${course.id}" class="primary">View ${escape(course.title)} <span aria-hidden="true">→</span></a></div></div>`).join('')}</div>${lastTopic ? `<p class="local-notice">Pick up where you left off: <a href="#${lastCourse.id}/${lastChapter.id}/${lastTopic.id}"><strong>${escape(lastCourse.title)} · ${escape(lastTopic.title)} →</strong></a></p>` : ''}<p class="local-notice">Your personal notes, progress, and quiz scores save automatically in this browser. Export a backup to keep a separate copy; clearing browser data removes locally saved data.</p><div class="mobile-backups"><button class="secondary" id="mobile-export">Export data</button><button class="secondary" id="mobile-import">Restore backup</button></div>`;
    $('mobile-export').onclick = exportData;
    $('mobile-import').onclick = () => $('backup-file').click();
  }
  function renderCourse() {
    document.title=`${activeCourse.title} — StudyingHelper`;
    $('main').innerHTML=`<a class="back" href="#">← Study library</a><div class="course-head"><div><div class="eyebrow">YOUR INCLUDED STUDY GUIDE</div><h1>${escape(activeCourse.title)}</h1><p class="lead">Choose a chapter to study its topics or take a randomized 15-question quiz.</p></div><div class="progress-block">${allTopics.filter(topic => state.reviewed.includes(topic.id)).length} of ${allTopics.length} topics reviewed<div class="progress" role="progressbar" aria-label="Study progress" aria-valuemin="0" aria-valuemax="${allTopics.length}" aria-valuenow="${allTopics.filter(topic => state.reviewed.includes(topic.id)).length}"><span style="width:${allTopics.filter(topic => state.reviewed.includes(topic.id)).length/allTopics.length*100}%"></span></div></div></div><div class="section-head"><h2>Chapters</h2><span class="count">01 — ${String(chapters.length).padStart(2,'0')}</span></div><div class="chapter-list">${chapters.map(c=>{const score=quizScore(c.id);return `<div class="chapter-card"><a class="chapter-main" href="#${activeCourse.id}/${c.id}"><span class="chapter-no">${String(c.id).padStart(2,'0')}</span><div><h3>${escape(c.title)}</h3><div class="meta">${c.topics.length} topics · ${reviewedCount(c)} reviewed</div></div></a><a class="quiz-shortcut" href="#${activeCourse.id}/${c.id}/quiz"><strong>Quiz</strong><span>${score.attempts?`Highest ${score.highest}/15`:'15 questions'}</span></a></div>`;}).join('')}</div><p class="source-note"><strong>About these notes.</strong> ${escape(activeCourse.sourceNote)}</p>`;
  }
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('main').focus({preventScroll:true});});
  render();
})();

