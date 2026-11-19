import assert from 'node:assert/strict';
import install from '../extensions/index.ts';

let route;
install({ registerVirtualModel(def) {
  assert.equal(`${def.provider}/${def.id}`, 'jev/auto');
  route = def.route;
} });
const a = {provider: 'local', id: 'custom', name: 'Small', input: ['text'], reasoning: false, cost: {input: 0, output: 0}, contextWindow: 8192};
const b = {...a, provider: 'other', name: 'Large', input: ['text', 'image'], reasoning: true};
const virtual = {...b, api: 'pi-virtual', id: 'auto'};
let catalog = [virtual, a, b], calls = 0, chosen = 'm1', level = 'high';
const ctx = {scopedModels: [], modelRegistry: {
  getAvailable: () => catalog,
  findOfType: (...args) => { assert.deepEqual(args, ['classifier', 'typesafe', 'jev-latest']); return {}; },
  classify: async (_, {questions}) => {
    calls++;
    assert.doesNotMatch(JSON.stringify(questions), /other\/auto/);
    const choice = value => ({type: 'choice', choice: value});
    return {stopReason: 'stop', answers: {model: choice(chosen), effort: choice(level)}};
  },
}};
const run = (reason, options = {}) => route({reason, messages: [{role:'user', content:'Test task'}], ...options}, ctx);
const first = await run('user');
assert.deepEqual(first, {model: b, thinkingLevel: 'high'});
assert.deepEqual(await run('continuation', {previous: first}), first);
assert.deepEqual(await run('retry', {failed: first}), first);
assert.equal(calls, 1);
chosen = 'm0';
assert.deepEqual(await run('user', {previous: first}), {model: a, thinkingLevel: 'off'});
assert.equal(calls, 2);
catalog = [a, {...b, id:'new'}];
ctx.scopedModels = [{model: catalog[1]}];
level = 'low';
assert.deepEqual(await run('user'), {model: catalog[1], thinkingLevel: 'low'});
ctx.scopedModels = [{model: virtual}];
await assert.rejects(run('user'), /no eligible/);
ctx.scopedModels = [];
chosen = 'invented';
await assert.rejects(run('user'), /invalid classifier choice/);
console.log('Passed: per-prompt model and effort, sticky turn, dynamic catalog, scope and invalid choices (mock Jev).');
