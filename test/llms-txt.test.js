const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('llms.txt satisfies the Lighthouse agentic browsing content checks', async () => {
  const llmsTxt = await readFile(path.join(__dirname, '..', 'llms.txt'), 'utf8');

  assert.match(llmsTxt, /^\s*#\s+.+/m, 'llms.txt must contain an H1 heading');
  assert.match(llmsTxt, /\[.+\]\(.+\)/, 'llms.txt must contain a Markdown link');
  assert.ok(llmsTxt.length >= 50, 'llms.txt must be at least 50 characters long');
});
