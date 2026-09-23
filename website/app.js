(() => {
  'use strict';
  const chapters = window.STUDY_CHAPTERS;
  const KEY = 'studyinghelper.v1';
  const allTopics = chapters.flatMap(c => c.topics);
  const validIds = new Set(allTopics.map(t => t.id));
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = {version:1, notes:{}, reviewed:[], lastTopic:null};
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
    return {version:1, notes, reviewed:[...new Set(data.reviewed)], lastTopic: validIds.has(data.lastTopic) ? data.lastTopic : null};
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
      storageBlocked = false;
      if (save()) notify(`Backup restored. ${conflicts ? 'Different versions of notes were kept together.' : 'Your current notes were kept.'}`);
      render();
    } catch { notify('That file is not a valid StudyingHelper backup. Your notes have not been changed.'); }
    event.target.value = '';
  };
  function inline(text) { return escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function equation(raw) {
    let text = raw.trim().replace(/\\(?:boxed|text|mathrm)\s*\{/g, '{');
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
  const topicUrl = (c,t) => `#accounting/${c.id}/${t.id}`;
  const reviewedCount = c => c.topics.filter(t => state.reviewed.includes(t.id)).length;
  function render() {
    const route = location.hash.slice(1).split('/');
    const course = route[0] === 'accounting';
    $('library-link').classList.toggle('active',!course); $('accounting-link').classList.toggle('active',course);
    $('library-link').setAttribute('aria-current',!course?'page':'false'); $('accounting-link').setAttribute('aria-current',course?'page':'false');
    $('breadcrumb').innerHTML = course ? '<a href="#">Study library</a> / <strong>Accounting notes</strong>' : 'Workspace / <strong>Study library</strong>';
    document.title = 'StudyingHelper — Study library';
    if (!course) {
      const lastC = chapters.find(c=>c.topics.some(t=>t.id===state.lastTopic));
      const lastT = lastC?.topics.find(t=>t.id===state.lastTopic);
      $('main').innerHTML=`<div class="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h1>Your study library.</h1><p class="lead">A place for your course notes, chapter by chapter.</p><div class="section-head"><h2>Study guides</h2><span class="count">1 guide</span></div><div class="guide-card"><div class="book-cover" aria-hidden="true"><small>STUDY GUIDE / 01</small><div>Financial<br>Accounting</div><span>Canadian edition<br>Chapters 01–12</span></div><div class="card-content"><span class="pill">INCLUDED IN YOUR LIBRARY</span><h2>Accounting notes</h2><p class="meta">12 chapters · ${allTopics.length} topics<br>From your study guide and course slides.</p><a href="#accounting" class="primary">View Accounting notes <span aria-hidden="true">→</span></a></div></div>${lastT?`<p class="local-notice">Pick up where you left off: <a href="${topicUrl(lastC,lastT)}"><strong>Chapter ${lastC.id} · ${escape(lastT.title)} →</strong></a></p>`:''}<p class="local-notice">Your personal notes and reading progress save automatically in this browser. Export a backup to keep a separate copy; clearing browser data removes locally saved notes.</p><div class="mobile-backups"><button class="secondary" id="mobile-export">Export data</button><button class="secondary" id="mobile-import">Restore backup</button></div>`;
      $('mobile-export').onclick=exportData; $('mobile-import').onclick=()=>$('backup-file').click(); return;
    }
    const chapter = chapters.find(c=>String(c.id)===route[1]);
    if (!chapter) { renderCourse(); return; }
    const topic = chapter.topics.find(t=>t.id===route[2]) || chapter.topics[0];
    const index=chapter.topics.indexOf(topic);
    state.lastTopic=topic.id; save();
    document.title=`${topic.title} — StudyingHelper`;
    $('main').innerHTML=`<a class="back" href="#accounting">← All chapters</a><div class="eyebrow">ACCOUNTING / CHAPTER ${String(chapter.id).padStart(2,'0')}</div><h1 class="chapter-title">${escape(chapter.title)}</h1><div class="reader-layout"><details class="topic-nav" open><summary>IN THIS CHAPTER · ${chapter.topics.length} TOPICS</summary><nav aria-label="Chapter topics">${chapter.topics.map((t,i)=>`<a class="topic-link ${t.id===topic.id?'active':''}" ${t.id===topic.id?'aria-current="page"':''} href="${topicUrl(chapter,t)}"><span class="number">${state.reviewed.includes(t.id)?'✓':String(i+1).padStart(2,'0')}</span><span>${escape(t.title)}</span></a>`).join('')}</nav></details><div class="reader"><article class="article"><div class="topic-counter">TOPIC ${String(index+1).padStart(2,'0')} / ${chapter.topics.length}</div><h2>${escape(topic.title)}</h2><div class="prose">${topic.format==='markdown'?markdown(topic.body):topic.body.split(/\n\n+/).filter(Boolean).map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('')}${!topic.body.trim()?'<p>This topic is illustrated in the original slides. Open the chapter slides below to view the example.</p>':''}</div><div class="source-small">${escape(topic.source)}${topic.slides?` · Slides ${topic.slides.join(', ')}<br>Slide text is included here. Consult the original slides for visual examples and diagrams. <a href="${chapter.deck}" download>Download chapter slides</a>`:''}</div><div class="reader-actions"><label class="review-control"><input id="reviewed" type="checkbox" ${state.reviewed.includes(topic.id)?'checked':''}> Mark as reviewed</label><span class="meta" id="chapter-progress">${reviewedCount(chapter)} of ${chapter.topics.length} reviewed</span></div></article><section class="personal"><div class="personal-head"><label for="personal-note">Your notes</label><span class="save-status" id="save-status" role="status">${storageBlocked?'Not saved':'Saved on this computer'}</span></div><textarea id="personal-note" placeholder="Add an explanation in your own words, a question, or an example…">${escape(state.notes[topic.id]||'')}</textarea></section><nav class="pagination" aria-label="Topic navigation">${index>0?`<a class="secondary" href="${topicUrl(chapter,chapter.topics[index-1])}">← Previous topic</a>`:'<span></span>'}${index<chapter.topics.length-1?`<a class="primary" href="${topicUrl(chapter,chapter.topics[index+1])}">Next topic →</a>`:chapter.id<12?`<a class="primary" href="#accounting/${chapter.id+1}">Next chapter →</a>`:'<a class="primary" href="#accounting">All chapters →</a>'}</nav></div></div>`;
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
  function renderCourse() {
    document.title='Accounting notes — StudyingHelper';
    $('main').innerHTML=`<a class="back" href="#">← Study library</a><div class="course-head"><div><div class="eyebrow">YOUR INCLUDED STUDY GUIDE</div><h1>Accounting notes</h1><p class="lead">Choose a chapter, then explore its topics at your own pace.</p></div><div class="progress-block">${state.reviewed.length} of ${allTopics.length} topics reviewed<div class="progress" role="progressbar" aria-label="Study progress" aria-valuemin="0" aria-valuemax="${allTopics.length}" aria-valuenow="${state.reviewed.length}"><span style="width:${state.reviewed.length/allTopics.length*100}%"></span></div></div></div><div class="section-head"><h2>Chapters</h2><span class="count">01 — 12</span></div><div class="chapter-list">${chapters.map(c=>`<a class="chapter-card" href="#accounting/${c.id}"><span class="chapter-no">${String(c.id).padStart(2,'0')}</span><div><h3>${escape(c.title)}</h3><div class="meta">${c.topics.length} topics · ${reviewedCount(c)} reviewed</div></div><span class="chevron" aria-hidden="true">›</span></a>`).join('')}</div><p class="source-note"><strong>About these notes.</strong> Chapters 1–3 come from “Create Study Guide Notes.” Chapters 4–12 use the attached Libby, Eighth Canadian Edition slides because the accessible conversation text ends during Chapter 4. Topics in those chapters preserve the slide text and link to the original slides for diagrams and examples. Course terminology and the slides’ original reporting context are preserved.</p>`;
  }
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('main').focus({preventScroll:true});});
  render();
})();
