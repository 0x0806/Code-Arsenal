/* Code Arsenal problem bank: dynamic programming + machine learning. */
(function (root) {
  var reg = (root.CA_PROBLEMS_REG = root.CA_PROBLEMS_REG || []);
  reg.push(
    {
      id: 'climbing-stairs', title: 'Climbing Stairs', category: 'dynamic-programming', difficulty: 'beginner',
      fn: 'climbStairs', params: ['n'],
      summary: 'Count the ways to climb a staircase taking one or two steps at a time.',
      statement: [
        'You are climbing a staircase with `n` steps. Each move climbs 1 or 2 steps. Return the number of distinct ways to reach the top.'
      ],
      examples: [
        { input: 'n = 3', output: '3', note: '1+1+1, 1+2, 2+1' }
      ],
      constraints: ['1 <= n <= 45'],
      hints: [
        'To stand on step `n` you came from step `n - 1` or from step `n - 2`.',
        'So `ways(n) = ways(n - 1) + ways(n - 2)`. That is the Fibonacci recurrence.',
        'You only need the previous two values, so two variables are enough.'
      ],
      complexity: 'O(n) time, O(1) space',
      editorial: 'Overlapping subproblems collapse into a rolling pair of values. Without memoisation the recursion would repeat work exponentially.',
      tests: [
        { args: [1], expected: 1 },
        { args: [2], expected: 2 },
        { args: [3], expected: 3 },
        { args: [5], expected: 8 },
        { args: [10], expected: 89 },
        { args: [30], expected: 1346269, hidden: true },
        { args: [45], expected: 1836311903, hidden: true }
      ],
      solutions: {
        js: String.raw`function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}`,
        py: String.raw`def climb_stairs(n):
    a, b = 1, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b`
      }
    },
    {
      id: 'max-subarray', title: 'Maximum Subarray', category: 'dynamic-programming', difficulty: 'beginner',
      fn: 'maxSubArray', params: ['nums'],
      summary: 'Find the contiguous slice with the largest sum.',
      statement: [
        'Given an integer array `nums`, find the contiguous non-empty subarray with the largest sum and return that sum.'
      ],
      examples: [
        { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', note: '[4,-1,2,1]' }
      ],
      constraints: ['1 <= nums.length <= 10^5'],
      hints: [
        'At each position, the best subarray ending here either extends the previous one or starts fresh.',
        'Track `current = max(x, current + x)`.',
        'Keep a separate `best` that records the largest `current` seen. Start both from `nums[0]`, not from 0.'
      ],
      complexity: 'O(n) time, O(1) space',
      editorial: 'This is Kadane\'s algorithm: a one-dimensional DP where the state is "best sum ending at i".',
      tests: [
        { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
        { args: [[1]], expected: 1 },
        { args: [[5, 4, -1, 7, 8]], expected: 23 },
        { args: [[-3, -2, -1]], expected: -1 },
        { args: [[-2, -1]], expected: -1, hidden: true },
        { args: [[8, -19, 5, -4, 20]], expected: 21, hidden: true }
      ],
      solutions: {
        js: String.raw`function maxSubArray(nums) {
  let current = nums[0], best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}`,
        py: String.raw`def max_sub_array(nums):
    current = best = nums[0]
    for x in nums[1:]:
        current = max(x, current + x)
        best = max(best, current)
    return best`
      }
    },
    {
      id: 'coin-change', title: 'Coin Change', category: 'dynamic-programming', difficulty: 'intermediate',
      fn: 'coinChange', params: ['coins', 'amount'],
      summary: 'Make an amount with the fewest coins.',
      statement: [
        'Given coin denominations `coins` and a target `amount`, return the fewest coins needed to make exactly that amount, or `-1` if it is impossible.',
        'You have an unlimited supply of each coin.'
      ],
      examples: [
        { input: 'coins = [1,2,5], amount = 11', output: '3', note: '5 + 5 + 1' },
        { input: 'coins = [2], amount = 3', output: '-1' }
      ],
      constraints: ['1 <= coins.length <= 12', '0 <= amount <= 10^4'],
      hints: [
        'A greedy "largest coin first" strategy fails for coins like [1, 3, 4] and amount 6.',
        'Let `dp[a]` be the fewest coins for amount `a`. `dp[0] = 0`.',
        'For each `a`, try every coin `c <= a`: `dp[a] = min(dp[a], dp[a - c] + 1)`. Initialise the rest to Infinity.'
      ],
      complexity: 'O(amount × coins) time, O(amount) space',
      editorial: 'Bottom-up DP over amounts explores every way to finish the last coin, so it finds the true minimum where greedy cannot.',
      tests: [
        { args: [[1, 2, 5], 11], expected: 3 },
        { args: [[2], 3], expected: -1 },
        { args: [[1], 0], expected: 0 },
        { args: [[1, 3, 4], 6], expected: 2 },
        { args: [[186, 419, 83, 408], 6249], expected: 20, hidden: true },
        { args: [[2, 5, 10, 1], 27], expected: 4, hidden: true }
      ],
      solutions: {
        js: String.raw`function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}`,
        py: String.raw`def coin_change(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return -1 if dp[amount] == INF else dp[amount]`
      }
    },
    {
      id: 'longest-common-subsequence', title: 'Longest Common Subsequence', category: 'dynamic-programming', difficulty: 'intermediate',
      fn: 'lcsLength', params: ['a', 'b'],
      summary: 'Length of the longest sequence shared by two strings, in order.',
      statement: [
        'Return the length of the longest common subsequence of strings `a` and `b`.',
        'A subsequence keeps the original order of characters but may skip some.'
      ],
      examples: [
        { input: 'a = "abcde", b = "ace"', output: '3' },
        { input: 'a = "abc", b = "def"', output: '0' }
      ],
      constraints: ['0 <= a.length, b.length <= 1000'],
      hints: [
        'Compare the last characters of both strings. What happens if they match? If they differ?',
        'Define `dp[i][j]` as the answer for the first `i` characters of `a` and first `j` of `b`.',
        'If `a[i-1] === b[j-1]` then `dp[i][j] = dp[i-1][j-1] + 1`, else `max(dp[i-1][j], dp[i][j-1])`.'
      ],
      complexity: 'O(n × m) time and space',
      editorial: 'The table records the best answer for every pair of prefixes, so each cell needs only three neighbours.',
      tests: [
        { args: ['abcde', 'ace'], expected: 3 },
        { args: ['abc', 'abc'], expected: 3 },
        { args: ['abc', 'def'], expected: 0 },
        { args: ['', 'a'], expected: 0 },
        { args: ['AGGTAB', 'GXTXAYB'], expected: 4 },
        { args: ['bl', 'yby'], expected: 1, hidden: true },
        { args: ['oxcpqrsvwf', 'shmtulqrypy'], expected: 2, hidden: true }
      ],
      solutions: {
        js: String.raw`function lcsLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}`,
        py: String.raw`def lcs_length(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]`
      }
    },
    {
      id: 'edit-distance', title: 'Edit Distance', category: 'dynamic-programming', difficulty: 'expert',
      fn: 'editDistance', params: ['a', 'b'],
      summary: 'Fewest single-character edits to turn one string into another.',
      statement: [
        'Return the minimum number of operations needed to convert string `a` into string `b`. The allowed operations are insert a character, delete a character, and replace a character.'
      ],
      examples: [
        { input: 'a = "horse", b = "ros"', output: '3', note: 'horse → rorse → rose → ros' }
      ],
      constraints: ['0 <= a.length, b.length <= 500'],
      hints: [
        'Let `dp[i][j]` be the distance between the first `i` characters of `a` and the first `j` of `b`.',
        'Base cases: `dp[i][0] = i` (delete everything) and `dp[0][j] = j` (insert everything).',
        'If the characters match, `dp[i][j] = dp[i-1][j-1]`. Otherwise it is `1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])`.'
      ],
      complexity: 'O(n × m) time; O(m) space with a rolling row',
      editorial: 'Delete, insert and replace correspond to moving up, left and diagonally in the table, each costing one.',
      tests: [
        { args: ['horse', 'ros'], expected: 3 },
        { args: ['intention', 'execution'], expected: 5 },
        { args: ['', 'abc'], expected: 3 },
        { args: ['abc', ''], expected: 3 },
        { args: ['kitten', 'sitting'], expected: 3 },
        { args: ['sunday', 'saturday'], expected: 3, hidden: true },
        { args: ['a', 'a'], expected: 0, hidden: true }
      ],
      solutions: {
        js: String.raw`function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}`,
        py: String.raw`def edit_distance(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        dp[i][0] = i
    for j in range(len(b) + 1):
        dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[len(a)][len(b)]`
      }
    },

    /* ---------------------------- Machine learning ---------------------------- */
    {
      id: 'mean-squared-error', title: 'Mean Squared Error', category: 'machine-learning', difficulty: 'beginner',
      fn: 'meanSquaredError', params: ['yTrue', 'yPred'],
      summary: 'The standard loss for regression.',
      statement: [
        'Given two equal-length arrays of numbers, `yTrue` and `yPred`, return the mean of the squared differences between them.',
        'Return `0` for empty arrays.'
      ],
      examples: [
        { input: 'yTrue = [3, -0.5, 2, 7], yPred = [2.5, 0, 2, 8]', output: '0.375' }
      ],
      constraints: ['Arrays have equal length'],
      hints: [
        'Subtract, square, then average.',
        'Sum `(yTrue[i] - yPred[i])²` over all positions.',
        'Divide by the length, but guard against dividing by zero for empty input.'
      ],
      complexity: 'O(n)',
      editorial: 'Squaring penalises large errors more than small ones, which is why MSE is sensitive to outliers.',
      tests: [
        { args: [[3, -0.5, 2, 7], [2.5, 0, 2, 8]], expected: 0.375 },
        { args: [[1, 2, 3], [1, 2, 3]], expected: 0 },
        { args: [[0], [2]], expected: 4 },
        { args: [[], []], expected: 0, hidden: true },
        { args: [[1, 2, 3, 4], [2, 4, 6, 8]], expected: 7.5, hidden: true }
      ],
      solutions: {
        js: String.raw`function meanSquaredError(yTrue, yPred) {
  if (!yTrue.length) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) sum += (yTrue[i] - yPred[i]) ** 2;
  return sum / yTrue.length;
}`,
        py: String.raw`def mean_squared_error(y_true, y_pred):
    if not y_true:
        return 0
    return sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)`
      }
    },
    {
      id: 'softmax', title: 'Softmax', category: 'machine-learning', difficulty: 'intermediate',
      fn: 'softmax', params: ['logits'],
      summary: 'Turn raw scores into probabilities without overflowing.',
      statement: [
        'Given an array of real numbers `logits`, return the softmax: `exp(x_i) / Σ exp(x_j)`.',
        'Your function must be numerically stable. `[1000, 1000]` must return `[0.5, 0.5]`, not `NaN`.',
        'Results are compared with a tolerance of 1e-6.'
      ],
      examples: [
        { input: 'logits = [1, 2, 3]', output: '[0.0900306, 0.2447285, 0.6652410]' }
      ],
      constraints: ['1 <= logits.length <= 1000'],
      hints: [
        '`exp(1000)` overflows to Infinity, and Infinity / Infinity is NaN.',
        'Subtracting a constant from every logit does not change the softmax result.',
        'Subtract `max(logits)` first so the largest exponent is `exp(0) = 1`.'
      ],
      complexity: 'O(n)',
      editorial: 'Softmax is shift-invariant. Subtracting the max keeps every exponent in (0, 1], which removes overflow without changing the answer.',
      tests: [
        { args: [[1, 2, 3]], expected: [0.0900306, 0.2447285, 0.665241] },
        { args: [[0, 0, 0, 0]], expected: [0.25, 0.25, 0.25, 0.25] },
        { args: [[1000, 1000]], expected: [0.5, 0.5] },
        { args: [[10, 0]], expected: [0.9999546, 0.0000454], hidden: true },
        { args: [[5]], expected: [1], hidden: true }
      ],
      solutions: {
        js: String.raw`function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}`,
        py: String.raw`import math

def softmax(logits):
    m = max(logits)
    exps = [math.exp(x - m) for x in logits]
    total = sum(exps)
    return [e / total for e in exps]`
      }
    },
    {
      id: 'linear-regression-fit', title: 'Linear Regression Fit', category: 'machine-learning', difficulty: 'intermediate',
      fn: 'fitLine', params: ['xs', 'ys'],
      summary: 'Closed-form least squares for one feature.',
      statement: [
        'Given arrays `xs` and `ys`, fit the line `y = slope * x + intercept` by ordinary least squares and return `[slope, intercept]`.',
        'Use the closed form: `slope = Σ(x - x̄)(y - ȳ) / Σ(x - x̄)²`, `intercept = ȳ - slope * x̄`.',
        'Results are compared with a tolerance of 1e-6.'
      ],
      examples: [
        { input: 'xs = [1,2,3,4,5], ys = [2,4,5,4,5]', output: '[0.6, 2.2]' }
      ],
      constraints: ['At least two distinct x values'],
      hints: [
        'Compute the mean of `xs` and the mean of `ys` first.',
        'Accumulate the numerator `Σ(x - x̄)(y - ȳ)` and the denominator `Σ(x - x̄)²` in one loop.',
        'The intercept falls out once you know the slope: the line passes through `(x̄, ȳ)`.'
      ],
      complexity: 'O(n)',
      editorial: 'The least-squares line always passes through the centroid of the data, so one covariance ratio determines it.',
      tests: [
        { args: [[1, 2, 3, 4], [2, 4, 6, 8]], expected: [2, 0] },
        { args: [[0, 1, 2], [1, 3, 5]], expected: [2, 1] },
        { args: [[1, 2, 3], [2, 2, 2]], expected: [0, 2] },
        { args: [[1, 2, 3, 4, 5], [2, 4, 5, 4, 5]], expected: [0.6, 2.2] },
        { args: [[10, 20, 30], [15, 25, 35]], expected: [1, 5], hidden: true },
        { args: [[1, 2, 3], [6, 4, 2]], expected: [-2, 8], hidden: true }
      ],
      solutions: {
        js: String.raw`function fitLine(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = num / den;
  return [slope, my - slope * mx];
}`,
        py: String.raw`def fit_line(xs, ys):
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    slope = num / den
    return [slope, my - slope * mx]`
      }
    },
    {
      id: 'knn-classify', title: 'k-Nearest Neighbours', category: 'machine-learning', difficulty: 'intermediate',
      fn: 'knnClassify', params: ['points', 'query', 'k'],
      summary: 'Classify a point by majority vote of its closest neighbours.',
      statement: [
        'Each training point is `[x, y, label]`. Given a `query` `[x, y]` and an integer `k`, find the `k` points nearest in Euclidean distance and return the most common label among them.',
        'If two labels tie, return the one that sorts first alphabetically. Test data never has ties in distance at the k-th boundary.'
      ],
      examples: [
        { input: 'points = [[1,1,"A"],[1,2,"A"],[5,5,"B"],[6,5,"B"]], query = [4.5,4.5], k = 3', output: '"B"' }
      ],
      constraints: ['1 <= k <= points.length'],
      hints: [
        'You do not need the square root to compare distances. Squared distance preserves the order.',
        'Sort the training points by distance to the query and keep the first `k`.',
        'Count labels in a map. Pick the highest count; break ties with the alphabetically smaller label.'
      ],
      complexity: 'O(n log n) per query',
      editorial: 'kNN has no training step. All the work happens at query time, which is why it gets slow on large datasets.',
      tests: [
        { args: [[[1, 1, 'A'], [1, 2, 'A'], [5, 5, 'B'], [6, 5, 'B']], [1.5, 1.5], 3], expected: 'A' },
        { args: [[[1, 1, 'A'], [1, 2, 'A'], [5, 5, 'B'], [6, 5, 'B']], [4.5, 4.5], 3], expected: 'B' },
        { args: [[[1, 1, 'A'], [1, 2, 'A'], [5, 5, 'B'], [6, 5, 'B']], [5.5, 5], 1], expected: 'B' },
        { args: [[[1, 1, 'A'], [1, 2, 'A'], [5, 5, 'B'], [6, 5, 'B']], [3.2, 3], 2], expected: 'A', hidden: true },
        { args: [[[0, 0, 'x']], [10, 10], 1], expected: 'x', hidden: true }
      ],
      solutions: {
        js: String.raw`function knnClassify(points, query, k) {
  const near = points
    .map(([x, y, label]) => ({ label, d: (x - query[0]) ** 2 + (y - query[1]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  const votes = {};
  for (const p of near) votes[p.label] = (votes[p.label] || 0) + 1;
  return Object.keys(votes).sort((a, b) => votes[b] - votes[a] || (a < b ? -1 : 1))[0];
}`,
        py: String.raw`def knn_classify(points, query, k):
    near = sorted(points, key=lambda p: (p[0] - query[0]) ** 2 + (p[1] - query[1]) ** 2)[:k]
    votes = {}
    for p in near:
        votes[p[2]] = votes.get(p[2], 0) + 1
    return sorted(votes, key=lambda label: (-votes[label], label))[0]`
      }
    },
    {
      id: 'kmeans-step', title: 'k-Means: One Iteration', category: 'machine-learning', difficulty: 'advanced',
      fn: 'kmeansStep', params: ['points', 'centroids'],
      summary: 'Assign points to the nearest centroid, then move each centroid.',
      statement: [
        'Perform a single k-means iteration. Assign every 2D point to its nearest centroid (squared Euclidean distance; on a tie pick the lower index). Then return the new centroids: the mean of the points assigned to each.',
        'A centroid that receives no points stays where it was. Results are compared with a tolerance of 1e-6.'
      ],
      examples: [
        { input: 'points = [[1,1],[1,2],[8,8],[9,8]], centroids = [[0,0],[10,10]]', output: '[[1,1.5],[8.5,8]]' }
      ],
      constraints: ['1 <= centroids.length <= points.length'],
      hints: [
        'Split the work in two phases: assignment, then update.',
        'Build one bucket of points per centroid while scanning the points once.',
        'For each bucket, average x and y separately. If the bucket is empty, copy the old centroid.'
      ],
      complexity: 'O(n × k)',
      editorial: 'k-means alternates these two steps until nothing changes. Handling empty clusters explicitly avoids dividing by zero.',
      tests: [
        { args: [[[1, 1], [1, 2], [8, 8], [9, 8]], [[0, 0], [10, 10]]], expected: [[1, 1.5], [8.5, 8]] },
        { args: [[[1, 1], [2, 2], [3, 3]], [[1, 1], [100, 100]]], expected: [[2, 2], [100, 100]] },
        { args: [[[0, 0], [4, 0]], [[1, 0]]], expected: [[2, 0]] },
        { args: [[[0, 0], [2, 0]], [[1, 0], [1, 0]]], expected: [[1, 0], [1, 0]], hidden: true },
        { args: [[[5, 5], [6, 6], [-5, -5]], [[5, 5], [-5, -5]]], expected: [[5.5, 5.5], [-5, -5]], hidden: true }
      ],
      solutions: {
        js: String.raw`function kmeansStep(points, centroids) {
  const buckets = centroids.map(() => []);
  for (const p of points) {
    let best = 0, bestD = Infinity;
    centroids.forEach((c, i) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    buckets[best].push(p);
  }
  return buckets.map((b, i) => {
    if (!b.length) return [centroids[i][0], centroids[i][1]];
    return [
      b.reduce((s, p) => s + p[0], 0) / b.length,
      b.reduce((s, p) => s + p[1], 0) / b.length
    ];
  });
}`,
        py: String.raw`def kmeans_step(points, centroids):
    buckets = [[] for _ in centroids]
    for p in points:
        best, best_d = 0, float("inf")
        for i, c in enumerate(centroids):
            d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2
            if d < best_d:
                best_d, best = d, i
        buckets[best].append(p)
    out = []
    for i, b in enumerate(buckets):
        if not b:
            out.append([centroids[i][0], centroids[i][1]])
        else:
            out.append([sum(p[0] for p in b) / len(b), sum(p[1] for p in b) / len(b)])
    return out`
      }
    }
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);
