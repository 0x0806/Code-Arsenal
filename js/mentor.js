/*
 * Code Arsenal mentor: an offline, rule-based tutor. It is not an AI model and says so.
 * Pure logic, no DOM, no network. Output uses CACore.fmt markup (**bold**, `code`) as plain text.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CAMentor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MAX_MESSAGE = 2000, MAX_CODE = 50000, MAX_FINDINGS = 8, LONG_LINE = 120;
  var CATEGORY_NAMES = {
    'algorithms': 'Algorithms', 'data-structures': 'Data Structures', 'dynamic-programming': 'Dynamic Programming',
    'machine-learning': 'Machine Learning', 'web-development': 'Web Development', 'databases': 'Databases',
    'cybersecurity': 'Cybersecurity', 'mobile-development': 'Mobile Development'
  };
  var CATEGORY_ORDER = Object.keys(CATEGORY_NAMES);

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ------------------------------ knowledge base ------------------------------ */
  // keys: [phrase, weight]. Matching is on lower-cased text.
  var TOPICS = [
    { id: 'big-o', title: 'Big-O notation', keys: [['big-o', 3], ['big o', 3], ['time complexity', 3], ['space complexity', 3], ['complexity', 1], ['o(n', 2], ['asymptotic', 2]],
      text: 'Big-O describes how the work (or memory) grows as the input size `n` grows, ignoring constants. `O(1)` is constant, `O(log n)` halves the problem each step, `O(n)` touches each item once, `O(n log n)` is typical of good sorts, `O(n^2)` is a loop inside a loop. Count the loops and what each one iterates over; nested loops over the same input multiply. Drop constants and lower-order terms: `3n + 10` is `O(n)`.' },
    { id: 'binary-search', title: 'Binary search', keys: [['binary search', 4], ['bisect', 2], ['sorted array search', 2], ['log n', 1]],
      text: 'Binary search finds a value in a **sorted** array in `O(log n)`. Keep `lo` and `hi` bounds, look at `mid = lo + (hi - lo) / 2` (floored), then discard the half that cannot contain the target. Decide your invariant first (for example "target is within `[lo, hi]`") and make every branch keep it. Off-by-one errors almost always come from mixing inclusive and exclusive bounds.' },
    { id: 'hash-map', title: 'Hash maps', keys: [['hash map', 4], ['hashmap', 4], ['hash table', 4], ['dictionary', 2], ['dict', 1], ['map', 1], ['set', 1], ['lookup', 1]],
      text: 'A hash map stores key/value pairs and finds a key in average `O(1)` time by hashing the key to a bucket. Use it to replace an inner search loop: remember what you have seen (`Map` in JavaScript, `dict` in Python) and look things up instead of rescanning. Trade-off: extra `O(n)` memory, and keys must be hashable and comparable the way you expect.' },
    { id: 'recursion', title: 'Recursion', keys: [['recursion', 4], ['recursive', 4], ['base case', 3], ['call stack', 2], ['stack overflow', 2]],
      text: 'A recursive function solves a problem by calling itself on a smaller one. Every recursive function needs a **base case** that returns without recursing, and each call must move toward it. Write the base case first, then assume the function already works for smaller inputs and combine that result. Deep recursion uses call-stack memory; if the depth can reach thousands, consider a loop or an explicit stack.' },
    { id: 'dp', title: 'Dynamic programming', keys: [['dynamic programming', 4], ['memoization', 3], ['memoisation', 3], ['memoize', 3], ['tabulation', 3], ['subproblem', 2], ['dp', 2], ['knapsack', 2]],
      text: 'Dynamic programming applies when a problem has **overlapping subproblems** and **optimal substructure**. Steps: define the state (what does `dp[i]` mean exactly?), write the recurrence that builds it from smaller states, set the base cases, then pick an order that fills smaller states first (tabulation) or cache a recursive function (memoization). Often only the last row or two of the table is needed, which cuts memory.' },
    { id: 'stack-queue', title: 'Stacks and queues', keys: [['stack', 2], ['queue', 3], ['lifo', 3], ['fifo', 3], ['deque', 2]],
      text: 'A **stack** is last-in, first-out: push and pop at one end. It fits matching brackets, undo history and depth-first search. A **queue** is first-in, first-out: enqueue at the back, dequeue at the front. It fits breadth-first search and scheduling. In JavaScript a plain array is fine for a stack; for a queue, `shift()` is `O(n)`, so use an index pointer or a linked structure for large inputs.' },
    { id: 'trie', title: 'Tries', keys: [['trie', 4], ['prefix tree', 4], ['autocomplete', 2], ['prefix', 1]],
      text: 'A trie stores strings character by character in a tree, so all words with a shared prefix share a path. Insert, lookup and prefix check cost `O(L)` for a word of length `L`, independent of how many words are stored. Each node holds children (a map or array) and a flag marking the end of a word.' },
    { id: 'graph', title: 'Graph search: BFS and DFS', keys: [['bfs', 4], ['dfs', 4], ['breadth first', 4], ['breadth-first', 4], ['depth first', 4], ['depth-first', 4], ['graph', 3], ['traversal', 2], ['adjacency', 2], ['visited', 1]],
      text: 'Both traversals visit every node reachable from a start node, marking nodes **visited** so cycles do not loop forever. **BFS** uses a queue and explores level by level, so it finds the fewest-edges path in an unweighted graph. **DFS** uses a stack or recursion and goes deep first; it suits cycle detection, connected components and topological sorting. Both run in `O(V + E)`.' },
    { id: 'dijkstra', title: 'Dijkstra', keys: [['dijkstra', 5], ['shortest path', 3], ['priority queue', 2], ['min-heap', 2], ['min heap', 2]],
      text: 'Dijkstra finds shortest paths from one source in a graph with **non-negative** edge weights. Keep a distance table (start at 0, others infinite) and a priority queue of `(distance, node)`. Repeatedly pop the closest unfinished node and relax its edges: if `dist[u] + w < dist[v]`, update `v`. With a binary heap it costs `O((V + E) log V)`. Negative weights break the greedy argument; use Bellman-Ford then.' },
    { id: 'sorting', title: 'Sorting', keys: [['sorting', 3], ['sort', 2], ['quicksort', 4], ['mergesort', 4], ['merge sort', 4], ['bubble sort', 3], ['stable sort', 3]],
      text: 'Comparison sorts cannot beat `O(n log n)` on average. Merge sort is `O(n log n)` always and stable but needs extra memory; quicksort is `O(n log n)` on average, `O(n^2)` worst case, and sorts in place; bubble and insertion sort are `O(n^2)`. A **stable** sort keeps equal items in their original order. In JavaScript, `Array.prototype.sort` compares as strings unless you pass a comparator such as `(a, b) => a - b`.' },
    { id: 'regex', title: 'Regular expressions', keys: [['regex', 4], ['regular expression', 4], ['regexp', 4], ['pattern matching', 2]],
      text: 'A regular expression describes a text pattern. Basics: `\\d` digit, `\\w` word character, `.` any character, `*` zero or more, `+` one or more, `?` optional, `^`/`$` anchors, `(...)` groups, `[abc]` a set. Anchor patterns you use for validation, or partial matches will pass. Nested quantifiers such as `(a+)+` can backtrack catastrophically on crafted input (ReDoS), so keep patterns simple.' },
    { id: 'xss', title: 'Cross-site scripting (XSS)', keys: [['xss', 5], ['cross-site scripting', 5], ['cross site scripting', 5], ['escape html', 3], ['innerhtml', 3], ['sanitize', 2], ['sanitise', 2]],
      text: 'XSS happens when untrusted text is inserted into a page as HTML or script, so the browser runs the attacker\'s markup. Defences, in order: put text in with `textContent` instead of `innerHTML`; if you must build HTML, escape `& < > " \'` for the context; add a Content-Security-Policy that blocks inline scripts. Escape on output, in the context where the value lands.' },
    { id: 'sqli', title: 'SQL injection', keys: [['sql injection', 5], ['sqli', 4], ['parameterized', 3], ['parameterised', 3], ['prepared statement', 3], ['injection', 2]],
      text: 'SQL injection occurs when user input is concatenated into a query string, so input like `\' OR 1=1 --` changes the query\'s meaning. The fix is **parameterised queries** (prepared statements): the SQL text and the values travel separately, so values are never parsed as SQL. Escaping by hand is fragile; allow-lists help for identifiers such as column names that cannot be parameters.' },
    { id: 'hash-vs-encrypt', title: 'Hashing vs encryption', keys: [['hashing', 3], ['hash function', 4], ['encryption', 3], ['encrypt', 3], ['decrypt', 2], ['sha256', 3], ['sha-256', 3], ['bcrypt', 3], ['checksum', 2], ['password storage', 3], ['hash', 1]],
      text: '**Hashing** is one-way: the same input always gives the same digest, and you cannot recover the input. **Encryption** is two-way: with the key you get the plaintext back. Store passwords with a slow, salted password hash (bcrypt, scrypt, Argon2), never plain SHA-256 and never reversible encryption. Use hashes for integrity checks and encryption for confidentiality.' },
    { id: 'jwt', title: 'JSON Web Tokens', keys: [['jwt', 5], ['json web token', 5], ['bearer token', 2], ['signature verification', 2]],
      text: 'A JWT has three base64url parts: header, payload, signature. The payload is **encoded, not encrypted**: anyone can read it, so never put secrets in it. The signature proves it was not altered, but only if the server verifies it with the expected algorithm and key (reject `alg: none`), and checks `exp`. Tokens cannot be revoked easily, so keep lifetimes short.' },
    { id: 'base64', title: 'Base64', keys: [['base64', 5], ['base 64', 4], ['base64url', 4]],
      text: 'Base64 turns bytes into text using 64 safe characters, growing the data by about a third. It is an **encoding, not encryption**: anyone can decode it. Every 3 bytes become 4 characters, with `=` padding at the end. The URL-safe variant swaps `+` and `/` for `-` and `_`.' },
    { id: 'cors', title: 'CORS', keys: [['cors', 5], ['cross-origin', 4], ['cross origin', 4], ['same-origin policy', 4], ['preflight', 3]],
      text: 'Browsers block a page from reading responses from another origin (scheme, host, port) unless that server opts in with `Access-Control-Allow-Origin`. CORS is enforced by the **browser**, not the server, and it protects users, not your API. "Non-simple" requests trigger a preflight `OPTIONS` request first. Avoid `*` for endpoints that use credentials.' },
    { id: 'rest', title: 'REST APIs', keys: [['rest', 3], ['restful', 4], ['http method', 3], ['status code', 3], ['endpoint', 2], ['idempotent', 3], ['api design', 3]],
      text: 'REST models an API as resources with URLs and uses HTTP methods for actions: `GET` reads, `POST` creates, `PUT` replaces, `PATCH` updates, `DELETE` removes. `GET`, `PUT` and `DELETE` are **idempotent**: repeating them leaves the same state. Use status codes honestly: `200` ok, `201` created, `400` bad input, `401` not signed in, `403` forbidden, `404` missing, `429` rate limited, `500` server fault.' },
    { id: 'closures', title: 'Closures', keys: [['closure', 4], ['closures', 4], ['lexical scope', 3], ['scope', 2], ['hoisting', 2]],
      text: 'A closure is a function that remembers the variables of the scope where it was created, even after that scope has returned. It is how counters, memoisation caches and private state work: the inner function keeps the outer variable alive. A classic trap: `var` in a loop shares one variable across all callbacks; `let` creates a fresh one per iteration.' },
    { id: 'async', title: 'Async and promises', keys: [['async', 4], ['await', 4], ['promise', 4], ['callback', 2], ['event loop', 4], ['asynchronous', 4], ['settimeout', 2]],
      text: 'Async code lets long waits (network, timers) happen without freezing the program. A `Promise` represents a value that arrives later; `await` pauses the surrounding `async` function until it settles, while other work continues. Use `try/catch` around `await` for errors, and `Promise.all` to run independent tasks together. JavaScript runs one task at a time on the event loop; callbacks queue up and run when the stack is empty.' },
    { id: 'gradient-descent', title: 'Gradient descent', keys: [['gradient descent', 5], ['gradient', 3], ['learning rate', 4], ['loss function', 3], ['optimizer', 2], ['backpropagation', 3]],
      text: 'Gradient descent minimises a loss by repeatedly stepping against its gradient: `w = w - lr * dLoss/dw`. The **learning rate** `lr` sets the step size: too large and the loss bounces or diverges, too small and training crawls. Mini-batch versions estimate the gradient from a few samples at a time. Scale features first; it makes the loss surface easier to descend.' },
    { id: 'overfitting', title: 'Overfitting', keys: [['overfitting', 5], ['overfit', 5], ['underfitting', 4], ['regularization', 3], ['regularisation', 3], ['validation set', 3], ['train test', 3], ['bias variance', 4]],
      text: 'A model overfits when it memorises noise in the training data: training error is low but error on unseen data is high. Detect it by holding out a validation set and watching the gap. Remedies: more data, a simpler model, regularisation (L1/L2, dropout), early stopping and cross-validation. Never tune on the final test set.' },
    { id: 'normalisation', title: 'Normalisation', keys: [['normalization', 4], ['normalisation', 4], ['normalize', 4], ['normalise', 4], ['normal form', 4], ['3nf', 4], ['denormalization', 3], ['standardization', 3], ['standardisation', 3], ['feature scaling', 3], ['min-max', 3]],
      text: 'The word has two common uses. **Databases:** normalisation splits data into tables so each fact is stored once (1NF atomic values, 2NF no partial key dependence, 3NF no transitive dependence), preventing update anomalies; denormalise deliberately for read speed. **Machine learning:** scale features, for example min-max `(x - min) / (max - min)` or z-score `(x - mean) / std`, so no feature dominates by magnitude.' },
    { id: 'indexes', title: 'Database indexes', keys: [['index', 2], ['indexes', 3], ['indices', 2], ['b-tree', 3], ['btree', 3], ['query plan', 3], ['explain analyze', 3], ['full table scan', 3]],
      text: 'An index is an extra sorted structure (usually a B-tree) that lets the database find rows without scanning the whole table. It speeds `WHERE`, `JOIN` and `ORDER BY` on the indexed columns, but costs disk space and slows writes. For a multi-column index, order matters: it helps queries that use its leftmost columns. Check real behaviour with `EXPLAIN`.' },
    { id: 'acid', title: 'ACID transactions', keys: [['acid', 5], ['transaction', 3], ['isolation level', 4], ['atomicity', 4], ['rollback', 2], ['commit', 1]],
      text: 'ACID describes reliable transactions. **Atomicity**: all steps happen or none do. **Consistency**: constraints hold before and after. **Isolation**: concurrent transactions do not see each other\'s half-finished work (levels trade safety for speed). **Durability**: once committed, data survives a crash. A bank transfer (debit plus credit) is the standard example.' },
    { id: 'pagination', title: 'Pagination', keys: [['pagination', 5], ['paginate', 5], ['offset', 2], ['cursor', 3], ['infinite scroll', 3], ['page size', 3]],
      text: 'Pagination returns large lists in chunks. **Offset/limit** is simple (`page * size`) but gets slow for deep pages and can skip or repeat rows when data changes. **Cursor** pagination returns a token for the last item and asks for rows after it: stable and fast, but you cannot jump to page 50. Always cap the page size and define a stable sort order.' }
  ];

  function norm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9()+\-\s#.]/g, ' ').replace(/\s+/g, ' ') + ' '; }

  function matchTopic(msg) {
    var m = norm(msg), best = null, bestScore = 0;
    TOPICS.forEach(function (t) {
      var score = 0;
      t.keys.forEach(function (k) {
        var key = k[0], idx = m.indexOf(key);
        if (idx < 0) return;
        // whole-word check for short keys
        if (key.length <= 4) {
          var before = m.charAt(idx - 1), after = m.charAt(idx + key.length);
          if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) return;
        }
        score += k[1];
      });
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return bestScore >= 2 ? best : null;
  }

  /* ------------------------------ code review ------------------------------ */
  function stripJs(line) {
    return line.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  }
  function stripPy(line) {
    return line.replace(/#.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""');
  }
  function words(code, w) { var m = code.match(new RegExp('\\b' + w + '\\b', 'g')); return m ? m.length : 0; }

  function reviewJs(raw, problem) {
    var f = [], lines = raw.split('\n'), clean = [], inBlock = false;
    lines.forEach(function (l) {
      var s = l;
      if (inBlock) { var e = s.indexOf('*/'); if (e < 0) { clean.push(''); return; } s = s.slice(e + 2); inBlock = false; }
      s = s.replace(/\/\*.*?\*\//g, '');
      var o = s.indexOf('/*');
      if (o >= 0) { s = s.slice(0, o); inBlock = true; }
      clean.push(stripJs(s));
    });
    var all = clean.join('\n');
    if (/write your solution here/i.test(raw)) f.push([1, 'This is still the starter template. Replace the comment with your logic.']);
    var fm = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/.exec(all) || /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/.exec(all);
    var fname = fm ? fm[1] : (problem && problem.fn) || '';
    var params = fm ? fm[2].split(',').map(function (p) { return p.replace(/=.*$/, '').replace(/[.\s{}\[\]]/g, ''); }).filter(Boolean) : [];
    if (fm) {
      var body = bodyAfter(all, fm.index + fm[0].length - 1);
      if (!body.replace(/\s/g, '')) f.push([lineOf(all, fm.index), 'The function `' + fname + '` has an empty body.']);
      else if (!/\breturn\b/.test(body)) f.push([lineOf(all, fm.index), '`' + fname + '` never uses `return`, so it will give back `undefined`.']);
      if (fname && new RegExp('\\b' + fname + '\\s*\\(').test(body) && !/\bif\s*\(|\?|\bswitch\b|&&|\|\|/.test(body)) f.push([lineOf(all, fm.index), '`' + fname + '` calls itself but has no visible base case (an `if` that returns without recursing). It would recurse forever.']);
      params.forEach(function (p) {
        if (/^[A-Za-z_$][\w$]*$/.test(p) && words(body, p.replace(/\$/g, '\\$')) === 0) f.push([lineOf(all, fm.index), 'Parameter `' + p + '` is never used.']);
      });
    } else if (!/\breturn\b/.test(all) && !/=>/.test(all)) {
      f.push([1, 'No function with `return` found; the checker needs a function that returns its answer.']);
    }
    // loops
    var stack = [], pending = false, loopDepthStarts = [];
    clean.forEach(function (l, i) {
      var depth = stack.filter(Boolean).length;
      var isLoop = /\b(for|while)\s*\(/.test(l) || /\bdo\s*\{/.test(l) || /\.(forEach|map|filter|reduce|some|every)\s*\(/.test(l);
      if (isLoop && depth >= 1) loopDepthStarts.push(i + 1);
      else if (depth >= 1 && /\.(indexOf|includes|find|findIndex)\s*\(/.test(l)) f.push([i + 1, '`indexOf`/`includes`/`find` inside a loop scans the whole array each time, making it O(n^2). A `Set` or `Map` gives O(1) lookups.']);
      if (isLoop) pending = true;
      for (var c = 0; c < l.length; c++) {
        if (l[c] === '{') { stack.push(pending); pending = false; }
        else if (l[c] === '}') stack.pop();
      }
      if (/\.(forEach|map|filter|reduce|some|every)\s*\(/.test(l) && /=>\s*[^{\s]/.test(l)) pending = false;
      if (!/[{(]\s*$/.test(l) && /;\s*$/.test(l)) pending = false;
    });
    if (loopDepthStarts.length) f.push([loopDepthStarts[0], 'Nested loop: this is probably O(n^2). Ask whether a hash map, a sort or two pointers can replace the inner loop.']);
    clean.forEach(function (l, i) {
      var n = i + 1;
      if (/\bconsole\.(log|debug)\s*\(/.test(l)) f.push([n, '`console.log` left in. Remove debug output before submitting.']);
      if (/(^|[^=!<>])==([^=]|$)/.test(l) || /!=([^=]|$)/.test(l)) f.push([n, 'Loose equality (`==` or `!=`) coerces types. Prefer `===` / `!==`.']);
      if (/\bvar\s+/.test(l)) f.push([n, '`var` is function-scoped and hoisted. Use `let` or `const`.']);
      if (raw.split('\n')[i].length > LONG_LINE) f.push([n, 'Very long line (' + raw.split('\n')[i].length + ' characters). Split it for readability.']);
      params.forEach(function (p) {
        if (!/^[A-Za-z_$][\w$]*$/.test(p)) return;
        var q = p.replace(/\$/g, '\\$');
        if (new RegExp('\\b' + q + '\\.(push|pop|shift|unshift|splice|sort|reverse|fill)\\s*\\(').test(l) || new RegExp('\\b' + q + '\\s*\\[[^\\]]*\\]\\s*=[^=]').test(l)) f.push([n, 'This mutates the input `' + p + '`. Tests may reuse it; copy first (`[...' + p + ']`) unless mutation is intended.']);
      });
    });
    return f;
  }

  function bodyAfter(text, openIdx) {
    var depth = 0;
    for (var i = openIdx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(openIdx + 1, i); }
    }
    return text.slice(openIdx + 1);
  }
  function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

  function reviewPy(raw, problem) {
    var f = [], lines = raw.split('\n'), clean = lines.map(stripPy);
    if (/write your solution here/i.test(raw)) f.push([1, 'This is still the starter template. Replace the comment with your logic.']);
    var all = clean.join('\n');
    var fm = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/m.exec(all);
    var fname = fm ? fm[1] : (problem && problem.pyFn) || '';
    var params = fm ? fm[2].split(',').map(function (p) { return p.replace(/[:=].*$/, '').replace(/[\s*]/g, ''); }).filter(Boolean) : [];
    var code = clean.map(function (l, i) { return { n: i + 1, t: l, indent: l.match(/^\s*/)[0].replace(/\t/g, '    ').length }; }).filter(function (o) { return o.t.trim(); });
    var stmts = code.filter(function (o) { return !/^\s*def\s/.test(o.t) && !/^\s*"""/.test(o.t); });
    if (fm && stmts.length && stmts.every(function (o) { return /^\s*pass\s*$/.test(o.t); })) f.push([stmts[0].n, 'The only statement is `pass`, so the function does nothing yet.']);
    else if (fm && !/\breturn\b/.test(all)) f.push([lineOf(all, fm.index), '`' + fname + '` never uses `return`, so it gives back `None`.']);
    if (fm) {
      var after = all.slice(fm.index + fm[0].length);
      if (fname && new RegExp('\\b' + fname + '\\s*\\(').test(after) && !/\bif\b|\belse\b/.test(after)) f.push([lineOf(all, fm.index), '`' + fname + '` calls itself but has no `if` base case. It would recurse until the recursion limit.']);
      params.forEach(function (p) {
        if (/^[A-Za-z_]\w*$/.test(p) && words(after, p) === 0) f.push([lineOf(all, fm.index), 'Parameter `' + p + '` is never used.']);
      });
    }
    // nested loops by indentation
    var loops = [];
    code.forEach(function (o) {
      while (loops.length && o.indent <= loops[loops.length - 1]) loops.pop();
      if (/^\s*(for|while)\b/.test(o.t)) {
        if (loops.length) f.push([o.n, 'Nested loop: this is probably O(n^2). Ask whether a dict/set or sorting can replace the inner loop.']);
        loops.push(o.indent);
      } else if (loops.length && /\b(in\s+\w+|\.index\()/.test(o.t) && /\bif\b[^:]*\bin\s+[A-Za-z_]\w*\s*:/.test(o.t) && !/\bin\s+(seen|visited)\b/.test(o.t)) {
        // intentionally conservative: only flag membership tests on names that are likely lists
      }
    });
    clean.forEach(function (l, i) {
      var n = i + 1;
      if (/^\s*print\s*\(/.test(l)) f.push([n, '`print` left in. Remove debug output before submitting.']);
      if (/^\s*except\s*:/.test(l)) f.push([n, 'Bare `except:` also swallows `KeyboardInterrupt` and hides bugs. Catch a specific exception.']);
      if (/\bdef\s+\w+\s*\([^)]*=\s*(\[\s*\]|\{\s*\}|set\s*\(\s*\)|dict\s*\(\s*\)|list\s*\(\s*\))/.test(l)) f.push([n, 'Mutable default argument: it is created once and shared between calls. Use `None` and create the object inside.']);
      if (/(==|!=)\s*None\b/.test(l)) f.push([n, 'Compare to `None` with `is` / `is not`.']);
      if (lines[i].length > LONG_LINE) f.push([n, 'Very long line (' + lines[i].length + ' characters). Split it for readability.']);
      params.forEach(function (p) {
        if (!/^[A-Za-z_]\w*$/.test(p)) return;
        if (new RegExp('\\b' + p + '\\.(append|extend|pop|insert|remove|sort|reverse|clear)\\s*\\(').test(l) || new RegExp('\\b' + p + '\\s*\\[[^\\]]*\\]\\s*=[^=]').test(l)) f.push([n, 'This mutates the input `' + p + '`. Tests may reuse it; copy first (`list(' + p + ')`) unless mutation is intended.']);
      });
    });
    return f;
  }

  function review(code, lang, problem) {
    if (typeof code !== 'string' || !code.trim()) return { text: 'There is no code in the editor to review. Write something and ask again.', findings: 0 };
    var raw = code.length > MAX_CODE ? code.slice(0, MAX_CODE) : code;
    raw = raw.replace(/\r\n?/g, '\n');
    var f = lang === 'py' ? reviewPy(raw, problem) : reviewJs(raw, problem);
    var seen = {}, uniq = [];
    f.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (x) { var k = x[0] + x[1]; if (!seen[k]) { seen[k] = 1; uniq.push(x); } });
    if (!uniq.length) return { text: '**Static review** of your ' + (lang === 'py' ? 'Python' : 'JavaScript') + ' code found nothing to flag. These are simple pattern checks, so they cannot prove the code is correct. Run the tests to find out.', findings: 0 };
    var shown = uniq.slice(0, MAX_FINDINGS).map(function (x) { return '- Line ' + x[0] + ': ' + x[1]; });
    var more = uniq.length > MAX_FINDINGS ? '\n(' + (uniq.length - MAX_FINDINGS) + ' more not shown.)' : '';
    return { text: '**Static review** found ' + uniq.length + ' thing(s) to look at:\n' + shown.join('\n') + more + '\nThese are pattern-based checks, not a proof. A flagged line is not always a bug.', findings: uniq.length };
  }

  /* ------------------------------ plan ------------------------------ */
  function solvedSet(ctx) {
    var set = {}, src = ctx.solvedIds;
    if (Array.isArray(src)) src.forEach(function (id) { if (typeof id === 'string') set[id] = true; });
    else if (ctx.state && ctx.state.solved && typeof ctx.state.solved === 'object') Object.keys(ctx.state.solved).forEach(function (id) { set[id] = true; });
    return { set: set, known: Array.isArray(src) || !!(ctx.state && ctx.state.solved) };
  }
  var DIFF_RANK = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

  function plan(ctx) {
    var st = ctx.stats, problems = Array.isArray(ctx.problems) ? ctx.problems : [];
    if (!st || !st.perCategory || !problems.length) return 'I need your progress data to plan. Open the Progress page and try again.';
    var sv = solvedSet(ctx), cats = [];
    CATEGORY_ORDER.forEach(function (id) {
      var pc = hasOwn(st.perCategory, id) ? st.perCategory[id] : null;
      if (pc && pc.total > 0) cats.push({ id: id, ratio: pc.solved / pc.total, solved: pc.solved, total: pc.total });
    });
    cats.sort(function (a, b) { return a.ratio - b.ratio; });
    var lines = [];
    if (!st.solved) lines.push('You have not solved anything yet, so start with the easiest challenges.');
    else lines.push('You have solved **' + st.solved + '/' + st.total + '** (level ' + st.level + ', ' + st.rank + ').');
    var weakest = cats.filter(function (c) { return c.ratio < 1; })[0];
    if (!weakest) return lines.concat(['Every track is complete. Redo challenges in the other language to practise.']).join('\n');
    lines.push('Weakest track: **' + CATEGORY_NAMES[weakest.id] + '** (' + weakest.solved + '/' + weakest.total + ' solved).');
    var pool = problems.filter(function (p) { return p.category === weakest.id && !sv.set[p.id]; });
    pool.sort(function (a, b) { return (DIFF_RANK[a.difficulty] || 0) - (DIFF_RANK[b.difficulty] || 0); });
    if (!sv.known) lines.push('I cannot see which challenges you solved, so these are the easiest in the track:');
    else lines.push('Next up, easiest unsolved first:');
    pool.slice(0, 3).forEach(function (p) { lines.push('- `open ' + p.id + '` (' + p.difficulty + '): ' + p.title); });
    if (st.streak === 0) lines.push('Your streak is at 0. One solved challenge today starts it again.');
    else lines.push('Keep your ' + st.streak + '-day streak going: solve one today.');
    return lines.join('\n');
  }

  /* ------------------------------ hints and explanation ------------------------------ */
  function nextHint(problem, state) {
    var hints = (problem && problem.hints) || [];
    if (!hints.length) return 'This challenge has no stored hints. Re-read the examples and try a smaller input by hand.';
    var level = 0;
    if (state && typeof state === 'object' && /^[a-z0-9-]+$/.test(String(problem.id))) {
      if (!state.hints || typeof state.hints !== 'object') state.hints = {};
      level = hasOwn(state.hints, problem.id) ? Math.max(0, Math.floor(Number(state.hints[problem.id]) || 0)) : 0;
      state.hints[problem.id] = Math.min(hints.length, level + 1);
    }
    var tier = Math.min(hints.length, level + 1);
    var tail = tier < hints.length ? 'Ask for another hint if you are still stuck (hint ' + tier + ' of ' + hints.length + ').' : 'That was the last hint (' + tier + ' of ' + hints.length + '). I will not write the solution; try the approach on a small example by hand.';
    return '**Hint ' + tier + ' of ' + hints.length + '** for ' + problem.title + ':\n' + hints[tier - 1] + '\n' + tail;
  }

  function explainProblem(problem, solved) {
    if (!solved) return 'I only explain the approach and complexity after you have solved a challenge, so it does not spoil it. Here is a nudge instead; ask "hint" for more.\n' + (problem.hints && problem.hints[0] ? problem.hints[0] : 'Work an example by hand first.');
    return '**' + problem.title + '** - approach and complexity:\n' + (problem.editorial || '') + '\nComplexity of the reference approach: ' + (problem.complexity || 'not recorded') + '.';
  }

  function capabilities() {
    return 'I am a **rule-based tutor** that runs entirely in your browser. I am not an AI model, I do not learn, and nothing leaves your device. I can:\n' +
      '- give tiered hints for the open challenge (say "hint" or "I\'m stuck")\n' +
      '- explain concepts such as big-O, binary search, hash maps, recursion, dynamic programming, XSS, JWT, CORS and about 15 more (say "explain recursion")\n' +
      '- review the code in your editor with static checks (say "review my code")\n' +
      '- suggest what to practise next (say "what should I do next")\n' +
      '- explain a challenge\'s approach once you have solved it';
  }

  /* ------------------------------ reply ------------------------------ */
  function has(m, re) { return re.test(m); }

  function reply(message, ctx, state) {
    ctx = ctx && typeof ctx === 'object' ? ctx : {};
    var msg = typeof message === 'string' ? message.slice(0, MAX_MESSAGE) : '';
    var m = msg.toLowerCase().trim();
    var problem = ctx.problem && typeof ctx.problem === 'object' && ctx.problem.id ? ctx.problem : null;
    if (!m) return { text: capabilities() };

    if (/^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening)|help|\?|what can you do\??|who are you\??|what are you\??)[\s!.?]*$/.test(m) || /\b(are you (an? )?(ai|bot|llm|gpt|human)|what can you do|how do you work|what are you)\b/.test(m)) {
      return { text: capabilities() };
    }
    if (/\b(solution|answer|editorial|approach|walk ?through|reference)\b/.test(m) || /\bcomplexity\b.*\b(this|problem|challenge|solution)\b/.test(m)) {
      if (problem) return { text: explainProblem(problem, ctx.solved === true) };
    }
    if (/\b(review|feedback|critique|lint|check (my|the) (code|solution)|look at (my|the) code|what'?s wrong|whats wrong|why (is|does|did).*(fail|wrong|not work)|bug)\b/.test(m)) {
      if (!ctx.code || typeof ctx.code !== 'string' || !ctx.code.trim()) return { text: 'I do not see any code in the editor. Write some and ask me to review it.' };
      return { text: review(ctx.code, ctx.lang === 'py' ? 'py' : 'js', problem).text };
    }
    if (/\b(hint|stuck|clue|nudge|help me|give me a tip|no idea|where do i (start|begin)|how do i (start|begin))\b/.test(m)) {
      if (!problem) return { text: 'Open a challenge first and I can give hints for it. Or ask me to explain a concept, for example "explain hash maps".' };
      return { text: nextHint(problem, state) };
    }
    if (/\b(next|recommend|what should i|study plan|plan|practi[sc]e|what now|weak|improve|suggest)\b/.test(m)) {
      return { text: plan(ctx) };
    }
    var topic = matchTopic(m);
    if (topic) return { text: '**' + topic.title + '**\n' + topic.text };
    var extra = problem ? ' You have **' + problem.title + '** open: ask for a hint or a code review.' : '';
    return { text: 'I did not recognise that. I match keywords against a fixed set of topics, so rephrasing with the concept name can help.' + extra + '\n\n' + capabilities() };
  }

  return { reply: reply, review: review, topics: TOPICS.map(function (t) { return t.id; }), topicText: function () { return TOPICS.map(function (t) { return t.text; }); }, capabilities: capabilities };
});
