"""Import the supplied EC120 quiz PDFs; pass Chapter 7 and Chapter 8 paths in order."""
import json
from pathlib import Path
import re
import sys

from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 3:
    raise SystemExit('Usage: import-micro-ch7-8-quizzes.py CHAPTER_7.pdf CHAPTER_8.pdf')


def compact(text):
    return re.sub(r'\s+', ' ', text).strip()


quizzes = []
for chapter, filename in zip((7, 8), sys.argv[1:]):
    reader = PdfReader(filename)
    pages = [page.extract_text() for page in reader.pages]
    assert 'ANSWER KEY' in pages[-1], 'Expected the answer key on the last page'
    key_pairs = re.findall(r'^(\d{2})\.\s+([ABCD])\s*$', pages[-1], flags=re.M)
    answers = {int(number): 'ABCD'.index(letter) for number, letter in key_pairs}
    assert len(key_pairs) == 30 and set(answers) == set(range(1, 31))
    lines = '\n'.join(pages[1:-1]).splitlines()
    body = '\n'.join(line for line in lines if not re.match(
        r'^(?:EC120\b|30 MULTIPLE-CHOICE|MICROECONOMICS\s+/|PAGE \d+\s*$|PART [ABC] \|)', line))
    entries = re.split(r'^(\d{2})\.\s+', body, flags=re.M)
    questions = []
    for i in range(1, len(entries), 2):
        number = int(entries[i])
        parts = re.split(r'^([ABCD])\)\s+', entries[i + 1], flags=re.M)
        assert parts[1::2] == list('ABCD'), (chapter, number, parts)
        prompt = compact(parts[0])
        # These questions share Q1's table in the PDF. Every bank entry must be
        # solvable on its own because attempts sample and reorder the questions.
        if chapter == 8 and number in (3, 4, 5):
            original = 'Using the production-technique data in Question 1,'
            assert original in prompt
            prompt = prompt.replace(original,
                'Using these techniques for producing 1,000 widgets '
                '(A: 25 labour, 50 capital; B: 35 labour, 35 capital; '
                'C: 50 labour, 25 capital; D: 30 labour, 60 capital),')
        options = [compact(text) for text in parts[2::2]]
        assert '\ufffd' not in prompt + ''.join(options), 'Unrecognized PDF text'
        questions.append({'sourceQuestion': number, 'prompt': prompt,
                          'options': options, 'answer': answers[number]})
    assert [question['sourceQuestion'] for question in questions] == list(range(1, 31))
    quizzes.append({'id': chapter, 'questions': questions,
        'source': f'Questions and answer key from the supplied EC120 Chapter {chapter} Practice Quiz PDF.'
                  + (' Shared production-technique data is repeated where needed so each question stands alone.'
                     if chapter == 8 else '')})

destination = root / 'scripts/micro-ch7-8-quiz.json'
destination.write_text(json.dumps(quizzes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Imported 60 questions and their supplied answers into ' + str(destination.relative_to(root)))
