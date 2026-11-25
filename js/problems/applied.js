/* Code Arsenal problem bank: web, databases, cybersecurity, mobile. */
(function (root) {
  var reg = (root.CA_PROBLEMS_REG = root.CA_PROBLEMS_REG || []);
  reg.push(
    /* ------------------------------- Web development ------------------------------- */
    {
      id: 'parse-query-string', title: 'Parse a Query String', category: 'web-development', difficulty: 'beginner',
      fn: 'parseQuery', params: ['qs'],
      summary: 'Turn a URL query string into an object.',
      statement: [
        'Parse a query string into an object. A leading `?` is ignored. Keys and values are percent-decoded, and `+` means a space.',
        'A key that appears more than once becomes an array of its values, in order. A key with no `=` has the value `""`. Empty segments (like `a=1&&b=2`) are skipped.'
      ],
      examples: [
        { input: 'qs = "a=1&a=2&b=x%20y"', output: '{"a":["1","2"],"b":"x y"}' }
      ],
      constraints: ['All values are strings'],
      hints: [
        'Strip a leading `?`, then split on `&`.',
        'Split each pair on the first `=` only. Replace `+` with a space before decoding.',
        'If the key already exists, turn the stored value into an array (or push onto the existing array).'
      ],
      complexity: 'O(n)',
      editorial: 'Real query strings are messy. Handling repeats, missing "=" and encoding is the difference between a toy parser and a usable one.',
      tests: [
        { args: ['a=1&b=2'], expected: { a: '1', b: '2' } },
        { args: ['a=1&a=2&a=3'], expected: { a: ['1', '2', '3'] } },
        { args: ['name=John%20Doe&x=%26'], expected: { name: 'John Doe', x: '&' } },
        { args: [''], expected: {} },
        { args: ['flag'], expected: { flag: '' } },
        { args: ['?x=1'], expected: { x: '1' }, hidden: true },
        { args: ['q=a+b&&z=1'], expected: { q: 'a b', z: '1' }, hidden: true },
        { args: ['k=a=b'], expected: { k: 'a=b' }, hidden: true }
      ],
      solutions: {
        js: String.raw`function parseQuery(qs) {
  if (qs.startsWith('?')) qs = qs.slice(1);
  const out = {};
  for (const part of qs.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const rawKey = i === -1 ? part : part.slice(0, i);
    const rawVal = i === -1 ? '' : part.slice(i + 1);
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    if (!(key in out)) out[key] = val;
    else if (Array.isArray(out[key])) out[key].push(val);
    else out[key] = [out[key], val];
  }
  return out;
}`,
        py: String.raw`from urllib.parse import unquote

def parse_query(qs):
    if qs.startswith("?"):
        qs = qs[1:]
    out = {}
    for part in qs.split("&"):
        if not part:
            continue
        key, sep, val = part.partition("=")
        key = unquote(key.replace("+", " "))
        val = unquote(val.replace("+", " "))
        if key not in out:
            out[key] = val
        elif isinstance(out[key], list):
            out[key].append(val)
        else:
            out[key] = [out[key], val]
    return out`
      }
    },
    {
      id: 'classnames', title: 'Class Names Builder', category: 'web-development', difficulty: 'beginner',
      fn: 'classNames', params: ['args'],
      summary: 'Join conditional CSS classes the way UI libraries do.',
      statement: [
        'Given a list `args`, build a class string. Include non-empty strings. For an object, include each key whose value is truthy. For an array, apply the same rules recursively.',
        'Ignore everything else (`null`, booleans, numbers). Join the pieces with single spaces.'
      ],
      examples: [
        { input: 'args = ["btn", {"btn-primary": true, "disabled": false}, ["lg"]]', output: '"btn btn-primary lg"' }
      ],
      constraints: ['Nesting depth is at most 5'],
      hints: [
        'Write a helper that handles one value and pushes results onto a shared list.',
        'Use `Array.isArray` before `typeof x === "object"`, because arrays are objects too.',
        'Join the final list with a single space. No leading or trailing spaces.'
      ],
      complexity: 'O(total size)',
      editorial: 'A small recursive walker over strings, objects and arrays is the whole idea behind the popular `classnames` utility.',
      tests: [
        { args: [['a', 'b']], expected: 'a b' },
        { args: [['a', { b: true, c: false }]], expected: 'a b' },
        { args: [['a', ['b', { c: true }]]], expected: 'a b c' },
        { args: [[null, false, 0, '', 5]], expected: '' },
        { args: [[]], expected: '', hidden: true },
        { args: [['btn', { 'btn-primary': 1, disabled: 0 }, ['lg', [['x']]]]], expected: 'btn btn-primary lg x', hidden: true }
      ],
      solutions: {
        js: String.raw`function classNames(args) {
  const out = [];
  (function visit(x) {
    if (typeof x === 'string') { if (x) out.push(x); }
    else if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === 'object') {
      for (const key of Object.keys(x)) if (x[key]) out.push(key);
    }
  })(args);
  return out.join(' ');
}`,
        py: String.raw`def class_names(args):
    out = []

    def visit(x):
        if isinstance(x, str):
            if x:
                out.append(x)
        elif isinstance(x, list):
            for item in x:
                visit(item)
        elif isinstance(x, dict):
            for key, val in x.items():
                if val:
                    out.append(key)

    visit(args)
    return " ".join(out)`
      }
    },
    {
      id: 'flatten-object', title: 'Flatten a Nested Object', category: 'web-development', difficulty: 'intermediate',
      fn: 'flattenObject', params: ['obj'],
      summary: 'Collapse nested objects into dot-separated keys.',
      statement: [
        'Flatten a nested object so each leaf is stored under a dot-joined path. Arrays and `null` are leaves and are kept as they are.',
        'An empty nested object contributes no keys.'
      ],
      examples: [
        { input: 'obj = {"a":{"b":{"c":1}},"d":2}', output: '{"a.b.c":1,"d":2}' }
      ],
      constraints: ['Keys never contain dots'],
      hints: [
        'Recurse with a path prefix.',
        'Treat a value as "nested" only if it is a non-null object and not an array.',
        'When you reach a leaf, store it under `prefix + key` (joined with a dot when the prefix is not empty).'
      ],
      complexity: 'O(total keys)',
      editorial: 'Flattening is the inverse of the path-based access used by form libraries, analytics payloads and config systems.',
      tests: [
        { args: [{ a: { b: { c: 1 } }, d: 2 }], expected: { 'a.b.c': 1, d: 2 } },
        { args: [{}], expected: {} },
        { args: [{ a: {} }], expected: {} },
        { args: [{ a: [1, 2], b: { c: [3] } }], expected: { a: [1, 2], 'b.c': [3] } },
        { args: [{ a: null }], expected: { a: null }, hidden: true },
        { args: [{ x: { y: { z: { w: 'deep' } } }, k: false }], expected: { 'x.y.z.w': 'deep', k: false }, hidden: true }
      ],
      solutions: {
        js: String.raw`function flattenObject(obj) {
  const out = {};
  (function walk(value, prefix) {
    for (const key of Object.keys(value)) {
      const path = prefix ? prefix + '.' + key : key;
      const v = value[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
      else out[path] = v;
    }
  })(obj, '');
  return out;
}`,
        py: String.raw`def flatten_object(obj):
    out = {}

    def walk(value, prefix):
        for key, v in value.items():
            path = prefix + "." + key if prefix else key
            if isinstance(v, dict):
                walk(v, path)
            else:
                out[path] = v

    walk(obj, "")
    return out`
      }
    },
    {
      id: 'render-template', title: 'Safe Template Rendering', category: 'web-development', difficulty: 'intermediate',
      fn: 'renderTemplate', params: ['template', 'data'],
      summary: 'Fill {{placeholders}} and escape HTML so user input cannot inject markup.',
      statement: [
        'Replace each `{{ path }}` in `template` with the value found at that dot path in `data`. Spaces inside the braces are allowed.',
        'Missing values become an empty string. Every inserted value must be HTML-escaped: `&` `<` `>` `"` `\'` become `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`. The literal template text is not escaped.',
        'The number `0` and the boolean `false` are real values and must render as `"0"` and `"false"`.'
      ],
      examples: [
        { input: 'template = "Hi {{ user.name }}!", data = {"user":{"name":"<b>Ada</b>"}}', output: '"Hi &lt;b&gt;Ada&lt;/b&gt;!"' }
      ],
      constraints: ['Placeholders are never nested'],
      hints: [
        'A regular expression like `/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g` finds the placeholders.',
        'Walk the path one key at a time; stop and return `""` as soon as something is `null` or `undefined`.',
        'Escape `&` first so you do not escape the ampersands you just created. Only insert-time values are escaped.'
      ],
      complexity: 'O(template + data lookups)',
      editorial: 'Escaping at the point of insertion is the core defence against reflected and stored XSS in server-side templates.',
      tests: [
        { args: ['Hi {{ user.name }}!', { user: { name: 'Ada' } }], expected: 'Hi Ada!' },
        { args: ['{{a}}', { a: '<b>"x"</b>' }], expected: '&lt;b&gt;&quot;x&quot;&lt;/b&gt;' },
        { args: ['x{{ missing.path }}y', {}], expected: 'xy' },
        { args: ['{{n}} {{f}}', { n: 0, f: false }], expected: '0 false' },
        { args: ['{{a}}{{b}}', { a: '<', b: '\'' }], expected: '&lt;&#39;', hidden: true },
        { args: ['<p>{{ a.b.c }}</p>', { a: { b: { c: 'T&C' } } }], expected: '<p>T&amp;C</p>', hidden: true }
      ],
      solutions: {
        js: String.raw`function renderTemplate(template, data) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    let value = data;
    for (const key of path.split('.')) {
      if (value === null || value === undefined) return '';
      value = value[key];
    }
    return value === null || value === undefined ? '' : esc(value);
  });
}`,
        py: String.raw`import re

def render_template(template, data):
    def esc(s):
        return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                 .replace('"', "&quot;").replace("'", "&#39;"))

    def show(v):
        if v is True:
            return "true"
        if v is False:
            return "false"
        return str(v)

    def sub(m):
        value = data
        for key in m.group(1).split("."):
            if not isinstance(value, dict) or key not in value:
                return ""
            value = value[key]
        if value is None:
            return ""
        return esc(show(value))

    return re.sub(r"\{\{\s*([\w.]+)\s*\}\}", sub, template)`
      }
    },
    {
      id: 'debounce-timeline', title: 'Debounce Timeline', category: 'web-development', difficulty: 'advanced',
      fn: 'debounceTimeline', params: ['callTimes', 'wait'],
      summary: 'Work out when a debounced function actually fires.',
      statement: [
        'A debounced function runs on the trailing edge: it fires `wait` ms after the last call in a burst. A new call that arrives strictly before the timer expires cancels the pending run and restarts the timer.',
        'Given the ascending timestamps `callTimes` (ms) of every call, return the list of timestamps at which the wrapped function actually fires.',
        'A call arriving exactly at `previous + wait` does not cancel the previous timer: the timer fires first.'
      ],
      examples: [
        { input: 'callTimes = [0, 100, 200], wait = 300', output: '[500]' },
        { input: 'callTimes = [0, 100, 400], wait = 300', output: '[400, 700]' }
      ],
      constraints: ['callTimes is sorted ascending'],
      hints: [
        'Each call schedules a run at `t + wait`. Most of those runs get cancelled.',
        'A scheduled run survives only if the next call is not strictly earlier than its fire time.',
        'Look at each call and the one after it. The last call always fires.'
      ],
      complexity: 'O(n)',
      editorial: 'Thinking in timelines makes timer behaviour testable without real clocks, which is how fake timers work in test frameworks.',
      tests: [
        { args: [[0, 100, 200], 300], expected: [500] },
        { args: [[0, 500, 1000], 300], expected: [300, 800, 1300] },
        { args: [[], 100], expected: [] },
        { args: [[0, 100, 400], 300], expected: [400, 700] },
        { args: [[5], 10], expected: [15], hidden: true },
        { args: [[0, 1, 2, 3, 100], 50], expected: [53, 150], hidden: true }
      ],
      solutions: {
        js: String.raw`function debounceTimeline(callTimes, wait) {
  const out = [];
  for (let i = 0; i < callTimes.length; i++) {
    const fireAt = callTimes[i] + wait;
    const next = callTimes[i + 1];
    if (next === undefined || next >= fireAt) out.push(fireAt);
  }
  return out;
}`,
        py: String.raw`def debounce_timeline(call_times, wait):
    out = []
    for i, t in enumerate(call_times):
        fire_at = t + wait
        if i + 1 == len(call_times) or call_times[i + 1] >= fire_at:
            out.append(fire_at)
    return out`
      }
    },

    /* ---------------------------------- Databases ---------------------------------- */
    {
      id: 'nth-highest-salary', title: 'Nth Highest Salary', category: 'databases', difficulty: 'beginner',
      fn: 'nthHighest', params: ['salaries', 'n'],
      summary: 'The SQL classic, without the SQL.',
      statement: [
        'Return the `n`th highest distinct value in `salaries`, or `null` if there are fewer than `n` distinct values.',
        'This mirrors `SELECT DISTINCT salary ... ORDER BY salary DESC LIMIT 1 OFFSET n-1`.'
      ],
      examples: [
        { input: 'salaries = [100, 200, 300], n = 2', output: '200' },
        { input: 'salaries = [100, 100], n = 2', output: 'null' }
      ],
      constraints: ['n >= 1'],
      hints: [
        'Duplicates must count once. Which structure removes them?',
        'Build a set, turn it into an array, sort it descending.',
        'Return element `n - 1`, or `null` when the index is out of range.'
      ],
      complexity: 'O(n log n)',
      editorial: 'DISTINCT then ORDER BY then OFFSET is the same pipeline in any language: dedupe, sort, index.',
      tests: [
        { args: [[100, 200, 300], 2], expected: 200 },
        { args: [[100, 100], 2], expected: null },
        { args: [[5, 5, 4, 3], 2], expected: 4 },
        { args: [[], 1], expected: null },
        { args: [[1, 2, 3, 4], 4], expected: 1, hidden: true }
      ],
      solutions: {
        js: String.raw`function nthHighest(salaries, n) {
  const distinct = [...new Set(salaries)].sort((a, b) => b - a);
  return n - 1 < distinct.length ? distinct[n - 1] : null;
}`,
        py: String.raw`def nth_highest(salaries, n):
    distinct = sorted(set(salaries), reverse=True)
    return distinct[n - 1] if n - 1 < len(distinct) else None`
      }
    },
    {
      id: 'find-duplicate-emails', title: 'Find Duplicate Emails', category: 'databases', difficulty: 'beginner',
      fn: 'findDuplicateEmails', params: ['emails'],
      summary: 'GROUP BY ... HAVING COUNT(*) > 1.',
      statement: [
        'Emails are case-insensitive. Return the lowercase addresses that appear more than once, sorted alphabetically, each listed once.'
      ],
      examples: [
        { input: 'emails = ["a@x.com","b@x.com","A@x.com"]', output: '["a@x.com"]' }
      ],
      constraints: ['0 <= emails.length <= 10^4'],
      hints: [
        'Normalise first: lowercase every address.',
        'Count occurrences in a map.',
        'Keep the keys whose count is greater than 1, then sort them.'
      ],
      complexity: 'O(n log n)',
      editorial: 'Normalise before grouping. Most "duplicate" bugs in real data are casing and whitespace differences.',
      tests: [
        { args: [['a@x.com', 'b@x.com', 'A@x.com']], expected: ['a@x.com'] },
        { args: [[]], expected: [] },
        { args: [['x', 'y']], expected: [] },
        { args: [['m', 'M', 'm', 'n', 'N']], expected: ['m', 'n'] },
        { args: [['z@z.io', 'z@z.io', 'z@z.io']], expected: ['z@z.io'], hidden: true }
      ],
      solutions: {
        js: String.raw`function findDuplicateEmails(emails) {
  const counts = new Map();
  for (const e of emails) {
    const k = e.toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].filter(([, c]) => c > 1).map(([k]) => k).sort();
}`,
        py: String.raw`from collections import Counter

def find_duplicate_emails(emails):
    counts = Counter(e.lower() for e in emails)
    return sorted(k for k, c in counts.items() if c > 1)`
      }
    },
    {
      id: 'group-by-aggregate', title: 'Group By and Aggregate', category: 'databases', difficulty: 'intermediate',
      fn: 'groupAggregate', params: ['rows', 'groupKey', 'valueKey'],
      summary: 'COUNT, SUM and AVG per group.',
      statement: [
        'Group `rows` (an array of objects) by the field named `groupKey`. For each group return `{ key, count, sum, avg }`, where `sum` and `avg` are over the field named `valueKey`.',
        'Return the groups sorted by `key` ascending (string comparison). `avg` is the exact mean with no rounding.'
      ],
      examples: [
        { input: 'rows = [{dept:"eng",pay:100},{dept:"ops",pay:50},{dept:"eng",pay:200}], groupKey = "dept", valueKey = "pay"', output: '[{key:"eng",count:2,sum:300,avg:150},{key:"ops",count:1,sum:50,avg:50}]' }
      ],
      constraints: ['Every row has both fields'],
      hints: [
        'Use one map from group key to a running `{ count, sum }`.',
        'Compute `avg = sum / count` after all rows are folded in.',
        'Sort the final list with a comparator on `key`.'
      ],
      complexity: 'O(n + g log g)',
      editorial: 'This is the in-memory equivalent of a hash aggregate, the strategy most SQL engines use for GROUP BY.',
      tests: [
        { args: [[{ dept: 'eng', pay: 100 }, { dept: 'ops', pay: 50 }, { dept: 'eng', pay: 200 }], 'dept', 'pay'], expected: [{ key: 'eng', count: 2, sum: 300, avg: 150 }, { key: 'ops', count: 1, sum: 50, avg: 50 }] },
        { args: [[], 'a', 'b'], expected: [] },
        { args: [[{ c: 'x', v: 1 }, { c: 'x', v: 2 }, { c: 'x', v: 4 }], 'c', 'v'], expected: [{ key: 'x', count: 3, sum: 7, avg: 2.3333333333333335 }] },
        { args: [[{ t: 'b', n: 5 }, { t: 'a', n: -5 }], 't', 'n'], expected: [{ key: 'a', count: 1, sum: -5, avg: -5 }, { key: 'b', count: 1, sum: 5, avg: 5 }], hidden: true }
      ],
      solutions: {
        js: String.raw`function groupAggregate(rows, groupKey, valueKey) {
  const groups = new Map();
  for (const row of rows) {
    const g = groups.get(row[groupKey]) || { count: 0, sum: 0 };
    g.count++;
    g.sum += row[valueKey];
    groups.set(row[groupKey], g);
  }
  return [...groups]
    .map(([key, g]) => ({ key, count: g.count, sum: g.sum, avg: g.sum / g.count }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}`,
        py: String.raw`def group_aggregate(rows, group_key, value_key):
    groups = {}
    for row in rows:
        g = groups.setdefault(row[group_key], {"count": 0, "sum": 0})
        g["count"] += 1
        g["sum"] += row[value_key]
    return [
        {"key": k, "count": g["count"], "sum": g["sum"], "avg": g["sum"] / g["count"]}
        for k, g in sorted(groups.items(), key=lambda kv: kv[0])
    ]`
      }
    },
    {
      id: 'inner-join', title: 'Inner Join', category: 'databases', difficulty: 'intermediate',
      fn: 'innerJoin', params: ['left', 'right', 'key'],
      summary: 'Combine two tables on a shared column.',
      statement: [
        'Implement an inner join of two arrays of row objects on the column named `key`. For each left row, in order, emit one merged row for every matching right row, in the right table\'s order.',
        'Merge by copying the left row\'s fields and then the right row\'s fields. Rows with no match are dropped.'
      ],
      examples: [
        { input: 'left = [{id:1,name:"A"},{id:2,name:"B"}], right = [{id:1,city:"X"},{id:1,city:"Y"},{id:3,city:"Z"}], key = "id"', output: '[{id:1,name:"A",city:"X"},{id:1,name:"A",city:"Y"}]' }
      ],
      constraints: ['Join keys are strings or numbers'],
      hints: [
        'A nested loop is correct but O(n × m). A hash join is O(n + m).',
        'Index the right table: key value → list of rows, preserving order.',
        'For each left row, look up its key in the index and emit `{ ...l, ...r }` for each match.'
      ],
      complexity: 'O(n + m + output)',
      editorial: 'A hash join builds an index on the smaller side and probes it with the other, the default strategy for equality joins.',
      tests: [
        { args: [[{ id: 1, name: 'A' }, { id: 2, name: 'B' }], [{ id: 1, city: 'X' }, { id: 1, city: 'Y' }, { id: 3, city: 'Z' }], 'id'], expected: [{ id: 1, name: 'A', city: 'X' }, { id: 1, name: 'A', city: 'Y' }] },
        { args: [[], [{ id: 1 }], 'id'], expected: [] },
        { args: [[{ k: 'a', v: 1 }], [{ k: 'b', w: 2 }], 'k'], expected: [] },
        { args: [[{ id: 2, n: 'two' }, { id: 1, n: 'one' }], [{ id: 1, z: true }, { id: 2, z: false }], 'id'], expected: [{ id: 2, n: 'two', z: false }, { id: 1, n: 'one', z: true }], hidden: true }
      ],
      solutions: {
        js: String.raw`function innerJoin(left, right, key) {
  const index = new Map();
  for (const r of right) {
    if (!index.has(r[key])) index.set(r[key], []);
    index.get(r[key]).push(r);
  }
  const out = [];
  for (const l of left) {
    for (const r of index.get(l[key]) || []) out.push({ ...l, ...r });
  }
  return out;
}`,
        py: String.raw`def inner_join(left, right, key):
    index = {}
    for r in right:
        index.setdefault(r[key], []).append(r)
    out = []
    for l in left:
        for r in index.get(l[key], []):
            out.append({**l, **r})
    return out`
      }
    },
    {
      id: 'running-balance', title: 'Running Balance per Account', category: 'databases', difficulty: 'advanced',
      fn: 'runningBalance', params: ['rows'],
      summary: 'A window function: SUM(...) OVER (PARTITION BY account ORDER BY day).',
      statement: [
        'Each row is `{ account, day, amount }`. Return every row with an added `balance` field: the sum of `amount` for that account up to and including that row, ordered by `day`.',
        'The result must be sorted by `account` ascending (string order), then `day` ascending.'
      ],
      examples: [
        { input: 'rows = [{account:"a",day:1,amount:10},{account:"a",day:3,amount:5}]', output: '[{account:"a",day:1,amount:10,balance:10},{account:"a",day:3,amount:5,balance:15}]' }
      ],
      constraints: ['An account never has two rows on the same day'],
      hints: [
        'Sort first by account, then by day. Then every account is a contiguous run.',
        'Keep a running total that you reset whenever the account changes.',
        'Do not mutate the input rows; build new objects with `{ ...row, balance }`.'
      ],
      complexity: 'O(n log n)',
      editorial: 'Window functions are partitioned, ordered scans. Sorting once makes the partition boundaries trivial to detect.',
      tests: [
        { args: [[{ account: 'b', day: 2, amount: -5 }, { account: 'a', day: 1, amount: 10 }, { account: 'a', day: 3, amount: 5 }, { account: 'b', day: 1, amount: 20 }]], expected: [{ account: 'a', day: 1, amount: 10, balance: 10 }, { account: 'a', day: 3, amount: 5, balance: 15 }, { account: 'b', day: 1, amount: 20, balance: 20 }, { account: 'b', day: 2, amount: -5, balance: 15 }] },
        { args: [[]], expected: [] },
        { args: [[{ account: 'z', day: 1, amount: 7 }]], expected: [{ account: 'z', day: 1, amount: 7, balance: 7 }] },
        { args: [[{ account: 'a', day: 2, amount: -3 }, { account: 'a', day: 1, amount: -1 }]], expected: [{ account: 'a', day: 1, amount: -1, balance: -1 }, { account: 'a', day: 2, amount: -3, balance: -4 }], hidden: true }
      ],
      solutions: {
        js: String.raw`function runningBalance(rows) {
  const sorted = [...rows].sort((a, b) =>
    a.account < b.account ? -1 : a.account > b.account ? 1 : a.day - b.day);
  let current = null, total = 0;
  return sorted.map((row) => {
    if (row.account !== current) { current = row.account; total = 0; }
    total += row.amount;
    return { ...row, balance: total };
  });
}`,
        py: String.raw`def running_balance(rows):
    out = []
    current, total = None, 0
    for row in sorted(rows, key=lambda r: (r["account"], r["day"])):
        if row["account"] != current:
            current, total = row["account"], 0
        total += row["amount"]
        out.append({**row, "balance": total})
    return out`
      }
    },

    /* ------------------------------- Cybersecurity ------------------------------- */
    {
      id: 'caesar-cipher', title: 'Caesar Cipher', category: 'cybersecurity', difficulty: 'beginner',
      fn: 'caesar', params: ['text', 'shift'],
      summary: 'The simplest substitution cipher, and why it is not secure.',
      statement: [
        'Shift every letter of `text` by `shift` positions in the alphabet, wrapping around. Preserve case. Leave non-letters unchanged.',
        '`shift` may be negative or larger than 26; negative shifts decrypt.'
      ],
      examples: [
        { input: 'text = "Hello, World!", shift = 13', output: '"Uryyb, Jbeyq!"' }
      ],
      constraints: ['ASCII input'],
      hints: [
        'Work out the letter\'s position `0..25` from its code, shift it, and convert back.',
        'Normalise the shift with `((shift % 26) + 26) % 26` so negatives wrap correctly.',
        'Handle uppercase and lowercase with different base codes (65 and 97).'
      ],
      complexity: 'O(n)',
      editorial: 'With only 25 useful keys, a Caesar cipher falls to brute force instantly. It teaches modular arithmetic, not security.',
      tests: [
        { args: ['abc', 1], expected: 'bcd' },
        { args: ['xyz', 3], expected: 'abc' },
        { args: ['Hello, World!', 13], expected: 'Uryyb, Jbeyq!' },
        { args: ['abc', -1], expected: 'zab' },
        { args: ['Abc', 52], expected: 'Abc' },
        { args: ['Zz', -27], expected: 'Yy', hidden: true },
        { args: ['', 5], expected: '', hidden: true }
      ],
      solutions: {
        js: String.raw`function caesar(text, shift) {
  const k = ((shift % 26) + 26) % 26;
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) out += String.fromCharCode(((code - 65 + k) % 26) + 65);
    else if (code >= 97 && code <= 122) out += String.fromCharCode(((code - 97 + k) % 26) + 97);
    else out += ch;
  }
  return out;
}`,
        py: String.raw`def caesar(text, shift):
    k = shift % 26
    out = []
    for ch in text:
        if "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 + k) % 26 + 65))
        elif "a" <= ch <= "z":
            out.append(chr((ord(ch) - 97 + k) % 26 + 97))
        else:
            out.append(ch)
    return "".join(out)`
      }
    },
    {
      id: 'escape-html', title: 'Escape HTML', category: 'cybersecurity', difficulty: 'beginner',
      fn: 'escapeHtml', params: ['input'],
      summary: 'The one-function defence against reflected XSS.',
      statement: [
        'Return `input` with these characters replaced: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `\'` → `&#39;`.',
        'Order matters: replace `&` first, or you will double-escape the entities you just inserted.'
      ],
      examples: [
        { input: 'input = "<script>alert(1)</script>"', output: '"&lt;script&gt;alert(1)&lt;/script&gt;"' }
      ],
      constraints: ['Any string'],
      hints: [
        'Five characters are dangerous in HTML text and attribute contexts.',
        'A lookup table plus a single regex replacement avoids the ordering problem completely.',
        'If you chain `.replace` calls, make `&` the first one.'
      ],
      complexity: 'O(n)',
      editorial: 'Output encoding, not input filtering, is what stops XSS. Encode for the context the data lands in.',
      tests: [
        { args: ['<a href="x">T&C\'s</a>'], expected: '&lt;a href=&quot;x&quot;&gt;T&amp;C&#39;s&lt;/a&gt;' },
        { args: [''], expected: '' },
        { args: ['plain'], expected: 'plain' },
        { args: ['&amp;'], expected: '&amp;amp;' },
        { args: ['<script>alert(1)</script>'], expected: '&lt;script&gt;alert(1)&lt;/script&gt;', hidden: true },
        { args: ['"\'"'], expected: '&quot;&#39;&quot;', hidden: true }
      ],
      solutions: {
        js: String.raw`function escapeHtml(input) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return input.replace(/[&<>"']/g, (c) => map[c]);
}`,
        py: String.raw`def escape_html(input):
    table = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}
    return "".join(table.get(c, c) for c in input)`
      }
    },
    {
      id: 'password-strength', title: 'Password Strength Rating', category: 'cybersecurity', difficulty: 'intermediate',
      fn: 'passwordStrength', params: ['password'],
      summary: 'Score a password against a clear rubric.',
      statement: [
        'Score a password by awarding one point for each rule it meets: length >= 8, length >= 12, contains a lowercase letter, contains an uppercase letter, contains a digit, contains a symbol (any character that is not a letter or digit).',
        'Return `"weak"` for 0 to 2 points, `"medium"` for 3 or 4, and `"strong"` for 5 or 6.'
      ],
      examples: [
        { input: 'password = "Password1!"', output: '"strong"', note: 'length >= 8, lower, upper, digit, symbol = 5 points' }
      ],
      constraints: ['ASCII input'],
      hints: [
        'Each rule is an independent boolean. Sum them.',
        'Regular expressions such as `/[a-z]/`, `/[A-Z]/`, `/\\d/` and `/[^A-Za-z0-9]/` cover the character classes.',
        'Length counts twice: once at 8 and again at 12.'
      ],
      complexity: 'O(n)',
      editorial: 'Length contributes more entropy than complexity rules. Real policies favour long passphrases and breach-list checks.',
      tests: [
        { args: ['abc'], expected: 'weak' },
        { args: ['password'], expected: 'weak' },
        { args: ['Password1'], expected: 'medium' },
        { args: ['Password1!'], expected: 'strong' },
        { args: ['correct horse battery staple'], expected: 'medium' },
        { args: ['Tr0ub4dor&3'], expected: 'strong', hidden: true },
        { args: [''], expected: 'weak', hidden: true },
        { args: ['ABCDEFGHIJKL'], expected: 'medium', hidden: true }
      ],
      solutions: {
        js: String.raw`function passwordStrength(password) {
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  return score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
}`,
        py: String.raw`import re

def password_strength(password):
    score = sum([
        len(password) >= 8,
        len(password) >= 12,
        bool(re.search(r"[a-z]", password)),
        bool(re.search(r"[A-Z]", password)),
        bool(re.search(r"[0-9]", password)),
        bool(re.search(r"[^A-Za-z0-9]", password)),
    ])
    if score <= 2:
        return "weak"
    return "medium" if score <= 4 else "strong"`
      }
    },
    {
      id: 'hash-djb2', title: 'DJB2 Hash', category: 'cybersecurity', difficulty: 'intermediate',
      fn: 'djb2', params: ['text'],
      summary: 'A tiny non-cryptographic hash and its 32-bit arithmetic.',
      statement: [
        'Implement the DJB2 hash over the UTF-16 code units of `text`: start with `hash = 5381`, then for each character `hash = hash * 33 + code`, keeping the result as an unsigned 32-bit integer after every step.',
        'Return the final value as a non-negative integer.'
      ],
      examples: [
        { input: 'text = "abc"', output: '193485963' }
      ],
      constraints: ['ASCII input'],
      hints: [
        'The value must wrap at 2³². JavaScript numbers are doubles, so wrap explicitly.',
        '`hash * 33` stays below 2⁴⁰, which a double represents exactly. Use `% 4294967296` after adding the code.',
        'In Python, apply `& 0xFFFFFFFF` after each step.'
      ],
      complexity: 'O(n)',
      editorial: 'DJB2 is fast and well distributed for hash tables, but it is not collision-resistant and must never be used for security.',
      tests: [
        { args: [''], expected: 5381 },
        { args: ['a'], expected: 177670 },
        { args: ['abc'], expected: 193485963 },
        { args: ['hello'], expected: 261238937 },
        { args: ['The quick brown fox jumps over the lazy dog'], expected: 885799134, hidden: true },
        { args: ['zzzzzzzzzzzzzzzzzzzz'], expected: 449770637, hidden: true }
      ],
      solutions: {
        js: String.raw`function djb2(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33 + text.charCodeAt(i)) % 4294967296;
  }
  return hash;
}`,
        py: String.raw`def djb2(text):
    h = 5381
    for ch in text:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h`
      }
    },
    {
      id: 'decode-jwt-payload', title: 'Decode a JWT Payload', category: 'cybersecurity', difficulty: 'advanced',
      fn: 'decodeJwtPayload', params: ['token'],
      summary: 'Read the claims in a token, and why that proves nothing about trust.',
      statement: [
        'A JWT has three dot-separated parts: `header.payload.signature`. The payload is base64url-encoded JSON.',
        'Return the decoded payload object. Return `null` if the token does not have exactly three parts, the payload is not valid base64url, or it is not valid JSON that decodes to an object.',
        'You are only decoding. Never treat a decoded token as verified: the signature has not been checked.'
      ],
      examples: [
        { input: 'token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1LTQyIiwiZXhwIjoxOTAwMDAwMDAwfQ.sig"', output: '{"sub":"u-42","exp":1900000000}' }
      ],
      constraints: ['Base64url uses - and _ instead of + and /, and omits = padding'],
      hints: [
        'Split on `.` and check that you got three parts.',
        'Convert base64url to base64: replace `-` with `+`, `_` with `/`, then pad with `=` to a multiple of 4.',
        'Decode, then `JSON.parse` inside a try/catch. Return `null` on any failure or when the result is not a plain object.'
      ],
      complexity: 'O(n)',
      editorial: 'Anyone can read a JWT payload. Security comes from verifying the signature server-side with the right key and algorithm.',
      tests: [
        { args: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImFkbWluIjp0cnVlfQ.sig'], expected: { sub: '1234567890', name: 'Ada Lovelace', admin: true } },
        { args: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1LTQyIiwiZXhwIjoxOTAwMDAwMDAwfQ.sig'], expected: { sub: 'u-42', exp: 1900000000 } },
        { args: ['only.two'], expected: null },
        { args: ['a.bm90IGpzb24.c'], expected: null },
        { args: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtc2ciOiJoXHUwMGU5bGxvPz4-In0.sig'], expected: { msg: 'héllo?>>' }, hidden: true },
        { args: ['a.b.c.d'], expected: null, hidden: true },
        { args: [''], expected: null, hidden: true }
      ],
      solutions: {
        js: String.raw`function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (e) {
    return null;
  }
}`,
        py: String.raw`import base64
import json

def decode_jwt_payload(token):
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        b64 = parts[1].replace("-", "+").replace("_", "/")
        b64 += "=" * (-len(b64) % 4)
        value = json.loads(base64.b64decode(b64, validate=True).decode("utf-8"))
        return value if isinstance(value, dict) else None
    except Exception:
        return None`
      }
    },

    /* -------------------------------- Mobile development -------------------------------- */
    {
      id: 'paginate', title: 'Paginate a List', category: 'mobile-development', difficulty: 'beginner',
      fn: 'paginate', params: ['items', 'page', 'pageSize'],
      summary: 'Page-based list loading, as in infinite scroll.',
      statement: [
        'Return `{ items, page, totalPages, hasNext }` for the 1-indexed `page` of `items` with `pageSize` items per page.',
        'A page below 1 is treated as page 1. A page beyond the last returns an empty `items` array but keeps the requested `page`. An empty list has `totalPages` 0.'
      ],
      examples: [
        { input: 'items = [1..10], page = 2, pageSize = 3', output: '{items:[4,5,6], page:2, totalPages:4, hasNext:true}' }
      ],
      constraints: ['pageSize >= 1'],
      hints: [
        '`totalPages = Math.ceil(items.length / pageSize)`.',
        'Clamp the page first: `Math.max(1, page)`.',
        '`hasNext` is true when the current page is less than `totalPages`. Slice from `(page - 1) * pageSize`.'
      ],
      complexity: 'O(pageSize)',
      editorial: 'Most pagination bugs come from boundary pages. Pinning down page 0, the last page and past-the-end first prevents them.',
      tests: [
        { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2, 3], expected: { items: [4, 5, 6], page: 2, totalPages: 4, hasNext: true } },
        { args: [[1, 2, 3], 1, 5], expected: { items: [1, 2, 3], page: 1, totalPages: 1, hasNext: false } },
        { args: [[], 1, 10], expected: { items: [], page: 1, totalPages: 0, hasNext: false } },
        { args: [[1, 2, 3, 4], 3, 2], expected: { items: [], page: 3, totalPages: 2, hasNext: false } },
        { args: [[1, 2, 3], 0, 2], expected: { items: [1, 2], page: 1, totalPages: 2, hasNext: true }, hidden: true },
        { args: [[1, 2, 3, 4], 2, 2], expected: { items: [3, 4], page: 2, totalPages: 2, hasNext: false }, hidden: true }
      ],
      solutions: {
        js: String.raw`function paginate(items, page, pageSize) {
  const p = Math.max(1, page);
  const totalPages = Math.ceil(items.length / pageSize);
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: p, totalPages, hasNext: p < totalPages };
}`,
        py: String.raw`import math

def paginate(items, page, page_size):
    p = max(1, page)
    total_pages = math.ceil(len(items) / page_size)
    start = (p - 1) * page_size
    return {"items": items[start:start + page_size], "page": p, "totalPages": total_pages, "hasNext": p < total_pages}`
      }
    },
    {
      id: 'retry-backoff', title: 'Retry Backoff Schedule', category: 'mobile-development', difficulty: 'beginner',
      fn: 'backoffSchedule', params: ['baseMs', 'factor', 'maxMs', 'attempts'],
      summary: 'How long a flaky network call should wait between retries.',
      statement: [
        'Return the list of delays (in ms) for exponential backoff. The delay before retry `i` (starting at 0) is `baseMs * factor^i`, never more than `maxMs`.',
        'Return exactly `attempts` delays. `attempts = 0` returns an empty list.'
      ],
      examples: [
        { input: 'baseMs = 100, factor = 2, maxMs = 1000, attempts = 5', output: '[100, 200, 400, 800, 1000]' }
      ],
      constraints: ['All numbers are non-negative integers'],
      hints: [
        'Loop `i` from 0 to `attempts - 1`.',
        'Compute `baseMs * factor ** i`.',
        'Clamp with `Math.min(maxMs, ...)`.'
      ],
      complexity: 'O(attempts)',
      editorial: 'Capped exponential backoff protects servers from retry storms. Production code adds random jitter on top of this schedule.',
      tests: [
        { args: [100, 2, 1000, 5], expected: [100, 200, 400, 800, 1000] },
        { args: [500, 3, 100000, 3], expected: [500, 1500, 4500] },
        { args: [1, 1, 10, 3], expected: [1, 1, 1] },
        { args: [10, 2, 100, 0], expected: [] },
        { args: [1000, 2, 5000, 4], expected: [1000, 2000, 4000, 5000], hidden: true }
      ],
      solutions: {
        js: String.raw`function backoffSchedule(baseMs, factor, maxMs, attempts) {
  const out = [];
  for (let i = 0; i < attempts; i++) out.push(Math.min(maxMs, baseMs * factor ** i));
  return out;
}`,
        py: String.raw`def backoff_schedule(base_ms, factor, max_ms, attempts):
    return [min(max_ms, base_ms * factor ** i) for i in range(attempts)]`
      }
    },
    {
      id: 'cart-reducer', title: 'Cart Reducer', category: 'mobile-development', difficulty: 'intermediate',
      fn: 'cartReducer', params: ['actions'],
      summary: 'Predictable state updates, the pattern behind Redux and most app stores.',
      statement: [
        'Start with an empty cart and apply `actions` in order. Return `{ items, total }`, where `items` maps an id to `{ qty, price }` and `total` is the sum of `qty * price`.',
        'Actions: `{type:"add", id, price, qty?}` adds `qty` (default 1) and records the latest price. `{type:"remove", id}` deletes the item. `{type:"setQty", id, qty}` sets the quantity, removing the item if `qty <= 0`, and is ignored for unknown ids.'
      ],
      examples: [
        { input: 'actions = [{type:"add",id:"a",price:10},{type:"add",id:"a",price:10}]', output: '{items:{a:{qty:2,price:10}}, total:20}' }
      ],
      constraints: ['Totals are compared with a tolerance of 1e-6'],
      hints: [
        'A reducer is a pure function: `(state, action) => newState`. Start from `{ items: {} }`.',
        'Compute `total` once at the end from `items` rather than updating it in every branch.',
        'In `add`, read the existing quantity (or 0) and add `qty ?? 1`.'
      ],
      complexity: 'O(actions + items)',
      editorial: 'Deriving totals from the item map avoids drift between two sources of truth.',
      tests: [
        { args: [[{ type: 'add', id: 'a', price: 10 }, { type: 'add', id: 'a', price: 10 }, { type: 'add', id: 'b', price: 5, qty: 3 }, { type: 'remove', id: 'b' }]], expected: { items: { a: { qty: 2, price: 10 } }, total: 20 } },
        { args: [[]], expected: { items: {}, total: 0 } },
        { args: [[{ type: 'add', id: 'x', price: 2.5, qty: 4 }, { type: 'setQty', id: 'x', qty: 2 }]], expected: { items: { x: { qty: 2, price: 2.5 } }, total: 5 } },
        { args: [[{ type: 'add', id: 'x', price: 1 }, { type: 'setQty', id: 'x', qty: 0 }]], expected: { items: {}, total: 0 }, hidden: true },
        { args: [[{ type: 'setQty', id: 'ghost', qty: 3 }, { type: 'add', id: 'p', price: 9.99, qty: 3 }, { type: 'add', id: 'p', price: 8.5 }]], expected: { items: { p: { qty: 4, price: 8.5 } }, total: 34 }, hidden: true }
      ],
      solutions: {
        js: String.raw`function cartReducer(actions) {
  const items = {};
  for (const a of actions) {
    if (a.type === 'add') {
      const prev = items[a.id] ? items[a.id].qty : 0;
      items[a.id] = { qty: prev + (a.qty === undefined || a.qty === null ? 1 : a.qty), price: a.price };
    } else if (a.type === 'remove') {
      delete items[a.id];
    } else if (a.type === 'setQty' && items[a.id]) {
      if (a.qty <= 0) delete items[a.id];
      else items[a.id] = { qty: a.qty, price: items[a.id].price };
    }
  }
  const total = Object.values(items).reduce((s, it) => s + it.qty * it.price, 0);
  return { items, total };
}`,
        py: String.raw`def cart_reducer(actions):
    items = {}
    for a in actions:
        t = a["type"]
        if t == "add":
            prev = items[a["id"]]["qty"] if a["id"] in items else 0
            qty = a.get("qty")
            items[a["id"]] = {"qty": prev + (1 if qty is None else qty), "price": a["price"]}
        elif t == "remove":
            items.pop(a["id"], None)
        elif t == "setQty" and a["id"] in items:
            if a["qty"] <= 0:
                del items[a["id"]]
            else:
                items[a["id"]] = {"qty": a["qty"], "price": items[a["id"]]["price"]}
    total = sum(it["qty"] * it["price"] for it in items.values())
    return {"items": items, "total": total}`
      }
    },
    {
      id: 'semver-compare', title: 'Compare App Versions', category: 'mobile-development', difficulty: 'intermediate',
      fn: 'compareVersions', params: ['a', 'b'],
      summary: 'Decide whether an installed app needs a forced update.',
      statement: [
        'Compare two dotted version strings such as `"1.10.0"` and `"1.2"`. Return `-1` if `a < b`, `1` if `a > b`, and `0` if they are equal.',
        'Compare each part as a number, left to right. A missing part counts as 0, so `"1.0"` equals `"1.0.0"`.'
      ],
      examples: [
        { input: 'a = "1.2.3", b = "1.10.0"', output: '-1', note: '2 < 10 numerically, even though "2" > "10" as text.' }
      ],
      constraints: ['Only digits and dots; no pre-release tags'],
      hints: [
        'Comparing the strings directly gives the wrong answer for "1.2" vs "1.10".',
        'Split both on `.` and convert each part to a number.',
        'Loop to the longer length, treating missing parts as 0, and return at the first difference.'
      ],
      complexity: 'O(parts)',
      editorial: 'Version strings are tuples of integers, not text. This logic gates force-update screens in mobile apps.',
      tests: [
        { args: ['1.0.0', '1.0.0'], expected: 0 },
        { args: ['1.2.3', '1.10.0'], expected: -1 },
        { args: ['2.0', '1.9.9'], expected: 1 },
        { args: ['1.0', '1.0.0'], expected: 0 },
        { args: ['0.0.1', '0.0.0'], expected: 1, hidden: true },
        { args: ['10.0.0', '9.99.99'], expected: 1, hidden: true }
      ],
      solutions: {
        js: String.raw`function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const p = x[i] || 0, q = y[i] || 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}`,
        py: String.raw`def compare_versions(a, b):
    x = [int(p) for p in a.split(".")]
    y = [int(p) for p in b.split(".")]
    for i in range(max(len(x), len(y))):
        p = x[i] if i < len(x) else 0
        q = y[i] if i < len(y) else 0
        if p != q:
            return -1 if p < q else 1
    return 0`
      }
    },
    {
      id: 'last-writer-wins-merge', title: 'Offline Sync: Last Writer Wins', category: 'mobile-development', difficulty: 'advanced',
      fn: 'mergeRecords', params: ['local', 'remote'],
      summary: 'Reconcile edits made offline with the server copy.',
      statement: [
        'A record maps field names to `{ value, ts }`. Merge `local` and `remote` into one record containing every field from either side. For each field present on both, keep the entry with the larger `ts`.',
        'On equal timestamps the remote entry wins. Do not mutate the inputs.'
      ],
      examples: [
        { input: 'local = {name:{value:"A",ts:5}}, remote = {name:{value:"B",ts:7}}', output: '{name:{value:"B",ts:7}}' }
      ],
      constraints: ['Timestamps are integers'],
      hints: [
        'Start from a copy of the remote record, then consider each local field.',
        'Include a local field when the remote lacks it, or when its `ts` is strictly greater.',
        'The tie rule falls out naturally if you only override on strictly greater.'
      ],
      complexity: 'O(fields)',
      editorial: 'Per-field last-writer-wins is the simplest convergent merge. It is the baseline that more advanced CRDTs improve on.',
      tests: [
        { args: [{ name: { value: 'A', ts: 5 }, age: { value: 30, ts: 9 } }, { name: { value: 'B', ts: 7 }, city: { value: 'X', ts: 1 } }], expected: { name: { value: 'B', ts: 7 }, age: { value: 30, ts: 9 }, city: { value: 'X', ts: 1 } } },
        { args: [{ a: { value: 1, ts: 3 } }, { a: { value: 2, ts: 3 } }], expected: { a: { value: 2, ts: 3 } } },
        { args: [{}, {}], expected: {} },
        { args: [{ a: { value: 'new', ts: 10 } }, { a: { value: 'old', ts: 2 } }], expected: { a: { value: 'new', ts: 10 } }, hidden: true },
        { args: [{ x: { value: null, ts: 4 } }, {}], expected: { x: { value: null, ts: 4 } }, hidden: true }
      ],
      solutions: {
        js: String.raw`function mergeRecords(local, remote) {
  const out = {};
  for (const k of Object.keys(remote)) out[k] = { ...remote[k] };
  for (const k of Object.keys(local)) {
    if (!(k in out) || local[k].ts > out[k].ts) out[k] = { ...local[k] };
  }
  return out;
}`,
        py: String.raw`def merge_records(local, remote):
    out = {k: dict(v) for k, v in remote.items()}
    for k, v in local.items():
        if k not in out or v["ts"] > out[k]["ts"]:
            out[k] = dict(v)
    return out`
      }
    }
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);
