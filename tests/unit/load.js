const path = require('node:path');
for (const f of ['algorithms', 'dp-ml', 'applied']) require(path.join('..', '..', 'js', 'problems', f + '.js'));
const judge = require('../../js/judge.js');
globalThis.CAJudge = judge;
const core = require('../../js/core.js');
const problems = core.buildProblems(globalThis.CA_PROBLEMS_REG);
module.exports = { judge, core, problems };
