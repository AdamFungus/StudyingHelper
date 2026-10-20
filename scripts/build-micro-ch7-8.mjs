// Add the retrieved Chapter 7–8 notes without changing existing topic IDs or quizzes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file = name => new URL('../' + name, import.meta.url);
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(file('website/microeconomics-data.js'), 'utf8'), context);
const notes = fs.readFileSync(file('scripts/micro-ch7-8-notes.md'), 'utf8');
const sections = [...notes.matchAll(/^# Chapter ([78]) — (Producers in the (?:Short|Long) Run)$/gm)];
assert.equal(sections.length, 2);

const figureTopics = {
  'Total Product Graph': ['ch7-total-product', 'Total product rises first at an increasing rate, then at a decreasing rate.'],
  'AP and MP Graph': ['ch7-ap-mp', 'Marginal product crosses average product at the maximum of average product.'],
  'Short-Run Cost Curve Relationships': ['ch7-short-run-costs', 'Marginal cost crosses AVC and ATC at their respective minima; AFC continually falls.'],
  'Cost Curve Shifts': ['ch7-variable-cost-shift', 'A higher wage raises marginal cost and average total cost at each output.'],
  'LRAC Graph': ['ch8-lrac', 'Long-run average cost falls, reaches its minimum at MES, then eventually rises.'],
  'LRAC vs. SRATC': ['ch8-lrac-sratc', 'Short-run plant cost curves touch LRAC from above and cannot lie below it.'],
};
const additions = sections.map((match, index) => {
  const id = Number(match[1]);
  const body = notes.slice(match.index + match[0].length, sections[index + 1]?.index ?? notes.length);
  const headings = [...body.matchAll(/^#{1,2} (.+)$/gm)];
  const intro = body.slice(0, headings[0].index).trim();
  const topics = intro ? [{id:`micro-c${id}-t1`,title:'Chapter overview',body:intro,format:'markdown',source:'Create Chapter Notes and Graphs · Chapter 7–8 notes',figures:[]}] : [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const content = body.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? body.length).trim().replace(/\n---\s*$/, '').trim();
    if (!content) continue;
    const figure = figureTopics[heading[1]];
    topics.push({
      id: `micro-c${id}-t${topics.length + 1}`, title: heading[1].replace(/\\\((.*?)\\\)/g, (_,value)=>value.replace(/\\text\{([^}]+)\}/g,'$1')), body: content, format: 'markdown',
      source: 'Create Chapter Notes and Graphs · Chapter 7–8 notes',
      figures: figure ? [{src:`sources/microeconomics/figures/${figure[0]}.svg`, alt:figure[1], caption:'Recreated from the chapter relationships · Illustrative schematic, not original slide data'}] : [],
    });
  }
  assert.ok(topics.length > 10);
  return {id, title:match[2], topics};
});

// The original image downloads are unavailable. These schematics use internally
// consistent illustrative functions, rather than guessing the missing slide data.
const target = file('website/sources/microeconomics/figures/');
fs.mkdirSync(target, {recursive:true});
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const navy = '#244b70', teal = '#14786f', orange = '#b65328', purple = '#80549a';
function graph(name, title, xLabel, yLabel, xmax, ymax, curves, extras = '') {
  const X = x => 84 + x / xmax * 610, Y = y => 370 - y / ymax * 258;
  const paths = curves.map(curve => {
    const points = Array.from({length:241}, (_, i) => {
      const x = (curve.start ?? 0) + ((curve.end ?? xmax) - (curve.start ?? 0)) * i / 240;
      return `${i?'L':'M'}${X(x).toFixed(2)},${Y(curve.fn(x)).toFixed(2)}`;
    }).join(' ');
    return `<path d="${points}" stroke="${curve.color}" ${curve.dash?'stroke-dasharray="8 5"':''}/>`;
  }).join('');
  const legend = curves.map((curve, i) => `<g transform="translate(${84+i*155},78)"><path d="M0 0h25" stroke="${curve.color}" ${curve.dash?'stroke-dasharray="6 4"':''}/><text x="33" y="5" fill="#233745" stroke="none">${escape(curve.label)}</text></g>`).join('');
  const annotations = typeof extras === 'function' ? extras(X,Y) : extras;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 480" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title><desc id="desc">${escape(figureTopics[Object.keys(figureTopics).find(k=>figureTopics[k][0]===name)]?.[1] ?? title)} Illustrative schematic; axes have no numerical scale.</desc>
<defs><clipPath id="plot"><rect x="84" y="103" width="611" height="268"/></clipPath></defs>
<rect width="780" height="480" rx="12" fill="#fbfaf7"/>
<g font-family="Arial, sans-serif" fill="#233745" font-size="15"><text x="32" y="36" font-size="22" font-weight="650">${escape(title)}</text>
<g fill="none" stroke-width="3">${legend}</g>
<path d="M84 104v266h620" fill="none" stroke="#607480" stroke-width="1.6"/>
<g clip-path="url(#plot)" fill="none" stroke-width="3">${paths}</g>
<text x="389" y="424" text-anchor="middle">${escape(xLabel)}</text><text x="23" y="237" text-anchor="middle" transform="rotate(-90 23 237)">${escape(yLabel)}</text>
${annotations}<text x="32" y="460" font-size="12" fill="#62747c">Illustrative relationships · Fixed technology and input prices unless indicated</text></g></svg>\n`;
  fs.writeFileSync(new URL(name + '.svg', target), svg);
}
// TP = L + 1.2L² − .06L³: its derivative is MP and TP/L is AP.
const tp = l => l + 1.2*l*l - .06*l*l*l;
graph('ch7-total-product', 'Total product and diminishing marginal returns', 'Labour (L), with capital fixed', 'Total product (TP)', 13, 90,
  [{label:'TP',color:navy,fn:tp}], (X,Y) => `<path d="M${X(6.667)} 370V${Y(tp(6.667))}" stroke="#89979d" stroke-dasharray="5 5"/><text x="${X(6.667)+12}" y="160">MP begins falling</text><text x="${X(6.667)+12}" y="182">TP still rises</text>`);
graph('ch7-ap-mp', 'Marginal product and average product', 'Labour (L), with capital fixed', 'Output per unit of labour', 13, 11,
  [{label:'MP',color:orange,fn:l=>1+2.4*l-.18*l*l},{label:'AP',color:teal,fn:l=>1+1.2*l-.06*l*l}],
  (X,Y) => `<circle cx="${X(10)}" cy="${Y(7)}" r="5" fill="${navy}"/><path d="M${X(10)} ${Y(7)-7}V145" stroke="#89979d"/><text x="${X(10)-205}" y="133">MP = AP at maximum AP</text>`);
// TVC = 20Q − 2Q² + .1Q³, TFC = 40. MC is dTC/dQ.
const avc = q => 20-2*q+.1*q*q, mc = q => 20-4*q+.3*q*q, atc = q => avc(q)+40/q;
graph('ch7-short-run-costs', 'Short-run cost curves', 'Output (Q)', 'Cost per unit', 18, 46,
  [{label:'MC',color:orange,fn:mc,start:.8},{label:'AVC',color:teal,fn:avc,start:.8},{label:'ATC',color:navy,fn:atc,start:.8},{label:'AFC',color:purple,fn:q=>40/q,start:.8}],
  (X,Y) => `<circle cx="${X(10)}" cy="${Y(10)}" r="4" fill="${teal}"/><path d="M${X(10)} ${Y(10)+7}v22" stroke="${teal}"/><text x="${X(10)-60}" y="${Y(10)+46}">min AVC</text><circle cx="${X(11.51)}" cy="${Y(atc(11.51))}" r="4" fill="${navy}"/><path d="M${X(11.51)} ${Y(atc(11.51))-7}v-35" stroke="${navy}"/><text x="${X(11.51)-26}" y="${Y(atc(11.51))-54}">min ATC</text>`);
graph('ch7-variable-cost-shift', 'Higher variable input price (e.g. wage)', 'Output (Q)', 'Cost per unit', 18, 58,
  [{label:'MC',color:orange,fn:mc,start:.8},{label:'MC, higher w',color:orange,fn:q=>1.4*mc(q),start:.8,dash:true},{label:'ATC',color:navy,fn:atc,start:.8},{label:'ATC, higher w',color:navy,fn:q=>1.4*avc(q)+40/q,start:.8,dash:true}],
  () => '<text x="220" y="135">Same technology; variable labour cost increases.</text><text x="220" y="157">Dashed curves: higher wage; fixed cost unchanged.</text>');
const lrac = q => q<6 ? 12+.32*(6-q)**2 : q<=10 ? 12 : 12+.4*(q-10)**2;
graph('ch8-lrac', 'Long-run average cost and minimum efficient scale', 'Output (Q), with all inputs variable', 'Long-run average cost', 17, 38,
  [{label:'LRAC',color:navy,fn:lrac}], (X,Y) => `<path d="M${X(6)} 370V${Y(12)}M${X(10)} 370V${Y(12)}" stroke="#89979d" stroke-dasharray="5 5"/><text x="${X(6)}" y="395" text-anchor="middle">MES</text><text x="110" y="170">Economies</text><text x="110" y="192">of scale</text><text x="305" y="230">Constant returns</text><text x="530" y="170">Diseconomies</text><text x="530" y="192">of scale</text>`);
// Adding a nonnegative quadratic gives each plant a tangent to LRAC from above.
graph('ch8-lrac-sratc', 'LRAC and alternative short-run plant sizes', 'Output (Q)', 'Average cost', 17, 38,
  [{label:'LRAC',color:navy,fn:lrac}, ...[4,8,12].map((q,i)=>({label:`SRATC ${i+1}`,color:[orange,teal,purple][i],fn:x=>lrac(x)+.65*(x-q)**2,start:Math.max(.2,q-5),end:Math.min(17,q+5)}))],
  () => '<text x="210" y="140">At each output: SRATC ≥ LRAC</text><text x="210" y="163">Each plant touches LRAC where it is optimal.</text>');

const chapters = [...context.window.MICRO_CHAPTERS.filter(c => ![7,8].includes(c.id)), ...additions].sort((a,b)=>a.id-b.id);
const supplied = JSON.parse(fs.readFileSync(file('scripts/micro-ch7-8-quiz.json'), 'utf8'));
assert.deepEqual(supplied.map(q=>q.id), [7,8]);
for (const quiz of supplied) {
  assert.equal(quiz.questions.length, 30);
  for (const question of quiz.questions) {
    assert.ok(question.prompt.trim());
    assert.equal(question.options.length, 4);
    assert.ok(question.options.every(option=>option.trim()));
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
  }
}
const quizzes = [...context.window.MICRO_QUIZZES.filter(q=>![7,8].includes(q.id)), ...supplied].sort((a,b)=>a.id-b.id);
fs.writeFileSync(file('website/microeconomics-data.js'), 'window.MICRO_CHAPTERS = '+JSON.stringify(chapters)+';\nwindow.MICRO_QUIZZES = '+JSON.stringify(quizzes)+';\n');
console.log(`Added ${additions.map(c=>`Chapter ${c.id}: ${c.topics.length} topics`).join('; ')} and 6 recreated diagrams.`);
