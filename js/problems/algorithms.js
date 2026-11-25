/* Code Arsenal problem bank: algorithms + data structures. */
(function (root) {
  var reg = (root.CA_PROBLEMS_REG = root.CA_PROBLEMS_REG || []);
  reg.push(
    {
      id: 'two-sum', title: 'Two Sum', category: 'algorithms', difficulty: 'beginner',
      fn: 'twoSum', params: ['nums', 'target'],
      summary: 'Find the two positions whose values add up to a target.',
      statement: [
        'Given an array of integers `nums` and an integer `target`, return the indices `[i, j]` with `i < j` such that `nums[i] + nums[j] === target`.',
        'Exactly one valid pair exists in every test. You may not use the same element twice.'
      ],
      examples: [
        { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]', note: '2 + 7 = 9' },
        { input: 'nums = [3, 3], target = 6', output: '[0, 1]' }
      ],
      constraints: ['2 <= nums.length <= 10^4', 'Exactly one solution exists'],
      hints: [
        'A brute-force double loop works but is O(n²). What do you need to know about each number you have already seen?',
        'For each value `x`, you are looking for `target - x`. Store seen values in a hash map from value to index.',
        'Walk the array once. Before storing `nums[i]`, check whether `target - nums[i]` is already in the map.'
      ],
      complexity: 'O(n) time, O(n) space',
      editorial: 'One pass with a hash map turns the inner search into an O(1) lookup: the complement of each number is either already stored or not.',
      tests: [
        { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { args: [[3, 2, 4], 6], expected: [1, 2] },
        { args: [[3, 3], 6], expected: [0, 1] },
        { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
        { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
        { args: [[1, 5, 8, 12, 20], 28], expected: [2, 4], hidden: true }
      ],
      solutions: {
        js: String.raw`function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
  return [];
}`,
        py: String.raw`def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []`
      }
    },
    {
      id: 'binary-search', title: 'Binary Search', category: 'algorithms', difficulty: 'beginner',
      fn: 'binarySearch', params: ['nums', 'target'],
      summary: 'Locate a value in a sorted array in logarithmic time.',
      statement: [
        'Given an array `nums` sorted in ascending order and an integer `target`, return the index of `target`, or `-1` if it is not present.',
        'Your solution should run in O(log n) time.'
      ],
      examples: [
        { input: 'nums = [-1, 0, 3, 5, 9, 12], target = 9', output: '4' },
        { input: 'nums = [-1, 0, 3, 5, 9, 12], target = 2', output: '-1' }
      ],
      constraints: ['All values are distinct', '0 <= nums.length <= 10^5'],
      hints: [
        'Each comparison with the middle element lets you discard half of the remaining range.',
        'Keep two bounds, `lo` and `hi`. Compute `mid = Math.floor((lo + hi) / 2)`.',
        'Loop while `lo <= hi`. If `nums[mid] < target` move `lo = mid + 1`, otherwise move `hi = mid - 1`.'
      ],
      complexity: 'O(log n) time, O(1) space',
      editorial: 'Halving the search interval each step gives logarithmic time. The classic bug is an off-by-one in the loop condition or bound update.',
      tests: [
        { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
        { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
        { args: [[5], 5], expected: 0 },
        { args: [[], 1], expected: -1 },
        { args: [[1, 3, 5, 7, 9, 11, 13], 13], expected: 6, hidden: true },
        { args: [[1, 3, 5, 7, 9, 11, 13], 1], expected: 0, hidden: true }
      ],
      solutions: {
        js: String.raw`function binarySearch(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
        py: String.raw`def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`
      }
    },
    {
      id: 'merge-intervals', title: 'Merge Intervals', category: 'algorithms', difficulty: 'intermediate',
      fn: 'mergeIntervals', params: ['intervals'],
      summary: 'Collapse overlapping ranges into the smallest set of ranges.',
      statement: [
        'Given an array of intervals `[start, end]`, merge all overlapping intervals and return the result sorted by start.',
        'Intervals that only touch (for example `[1, 4]` and `[4, 5]`) count as overlapping.'
      ],
      examples: [
        { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' },
        { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]' }
      ],
      constraints: ['0 <= intervals.length <= 10^4', 'start <= end for every interval'],
      hints: [
        'Overlaps are easy to spot once the intervals are ordered. Sort first.',
        'Sort by start. Keep a result list whose last entry is the interval you are currently growing.',
        'For each interval, if its start is <= the last result end, extend that end with `max`. Otherwise push a new interval.'
      ],
      complexity: 'O(n log n) time, O(n) space',
      editorial: 'Sorting reduces the problem to a single sweep that only ever compares an interval with the last merged one.',
      tests: [
        { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
        { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
        { args: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
        { args: [[[5, 6]]], expected: [[5, 6]] },
        { args: [[[1, 10], [2, 3], [4, 5]]], expected: [[1, 10]], hidden: true },
        { args: [[[6, 8], [1, 9], [2, 4], [4, 7]]], expected: [[1, 9]], hidden: true },
        { args: [[]], expected: [], hidden: true }
      ],
      solutions: {
        js: String.raw`function mergeIntervals(intervals) {
  const sorted = intervals.map((x) => [x[0], x[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push(iv);
  }
  return out;
}`,
        py: String.raw`def merge_intervals(intervals):
    out = []
    for start, end in sorted(intervals):
        if out and start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out`
      }
    },
    {
      id: 'number-of-islands', title: 'Number of Islands', category: 'algorithms', difficulty: 'intermediate',
      fn: 'numIslands', params: ['grid'],
      summary: 'Count connected regions of land in a grid.',
      statement: [
        'You are given a grid as an array of strings, where `"1"` is land and `"0"` is water. Return the number of islands.',
        'An island is a group of land cells connected horizontally or vertically. Diagonals do not connect.'
      ],
      examples: [
        { input: 'grid = ["11000","11000","00100","00011"]', output: '3' },
        { input: 'grid = ["101","010","101"]', output: '5', note: 'Diagonal cells are separate islands.' }
      ],
      constraints: ['0 <= rows, columns <= 300'],
      hints: [
        'Think of each land cell as a node, with edges to its four neighbours.',
        'When you find an unvisited land cell, you have found a new island. Flood-fill it so you never count it again.',
        'Use an explicit stack for the flood fill to avoid deep recursion on large grids.'
      ],
      complexity: 'O(rows × cols) time and space',
      editorial: 'Each cell is visited at most once. Counting the number of times a flood fill starts equals the number of connected components.',
      tests: [
        { args: [['11110', '11010', '11000', '00000']], expected: 1 },
        { args: [['11000', '11000', '00100', '00011']], expected: 3 },
        { args: [['0']], expected: 0 },
        { args: [['101', '010', '101']], expected: 5 },
        { args: [['1']], expected: 1, hidden: true },
        { args: [['10101']], expected: 3, hidden: true },
        { args: [[]], expected: 0, hidden: true }
      ],
      solutions: {
        js: String.raw`function numIslands(grid) {
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== '1' || seen[r][c]) continue;
      count++;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === '1' && !seen[ny][nx]) {
            seen[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
    }
  }
  return count;
}`,
        py: String.raw`def num_islands(grid):
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    seen = set()
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != "1" or (r, c) in seen:
                continue
            count += 1
            stack = [(r, c)]
            seen.add((r, c))
            while stack:
                y, x = stack.pop()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == "1" and (ny, nx) not in seen:
                        seen.add((ny, nx))
                        stack.append((ny, nx))
    return count`
      }
    },
    {
      id: 'shortest-paths', title: 'Shortest Paths from a Source', category: 'algorithms', difficulty: 'expert',
      fn: 'shortestPaths', params: ['n', 'edges', 'source'],
      summary: 'Dijkstra on a weighted directed graph.',
      statement: [
        'A directed graph has `n` nodes labelled `0` to `n - 1`. Each edge is `[from, to, weight]` with a positive weight.',
        'Return an array `dist` of length `n` where `dist[i]` is the length of the shortest path from `source` to node `i`, or `-1` if node `i` is unreachable.'
      ],
      examples: [
        { input: 'n = 5, edges = [[0,1,4],[0,2,1],[2,1,2],[1,3,1],[2,3,5]], source = 0', output: '[0, 3, 1, 4, -1]' }
      ],
      constraints: ['1 <= n <= 1000', 'All weights are positive integers', 'Parallel edges are possible'],
      hints: [
        'Breadth-first search is not enough once edges have different weights.',
        'Repeatedly settle the unsettled node with the smallest known distance, then relax its outgoing edges.',
        'A priority queue gives O(E log V). For n <= 1000 a simple scan for the minimum is fast enough.'
      ],
      complexity: 'O((V + E) log V) with a heap',
      editorial: 'Dijkstra works because once the closest unsettled node is chosen, no later path can improve it when all weights are positive.',
      tests: [
        { args: [5, [[0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5]], 0], expected: [0, 3, 1, 4, -1] },
        { args: [1, [], 0], expected: [0] },
        { args: [3, [[0, 1, 5], [1, 2, 5], [0, 2, 20]], 0], expected: [0, 5, 10] },
        { args: [4, [[1, 2, 1], [2, 3, 1]], 1], expected: [-1, 0, 1, 2] },
        { args: [6, [[0, 1, 7], [0, 2, 9], [0, 5, 14], [1, 2, 10], [1, 3, 15], [2, 3, 11], [2, 5, 2], [3, 4, 6], [4, 5, 9]], 0], expected: [0, 7, 9, 20, 26, 11], hidden: true },
        { args: [3, [[0, 1, 2], [0, 1, 1]], 0], expected: [0, 1, -1], hidden: true }
      ],
      solutions: {
        js: String.raw`function shortestPaths(n, edges, source) {
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) adj[u].push([v, w]);
  const dist = new Array(n).fill(Infinity);
  const done = new Array(n).fill(false);
  dist[source] = 0;
  for (let step = 0; step < n; step++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] !== Infinity && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1) break;
    done[u] = true;
    for (const [v, w] of adj[u]) {
      if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    }
  }
  return dist.map((d) => (d === Infinity ? -1 : d));
}`,
        py: String.raw`import heapq

def shortest_paths(n, edges, source):
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((v, w))
    INF = float("inf")
    dist = [INF] * n
    dist[source] = 0
    heap = [(0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(heap, (dist[v], v))
    return [-1 if d == INF else d for d in dist]`
      }
    },
    {
      id: 'n-queens-count', title: 'N-Queens Count', category: 'algorithms', difficulty: 'expert',
      fn: 'countQueens', params: ['n'],
      summary: 'Count the ways to place n queens on an n × n board.',
      statement: [
        'Place `n` queens on an `n × n` chessboard so that no two queens attack each other (no shared row, column or diagonal).',
        'Return the number of distinct solutions.'
      ],
      examples: [
        { input: 'n = 4', output: '2' },
        { input: 'n = 1', output: '1' }
      ],
      constraints: ['1 <= n <= 9'],
      hints: [
        'Place one queen per row. The question is only which column each one gets.',
        'Backtrack row by row. Track which columns and which diagonals are already taken.',
        'Two cells share a diagonal when `row - col` is equal, or when `row + col` is equal. Keep a set for each.'
      ],
      complexity: 'Exponential, pruned heavily by the attack sets',
      editorial: 'Backtracking with constant-time attack checks prunes almost all invalid placements before they are explored.',
      tests: [
        { args: [1], expected: 1 },
        { args: [2], expected: 0 },
        { args: [3], expected: 0 },
        { args: [4], expected: 2 },
        { args: [5], expected: 10 },
        { args: [6], expected: 4, hidden: true },
        { args: [8], expected: 92, hidden: true }
      ],
      solutions: {
        js: String.raw`function countQueens(n) {
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  function place(row) {
    if (row === n) return 1;
    let total = 0;
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(row - c) || d2.has(row + c)) continue;
      cols.add(c); d1.add(row - c); d2.add(row + c);
      total += place(row + 1);
      cols.delete(c); d1.delete(row - c); d2.delete(row + c);
    }
    return total;
  }
  return place(0);
}`,
        py: String.raw`def count_queens(n):
    cols, d1, d2 = set(), set(), set()

    def place(row):
        if row == n:
            return 1
        total = 0
        for c in range(n):
            if c in cols or row - c in d1 or row + c in d2:
                continue
            cols.add(c); d1.add(row - c); d2.add(row + c)
            total += place(row + 1)
            cols.remove(c); d1.remove(row - c); d2.remove(row + c)
        return total

    return place(0)`
      }
    },

    /* ---------------------------- Data structures ---------------------------- */
    {
      id: 'valid-parentheses', title: 'Valid Parentheses', category: 'data-structures', difficulty: 'beginner',
      fn: 'isValid', params: ['s'],
      summary: 'Check that brackets close in the right order.',
      statement: [
        'Given a string `s` containing only the characters `()[]{}`, return `true` if every opening bracket is closed by the same type of bracket, in the correct order.',
        'An empty string is valid.'
      ],
      examples: [
        { input: 's = "()[]{}"', output: 'true' },
        { input: 's = "([)]"', output: 'false' }
      ],
      constraints: ['0 <= s.length <= 10^4'],
      hints: [
        'The most recently opened bracket must be the first one closed. Which data structure behaves that way?',
        'Push each opening bracket on a stack. On a closing bracket, the top of the stack must be its partner.',
        'At the end the stack must be empty, otherwise some bracket was never closed.'
      ],
      complexity: 'O(n) time, O(n) space',
      editorial: 'A stack mirrors the nesting structure: last opened, first closed.',
      tests: [
        { args: ['()'], expected: true },
        { args: ['()[]{}'], expected: true },
        { args: ['(]'], expected: false },
        { args: ['([)]'], expected: false },
        { args: ['{[]}'], expected: true },
        { args: [''], expected: true, hidden: true },
        { args: ['((('], expected: false, hidden: true },
        { args: [']'], expected: false, hidden: true }
      ],
      solutions: {
        js: String.raw`function isValid(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}`,
        py: String.raw`def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack`
      }
    },
    {
      id: 'min-stack', title: 'Min Stack', category: 'data-structures', difficulty: 'intermediate',
      fn: 'runMinStack', params: ['ops', 'args'],
      summary: 'A stack that reports its minimum in constant time.',
      statement: [
        'Design a stack that supports `push(x)`, `pop()`, `top()` and `getMin()`, all in O(1) time.',
        'Write `runMinStack(ops, args)`. It receives a list of operation names and a parallel list of argument lists, applies them in order to a fresh stack, and returns the list of results. `push` and `pop` produce `null`.'
      ],
      examples: [
        { input: 'ops = ["push","push","push","getMin","pop","top","getMin"], args = [[-2],[0],[-3],[],[],[],[]]', output: '[null,null,null,-3,null,0,-2]' }
      ],
      constraints: ['pop, top and getMin are only called on a non-empty stack'],
      hints: [
        'Remembering only the current minimum breaks when you pop it. What was the minimum before that push?',
        'Store, alongside each value, the minimum of the stack up to and including that value.',
        'Keep a stack of `[value, minSoFar]` pairs. `getMin` reads the second item of the top pair.'
      ],
      complexity: 'O(1) per operation, O(n) space',
      editorial: 'Storing the running minimum with each element means popping automatically restores the previous minimum.',
      tests: [
        { args: [['push', 'push', 'push', 'getMin', 'pop', 'top', 'getMin'], [[-2], [0], [-3], [], [], [], []]], expected: [null, null, null, -3, null, 0, -2] },
        { args: [['push', 'top', 'getMin'], [[5], [], []]], expected: [null, 5, 5] },
        { args: [['push', 'push', 'getMin', 'pop', 'getMin'], [[2], [1], [], [], []]], expected: [null, null, 1, null, 2] },
        { args: [['push', 'push', 'push', 'pop', 'pop', 'getMin'], [[3], [3], [1], [], [], []]], expected: [null, null, null, null, null, 3], hidden: true },
        { args: [[], []], expected: [], hidden: true }
      ],
      solutions: {
        js: String.raw`function runMinStack(ops, args) {
  const stack = [];
  const out = [];
  ops.forEach((op, i) => {
    if (op === 'push') {
      const x = args[i][0];
      const min = stack.length ? Math.min(x, stack[stack.length - 1][1]) : x;
      stack.push([x, min]);
      out.push(null);
    } else if (op === 'pop') {
      stack.pop();
      out.push(null);
    } else if (op === 'top') {
      out.push(stack[stack.length - 1][0]);
    } else if (op === 'getMin') {
      out.push(stack[stack.length - 1][1]);
    }
  });
  return out;
}`,
        py: String.raw`def run_min_stack(ops, args):
    stack = []
    out = []
    for op, a in zip(ops, args):
        if op == "push":
            x = a[0]
            m = min(x, stack[-1][1]) if stack else x
            stack.append((x, m))
            out.append(None)
        elif op == "pop":
            stack.pop()
            out.append(None)
        elif op == "top":
            out.append(stack[-1][0])
        elif op == "getMin":
            out.append(stack[-1][1])
    return out`
      }
    },
    {
      id: 'lru-cache', title: 'LRU Cache', category: 'data-structures', difficulty: 'advanced',
      fn: 'runLRUCache', params: ['capacity', 'ops', 'args'],
      summary: 'Evict the least recently used entry in constant time.',
      statement: [
        'Implement a cache with a fixed `capacity`. `get(key)` returns the value or `-1` if absent. `put(key, value)` inserts or updates a key. When the capacity is exceeded, evict the least recently used key.',
        'Both reads and writes count as a use. Write `runLRUCache(capacity, ops, args)`; it applies the operations in order to a fresh cache and returns the results (`null` for `put`).'
      ],
      examples: [
        { input: 'capacity = 2, ops = ["put","put","get","put","get","put","get","get","get"], args = [[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]', output: '[null,null,1,null,-1,null,-1,3,4]' }
      ],
      constraints: ['1 <= capacity <= 3000', 'get and put must run in O(1) average time'],
      hints: [
        'You need O(1) lookup by key and O(1) tracking of recency order.',
        'A hash map plus a doubly linked list does this. In JavaScript a `Map` already remembers insertion order.',
        'On every use, delete the key and set it again so it moves to the "most recent" end. Evict the first key when over capacity.'
      ],
      complexity: 'O(1) per operation',
      editorial: 'Ordered maps combine hash lookup with recency order. Re-inserting a key on each access keeps the oldest entry first.',
      tests: [
        { args: [2, ['put', 'put', 'get', 'put', 'get', 'put', 'get', 'get', 'get'], [[1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]], expected: [null, null, 1, null, -1, null, -1, 3, 4] },
        { args: [1, ['put', 'put', 'get', 'get'], [[1, 1], [2, 2], [1], [2]]], expected: [null, null, -1, 2] },
        { args: [2, ['put', 'put', 'put', 'get', 'get'], [[1, 1], [2, 2], [1, 10], [1], [2]]], expected: [null, null, null, 10, 2] },
        { args: [2, ['get'], [[7]]], expected: [-1], hidden: true },
        { args: [3, ['put', 'put', 'put', 'get', 'put', 'get', 'get'], [[1, 1], [2, 2], [3, 3], [1], [4, 4], [2], [3]]], expected: [null, null, null, 1, null, -1, 3], hidden: true }
      ],
      solutions: {
        js: String.raw`function runLRUCache(capacity, ops, args) {
  const cache = new Map();
  const out = [];
  ops.forEach((op, i) => {
    if (op === 'get') {
      const key = args[i][0];
      if (!cache.has(key)) { out.push(-1); return; }
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      out.push(value);
    } else {
      const [key, value] = args[i];
      cache.delete(key);
      cache.set(key, value);
      if (cache.size > capacity) cache.delete(cache.keys().next().value);
      out.push(null);
    }
  });
  return out;
}`,
        py: String.raw`from collections import OrderedDict

def run_lru_cache(capacity, ops, args):
    cache = OrderedDict()
    out = []
    for op, a in zip(ops, args):
        if op == "get":
            key = a[0]
            if key not in cache:
                out.append(-1)
            else:
                cache.move_to_end(key)
                out.append(cache[key])
        else:
            key, value = a
            cache[key] = value
            cache.move_to_end(key)
            if len(cache) > capacity:
                cache.popitem(last=False)
            out.append(None)
    return out`
      }
    },
    {
      id: 'top-k-frequent', title: 'Top K Frequent Elements', category: 'data-structures', difficulty: 'intermediate',
      fn: 'topKFrequent', params: ['nums', 'k'],
      summary: 'Rank values by how often they occur.',
      statement: [
        'Given an integer array `nums` and an integer `k`, return the `k` most frequent values.',
        'Order the result by frequency descending. When two values have the same frequency, the smaller value comes first.'
      ],
      examples: [
        { input: 'nums = [1,1,1,2,2,3], k = 2', output: '[1, 2]' },
        { input: 'nums = [-1,-1,2,2,3], k = 1', output: '[-1]', note: 'Tie on frequency: the smaller value wins.' }
      ],
      constraints: ['1 <= k <= number of distinct values'],
      hints: [
        'First count occurrences with a hash map.',
        'Then sort the distinct values with a comparator on frequency (descending), then value (ascending).',
        'Take the first `k` of the sorted values.'
      ],
      complexity: 'O(n log n) with sorting; O(n log k) with a heap',
      editorial: 'Counting is linear. For ranking, sorting is simplest and a bounded heap is the optimisation when k is small.',
      tests: [
        { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2] },
        { args: [[1], 1], expected: [1] },
        { args: [[4, 4, 5, 5, 6], 2], expected: [4, 5] },
        { args: [[-1, -1, 2, 2, 3], 1], expected: [-1] },
        { args: [[7, 7, 7, 8, 8, 9, 9, 9, 9], 3], expected: [9, 7, 8], hidden: true }
      ],
      solutions: {
        js: String.raw`function topKFrequent(nums, k) {
  const counts = new Map();
  for (const x of nums) counts.set(x, (counts.get(x) || 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || a - b)
    .slice(0, k);
}`,
        py: String.raw`from collections import Counter

def top_k_frequent(nums, k):
    counts = Counter(nums)
    return sorted(counts, key=lambda x: (-counts[x], x))[:k]`
      }
    },
    {
      id: 'trie', title: 'Trie', category: 'data-structures', difficulty: 'advanced',
      fn: 'runTrie', params: ['ops', 'args'],
      summary: 'Store words so prefixes can be searched quickly.',
      statement: [
        'Implement a trie with `insert(word)`, `search(word)` (exact match) and `startsWith(prefix)`.',
        'Write `runTrie(ops, args)`. It applies the operations to a fresh trie and returns the results: `null` for `insert`, a boolean for the others.'
      ],
      examples: [
        { input: 'ops = ["insert","search","search","startsWith","insert","search"], args = [["apple"],["apple"],["app"],["app"],["app"],["app"]]', output: '[null,true,false,true,null,true]' }
      ],
      constraints: ['Words contain lowercase letters only'],
      hints: [
        'Each node represents one character and has children keyed by the next character.',
        'Mark nodes where a complete word ends, so "app" and "apple" are different things.',
        '`search` and `startsWith` share the same walk. They differ only in whether the final node must be marked as a word end.'
      ],
      complexity: 'O(length of word) per operation',
      editorial: 'A trie shares prefixes between words, so lookups cost the length of the query, not the number of stored words.',
      tests: [
        { args: [['insert', 'search', 'search', 'startsWith', 'insert', 'search'], [['apple'], ['apple'], ['app'], ['app'], ['app'], ['app']]], expected: [null, true, false, true, null, true] },
        { args: [['search', 'startsWith'], [['a'], ['a']]], expected: [false, false] },
        { args: [['insert', 'insert', 'startsWith', 'search', 'search'], [['car'], ['cart'], ['ca'], ['car'], ['carts']]], expected: [null, null, true, true, false], hidden: true },
        { args: [['insert', 'startsWith', 'startsWith'], [['hello'], ['hex'], ['hell']]], expected: [null, false, true], hidden: true }
      ],
      solutions: {
        js: String.raw`function runTrie(ops, args) {
  const root = { next: {}, end: false };
  function walk(s) {
    let node = root;
    for (const ch of s) {
      node = node.next[ch];
      if (!node) return null;
    }
    return node;
  }
  const out = [];
  ops.forEach((op, i) => {
    const s = args[i][0];
    if (op === 'insert') {
      let node = root;
      for (const ch of s) {
        if (!node.next[ch]) node.next[ch] = { next: {}, end: false };
        node = node.next[ch];
      }
      node.end = true;
      out.push(null);
    } else if (op === 'search') {
      const node = walk(s);
      out.push(!!node && node.end);
    } else {
      out.push(walk(s) !== null);
    }
  });
  return out;
}`,
        py: String.raw`def run_trie(ops, args):
    root = {"next": {}, "end": False}

    def walk(s):
        node = root
        for ch in s:
            node = node["next"].get(ch)
            if node is None:
                return None
        return node

    out = []
    for op, a in zip(ops, args):
        s = a[0]
        if op == "insert":
            node = root
            for ch in s:
                node = node["next"].setdefault(ch, {"next": {}, "end": False})
            node["end"] = True
            out.append(None)
        elif op == "search":
            node = walk(s)
            out.append(bool(node and node["end"]))
        else:
            out.append(walk(s) is not None)
    return out`
      }
    }
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);
