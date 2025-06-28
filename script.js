
// CODE ARSENAL - Advanced Learning Platform JavaScript
// Developed by 0X0806

class CodeArsenal {
    constructor() {
        try {
            this.currentUser = this.initializeUser();
            this.challenges = this.generateChallenges();
            this.leaderboard = this.generateLeaderboard();
            this.currentChallenge = null;
            this.matrixEffect = null;
            this.xpMultiplier = 1.0;
            this.streakBonus = 0;
            
            // Initialize systems with better error handling
            this.achievementSystem = new AchievementSystem();
            this.statsTracker = new StatsTracker();
            
            // Initialize the application
            this.init();
        } catch (error) {
            console.error('CodeArsenal initialization error:', error);
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        // Fallback initialization for critical errors
        this.currentUser = this.createNewUser();
        this.challenges = [];
        this.leaderboard = [];
        this.achievementSystem = { 
            checkAchievements: () => {}, 
            unlock: () => {},
            getProgress: () => ({ total: 0, unlocked: 0, percentage: 0 })
        };
        this.statsTracker = { 
            trackChallengeSolved: () => {},
            getInsights: () => ({})
        };
        
        // Show error notification
        setTimeout(() => {
            this.showNotification('⚠️ Some features may be limited due to initialization errors. Please refresh if issues persist.', 'warning');
        }, 1000);
        
        // Try to initialize basic functionality
        try {
            this.initEventListeners();
            this.updateUserStats();
        } catch (e) {
            console.error('Failed to initialize basic functionality:', e);
        }
    }

    // Initialize new user or load existing user data
    initializeUser() {
        const savedUser = localStorage.getItem('codeArsenalUser');
        
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                
                // Validate and fix corrupted user data
                const validatedUser = this.validateUserData(user);
                
                // Ensure all required properties exist with proper defaults
                return {
                    id: validatedUser.id || 1,
                    username: validatedUser.username || 'NewCoder',
                    xp: Math.max(0, validatedUser.xp || 0),
                    level: Math.max(1, validatedUser.level || 1),
                    streak: Math.max(0, validatedUser.streak || 0),
                    challengesSolved: Math.max(0, validatedUser.challengesSolved || 0),
                    successRate: Math.min(100, Math.max(0, validatedUser.successRate || 0)),
                    languagesMastered: Math.max(0, validatedUser.languagesMastered || 0),
                    achievements: Array.isArray(validatedUser.achievements) ? validatedUser.achievements : [],
                    rank: validatedUser.rank || this.calculateRankFromLevel(validatedUser.level || 1),
                    totalXP: Math.max(0, validatedUser.totalXP || validatedUser.xp || 0),
                    weeklyXP: Math.max(0, validatedUser.weeklyXP || 0),
                    monthlyXP: Math.max(0, validatedUser.monthlyXP || 0),
                    dailyStreak: Math.max(0, validatedUser.dailyStreak || 0),
                    maxStreak: Math.max(0, validatedUser.maxStreak || validatedUser.streak || 0),
                    fastestSolve: validatedUser.fastestSolve || null,
                    avgSolveTime: Math.max(0, validatedUser.avgSolveTime || 0),
                    certifications: Array.isArray(validatedUser.certifications) ? validatedUser.certifications : [],
                    skillPoints: this.validateSkillPoints(validatedUser.skillPoints),
                    categoryStats: this.validateCategoryStats(validatedUser.categoryStats),
                    joinDate: validatedUser.joinDate || new Date().toISOString(),
                    lastLoginDate: new Date().toISOString(),
                    totalSessions: Math.max(1, validatedUser.totalSessions || 1)
                };
            } catch (error) {
                console.warn('Corrupted user data found, resetting to default:', error);
                localStorage.removeItem('codeArsenalUser');
                return this.createNewUser();
            }
        } else {
            return this.createNewUser();
        }
    }
    
    // Create a completely new user with proper defaults
    createNewUser() {
        const newUser = {
            id: 1,
            username: 'NewCoder',
            xp: 0,
            level: 1,
            streak: 0,
            challengesSolved: 0,
            successRate: 0,
            languagesMastered: 0,
            achievements: [],
            rank: 'Rookie',
            totalXP: 0,
            weeklyXP: 0,
            monthlyXP: 0,
            dailyStreak: 0,
            maxStreak: 0,
            fastestSolve: null,
            avgSolveTime: 0,
            certifications: [],
            joinDate: new Date().toISOString(),
            lastLoginDate: new Date().toISOString(),
            totalSessions: 1,
            skillPoints: {
                algorithms: 0,
                dataStructures: 0,
                webDev: 0,
                cybersecurity: 0,
                machineLearning: 0,
                databases: 0,
                mobileDev: 0,
                dynamicProgramming: 0
            },
            categoryStats: {
                algorithms: { solved: 0, attempted: 0, xp: 0 },
                'data-structures': { solved: 0, attempted: 0, xp: 0 },
                'web-development': { solved: 0, attempted: 0, xp: 0 },
                cybersecurity: { solved: 0, attempted: 0, xp: 0 },
                'machine-learning': { solved: 0, attempted: 0, xp: 0 },
                databases: { solved: 0, attempted: 0, xp: 0 },
                'mobile-development': { solved: 0, attempted: 0, xp: 0 },
                'dynamic-programming': { solved: 0, attempted: 0, xp: 0 }
            }
        };
        
        // Save immediately to localStorage
        this.saveUserData(newUser);
        return newUser;
    }
    
    // Validate user data integrity
    validateUserData(user) {
        if (!user || typeof user !== 'object') {
            throw new Error('Invalid user data structure');
        }
        
        // Ensure XP consistency
        if (user.totalXP < user.xp) {
            user.totalXP = user.xp || 0;
        }
        
        // Ensure level consistency with XP
        const calculatedLevel = this.calculateLevel(user.totalXP || 0);
        if (Math.abs(user.level - calculatedLevel) > 1) {
            user.level = calculatedLevel;
        }
        
        return user;
    }
    
    // Validate skill points data
    validateSkillPoints(skillPoints) {
        const defaultSkills = {
            algorithms: 0,
            dataStructures: 0,
            webDev: 0,
            cybersecurity: 0,
            machineLearning: 0,
            databases: 0,
            mobileDev: 0,
            dynamicProgramming: 0
        };
        
        if (!skillPoints || typeof skillPoints !== 'object') {
            return defaultSkills;
        }
        
        // Ensure all skills exist and are valid numbers
        Object.keys(defaultSkills).forEach(skill => {
            if (typeof skillPoints[skill] !== 'number' || skillPoints[skill] < 0 || skillPoints[skill] > 100) {
                skillPoints[skill] = 0;
            }
        });
        
        return { ...defaultSkills, ...skillPoints };
    }
    
    // Validate category stats data
    validateCategoryStats(categoryStats) {
        const categories = [
            'algorithms', 'data-structures', 'web-development', 'cybersecurity',
            'machine-learning', 'databases', 'mobile-development', 'dynamic-programming'
        ];
        
        const defaultStats = { solved: 0, attempted: 0, xp: 0 };
        const validatedStats = {};
        
        categories.forEach(category => {
            if (!categoryStats || !categoryStats[category]) {
                validatedStats[category] = { ...defaultStats };
            } else {
                const stats = categoryStats[category];
                validatedStats[category] = {
                    solved: Math.max(0, stats.solved || 0),
                    attempted: Math.max(0, stats.attempted || 0),
                    xp: Math.max(0, stats.xp || 0)
                };
                
                // Ensure attempted >= solved
                if (validatedStats[category].attempted < validatedStats[category].solved) {
                    validatedStats[category].attempted = validatedStats[category].solved;
                }
            }
        });
        
        return validatedStats;
    }
    
    // Calculate rank from level
    calculateRankFromLevel(level) {
        const ranks = [
            { level: 1, name: 'Rookie' },
            { level: 5, name: 'Code Cadet' },
            { level: 10, name: 'Developer' },
            { level: 15, name: 'Code Warrior' },
            { level: 25, name: 'Senior Developer' },
            { level: 35, name: 'Tech Lead' },
            { level: 50, name: 'Code Master' },
            { level: 75, name: 'Programming Guru' },
            { level: 100, name: 'Code Legend' }
        ];
        
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (level >= ranks[i].level) {
                return ranks[i].name;
            }
        }
        return 'Rookie';
    }

    // Save user data to localStorage with validation
    saveUserData(userData = null) {
        const userToSave = userData || this.currentUser;
        
        // Validate data before saving
        if (!userToSave || typeof userToSave !== 'object') {
            console.error('Invalid user data, cannot save');
            return false;
        }
        
        try {
            // Ensure data integrity before saving
            const validatedUser = {
                ...userToSave,
                xp: Math.max(0, userToSave.xp || 0),
                level: Math.max(1, userToSave.level || 1),
                totalXP: Math.max(0, userToSave.totalXP || userToSave.xp || 0),
                challengesSolved: Math.max(0, userToSave.challengesSolved || 0),
                lastSaveDate: new Date().toISOString()
            };
            
            localStorage.setItem('codeArsenalUser', JSON.stringify(validatedUser));
            return true;
        } catch (error) {
            console.error('Failed to save user data:', error);
            return false;
        }
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        try {
            this.initEventListeners();
            this.initMatrixEffect();
            this.renderChallenges();
            this.renderLeaderboard();
            this.initTerminal();
            this.initAIAssistant();
            this.updateUserStats();
            this.showWelcomeNotification();
        } catch (error) {
            console.error('Component initialization error:', error);
            this.showNotification('Some components failed to load. Please refresh the page.', 'error');
        }
    }

    // Event Listeners with safe DOM access
    initEventListeners() {
        try {
            // Navigation
            const navItems = document.querySelectorAll('.nav-item');
            if (navItems.length > 0) {
                navItems.forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const href = e.target.getAttribute('href');
                        if (href) {
                            const section = href.substring(1);
                            this.switchSection(section);
                        }
                    });
                });
            }

            // Modal controls
            const closeModal = document.querySelector('.close-modal');
            if (closeModal) {
                closeModal.addEventListener('click', () => {
                    this.closeCodeEditor();
                });
            }

        // Challenge filters
        document.getElementById('category-filter')?.addEventListener('change', () => {
            this.filterChallenges();
        });

        document.getElementById('difficulty-filter')?.addEventListener('change', () => {
            this.filterChallenges();
        });

        // Leaderboard tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.leaderboard-tabs')) {
                    this.switchLeaderboardTab(e.target.dataset.tab);
                }
            });
        });

        // Code editor controls
        document.getElementById('run-code')?.addEventListener('click', () => {
            this.runCode();
        });

        document.getElementById('submit-code')?.addEventListener('click', () => {
            this.submitCode();
        });

        document.getElementById('get-hint')?.addEventListener('click', () => {
            this.getHint();
        });

        // Chat functionality
            const sendChatBtn = document.getElementById('send-chat');
            const chatInput = document.getElementById('chat-input');
            
            if (sendChatBtn) {
                sendChatBtn.addEventListener('click', () => {
                    this.sendChatMessage();
                });
            }

            if (chatInput) {
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.sendChatMessage();
                    }
                });
            }

            // Terminal input
            const terminalInput = document.getElementById('terminal-input');
            if (terminalInput) {
                terminalInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.executeTerminalCommand(e.target.value);
                        e.target.value = '';
                    }
                });
            }
        } catch (error) {
            console.error('Event listener initialization error:', error);
        }
    }

    // Matrix Rain Effect
    initMatrixEffect() {
        const container = document.getElementById('matrix-rain');
        if (!container) return;

        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
        const columns = Math.floor(window.innerWidth / 14);

        for (let i = 0; i < columns; i++) {
            const column = document.createElement('div');
            column.className = 'matrix-column';
            column.style.left = i * 14 + 'px';
            column.style.animationDuration = (Math.random() * 3 + 2) + 's';
            column.style.animationDelay = Math.random() * 2 + 's';
            
            // Add random characters
            let text = '';
            for (let j = 0; j < 30; j++) {
                text += chars.charAt(Math.floor(Math.random() * chars.length)) + '<br>';
            }
            column.innerHTML = text;
            
            container.appendChild(column);
        }
    }

    // Generate 5000+ Challenges
    generateChallenges() {
        const categories = [
            'algorithms', 'data-structures', 'dynamic-programming', 'machine-learning',
            'web-development', 'databases', 'cybersecurity', 'mobile-development'
        ];
        
        const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
        const challenges = [];

        const challengeTemplates = {
            algorithms: [
                'Two Sum', 'Three Sum', 'Merge Sort', 'Quick Sort', 'Binary Search',
                'Depth First Search', 'Breadth First Search', 'Dijkstra Algorithm',
                'A* Search', 'Minimax Algorithm'
            ],
            'data-structures': [
                'Implement Stack', 'Implement Queue', 'Binary Tree Traversal',
                'Hash Table Implementation', 'Linked List Operations',
                'Heap Implementation', 'Trie Data Structure', 'Graph Representation'
            ],
            'dynamic-programming': [
                'Fibonacci Sequence', 'Longest Common Subsequence', 'Knapsack Problem',
                'Edit Distance', 'Coin Change', 'Maximum Subarray'
            ],
            'machine-learning': [
                'Linear Regression', 'K-Means Clustering', 'Decision Trees',
                'Neural Network Basics', 'Feature Selection', 'Cross Validation'
            ],
            'web-development': [
                'REST API Design', 'Authentication System', 'Responsive Layout',
                'State Management', 'Performance Optimization', 'SEO Implementation'
            ],
            databases: [
                'SQL Queries', 'Database Design', 'Indexing Strategies',
                'Transaction Management', 'Normalization', 'Query Optimization'
            ],
            cybersecurity: [
                'Encryption Algorithms', 'Vulnerability Assessment', 'Secure Coding',
                'Penetration Testing', 'Network Security', 'Cryptography'
            ],
            'mobile-development': [
                'UI Components', 'State Management', 'API Integration',
                'Push Notifications', 'Offline Storage', 'Performance Optimization'
            ]
        };

        let id = 1;
        for (let i = 0; i < 5000; i++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
            const templates = challengeTemplates[category];
            const template = templates[Math.floor(Math.random() * templates.length)];
            
            const xpReward = this.calculateXPReward(difficulty);
            
            const xpRewardData = this.calculateXPReward(difficulty, category);
            
            challenges.push({
                id: id++,
                title: `${template} ${i + 1}`,
                description: `Solve the ${template.toLowerCase()} problem with optimal time complexity.`,
                category,
                difficulty,
                xpReward: xpRewardData.baseXP,
                completed: false,
                rating: Math.floor(Math.random() * 5) + 1,
                solvers: Math.floor(Math.random() * 1000) + 50,
                attempts: 0,
                startTime: null,
                completedAt: null,
                solveTime: null
            });
        }

        return challenges;
    }

    calculateXPReward(difficulty, category = 'algorithms', timeSpent = 600, attempts = 1) {
        // Ensure valid inputs
        if (!difficulty) difficulty = 'beginner';
        if (!category) category = 'algorithms';
        if (!timeSpent || timeSpent < 1) timeSpent = 600;
        if (!attempts || attempts < 1) attempts = 1;
        
        const baseRewards = {
            beginner: 25,
            intermediate: 50,
            advanced: 100,
            expert: 200
        };
        
        const categoryMultipliers = {
            algorithms: 1.2,
            'data-structures': 1.1,
            'dynamic-programming': 1.3,
            'machine-learning': 1.4,
            'web-development': 1.0,
            databases: 1.1,
            cybersecurity: 1.3,
            'mobile-development': 1.1
        };
        
        let baseXP = baseRewards[difficulty] || 25;
        let categoryMultiplier = categoryMultipliers[category] || 1.0;
        
        // Time bonus calculation (faster solve = more XP)
        let timeBonus = 1.0;
        if (timeSpent < 120) timeBonus = 1.8;      // Under 2 minutes - exceptional
        else if (timeSpent < 300) timeBonus = 1.5; // Under 5 minutes - excellent
        else if (timeSpent < 600) timeBonus = 1.3; // Under 10 minutes - good
        else if (timeSpent < 900) timeBonus = 1.1; // Under 15 minutes - decent
        else if (timeSpent > 1800) timeBonus = 0.8; // Over 30 minutes - penalty
        
        // Attempt penalty (fewer attempts = more XP)
        let attemptMultiplier = Math.max(0.3, 1.2 - ((attempts - 1) * 0.2));
        
        // Streak bonus (properly capped and scaled)
        let streakMultiplier = 1.0 + Math.min((this.currentUser?.streak || 0) * 0.05, 2.0);
        
        // Global XP multiplier from level progression
        let globalMultiplier = this.xpMultiplier || 1.0;
        
        // Calculate individual bonus values for display
        let categoryBonusXP = Math.round(baseXP * (categoryMultiplier - 1.0));
        let timeBonusXP = Math.round(baseXP * categoryMultiplier * (timeBonus - 1.0));
        let attemptPenaltyXP = Math.round(baseXP * categoryMultiplier * timeBonus * (attemptMultiplier - 1.0));
        let streakBonusXP = Math.round(baseXP * categoryMultiplier * timeBonus * attemptMultiplier * (streakMultiplier - 1.0));
        
        // Calculate final XP with all multipliers
        let finalXP = Math.max(5, Math.round(
            baseXP * 
            categoryMultiplier * 
            timeBonus * 
            attemptMultiplier * 
            streakMultiplier * 
            globalMultiplier
        ));
        
        return {
            baseXP,
            categoryBonus: categoryBonusXP,
            timeBonus: timeBonusXP,
            attemptPenalty: attemptPenaltyXP,
            streakBonus: streakBonusXP,
            finalXP,
            breakdown: {
                base: baseXP,
                afterCategory: Math.round(baseXP * categoryMultiplier),
                afterTime: Math.round(baseXP * categoryMultiplier * timeBonus),
                afterAttempts: Math.round(baseXP * categoryMultiplier * timeBonus * attemptMultiplier),
                afterStreak: Math.round(baseXP * categoryMultiplier * timeBonus * attemptMultiplier * streakMultiplier),
                final: finalXP
            }
        };
    }

    // Generate Leaderboard
    generateLeaderboard() {
        const names = [
            '0X0806', 'CodeNinja', 'AlgoMaster', 'DataWizard', 'ByteBender', 'LogicLord',
            'ScriptSage', 'BugHunter', 'CyberPunk', 'DevDynamo', 'TechTitan',
            'CodeCrusader', 'PixelPioneer', 'SyntaxSorcerer', 'EliteCoder'
        ];

        return names.map((name, index) => {
            if (name === '0X0806') {
                // Creator gets top stats
                return {
                    rank: 1,
                    username: '0X0806',
                    xp: 50000,
                    level: 100,
                    challengesSolved: 5000,
                    streak: 365
                };
            }
            return {
                rank: index + 1,
                username: name,
                xp: index === 0 ? 45000 : 2000 - ((index - 1) * 50) + Math.floor(Math.random() * 100),
                level: index === 0 ? 95 : Math.floor((2000 - ((index - 1) * 50)) / 100),
                challengesSolved: index === 0 ? 4500 : 300 - ((index - 1) * 10) + Math.floor(Math.random() * 20),
                streak: index === 0 ? 300 : Math.floor(Math.random() * 30) + 1
            };
        });
    }

    // Section Navigation
    switchSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        const targetNav = document.querySelector(`[href="#${sectionId}"]`);
        
        if (targetSection) targetSection.classList.add('active');
        if (targetNav) targetNav.classList.add('active');
    }

    // Challenge Management
    renderChallenges() {
        const container = document.getElementById('challenges-grid');
        if (!container) return;

        // Show first 50 challenges for better performance
        const displayChallenges = this.challenges.slice(0, 50);
        
        container.innerHTML = displayChallenges.map(challenge => `
            <div class="glass-card challenge-card" onclick="codeArsenal.openChallenge(${challenge.id})">
                <h3>${challenge.title}</h3>
                <p>${challenge.description}</p>
                <div class="challenge-meta">
                    <span class="difficulty ${challenge.difficulty}">${challenge.difficulty}</span>
                    <span class="xp-reward">+${challenge.xpReward} XP</span>
                    <span class="category">${challenge.category}</span>
                </div>
                <div class="challenge-stats">
                    <span><i class="fas fa-users"></i> ${challenge.solvers}</span>
                    <span><i class="fas fa-star"></i> ${challenge.rating}/5</span>
                    ${challenge.completed ? '<span class="completed"><i class="fas fa-check"></i> Completed</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    filterChallenges() {
        const categoryFilter = document.getElementById('category-filter').value;
        const difficultyFilter = document.getElementById('difficulty-filter').value;
        
        let filtered = this.challenges;
        
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(c => c.category === categoryFilter);
        }
        
        if (difficultyFilter !== 'all') {
            filtered = filtered.filter(c => c.difficulty === difficultyFilter);
        }
        
        const container = document.getElementById('challenges-grid');
        container.innerHTML = filtered.slice(0, 50).map(challenge => `
            <div class="glass-card challenge-card" onclick="codeArsenal.openChallenge(${challenge.id})">
                <h3>${challenge.title}</h3>
                <p>${challenge.description}</p>
                <div class="challenge-meta">
                    <span class="difficulty ${challenge.difficulty}">${challenge.difficulty}</span>
                    <span class="xp-reward">+${challenge.xpReward} XP</span>
                    <span class="category">${challenge.category}</span>
                </div>
                <div class="challenge-stats">
                    <span><i class="fas fa-users"></i> ${challenge.solvers}</span>
                    <span><i class="fas fa-star"></i> ${challenge.rating}/5</span>
                    ${challenge.completed ? '<span class="completed"><i class="fas fa-check"></i> Completed</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    openChallenge(challengeId) {
        this.currentChallenge = this.challenges.find(c => c.id === challengeId);
        if (!this.currentChallenge) return;

        // Initialize challenge session data
        this.currentChallenge.startTime = Date.now();
        this.currentChallenge.attempts = 1;
        
        // Update category stats for attempt
        if (this.currentUser.categoryStats[this.currentChallenge.category]) {
            // Don't increment attempted here - do it in submitCode
        }

        document.getElementById('challenge-title').textContent = this.currentChallenge.title;
        document.getElementById('code-editor').value = this.getStarterCode();
        document.getElementById('code-editor-modal').style.display = 'block';
        
        // Show challenge details
        this.showChallengeDetails();
    }
    
    showChallengeDetails() {
        const details = `
            <div class="challenge-info">
                <h4>${this.currentChallenge.title}</h4>
                <p>${this.currentChallenge.description}</p>
                <div class="challenge-meta">
                    <span class="difficulty ${this.currentChallenge.difficulty}">${this.currentChallenge.difficulty}</span>
                    <span class="xp-reward">Base: ${this.currentChallenge.xpReward} XP</span>
                    <span class="category">${this.currentChallenge.category}</span>
                </div>
                <div class="challenge-tips">
                    <p><strong>Tips:</strong></p>
                    <ul>
                        <li>Solve quickly for time bonus</li>
                        <li>First attempt gives maximum XP</li>
                        <li>Maintain your streak for bonus multipliers</li>
                    </ul>
                </div>
            </div>
        `;
        
        // You could add this to a challenge details panel if it exists
        const detailsPanel = document.getElementById('challenge-details');
        if (detailsPanel) {
            detailsPanel.innerHTML = details;
        }
    }

    closeCodeEditor() {
        document.getElementById('code-editor-modal').style.display = 'none';
        this.currentChallenge = null;
    }

    getStarterCode() {
        return `// ${this.currentChallenge.title}
// Difficulty: ${this.currentChallenge.difficulty}
// XP Reward: ${this.currentChallenge.xpReward}

function solution() {
    // Write your code here
    
    return result;
}

// Test your solution
console.log(solution());`;
    }

    runCode() {
        const code = document.getElementById('code-editor').value;
        const resultsContainer = document.getElementById('test-results');
        
        try {
            // Simulate code execution
            resultsContainer.innerHTML = `
                <div class="test-case passed">
                    <i class="fas fa-check"></i> Test Case 1: Passed
                </div>
                <div class="test-case passed">
                    <i class="fas fa-check"></i> Test Case 2: Passed
                </div>
                <div class="test-case failed">
                    <i class="fas fa-times"></i> Test Case 3: Failed (Expected: 42, Got: 41)
                </div>
            `;
            
            this.showNotification('Code executed successfully!', 'success');
        } catch (error) {
            resultsContainer.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Error: ${error.message}
                </div>
            `;
            this.showNotification('Code execution failed!', 'error');
        }
    }

    submitCode() {
        if (!this.currentChallenge) {
            this.showNotification('No active challenge found!', 'error');
            return;
        }
        
        const startTime = this.currentChallenge.startTime || Date.now();
        const timeSpent = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        const attempts = this.currentChallenge.attempts || 1;
        
        // Ensure category stats exist
        if (!this.currentUser.categoryStats) {
            this.currentUser.categoryStats = this.validateCategoryStats({});
        }
        
        // Simulate submission with balanced success rates
        const difficultySuccess = {
            beginner: 0.85,
            intermediate: 0.70,
            advanced: 0.55,
            expert: 0.40
        };
        
        const success = Math.random() < (difficultySuccess[this.currentChallenge.difficulty] || 0.70);
        
        // Always increment attempt count for this submission
        if (!this.currentUser.categoryStats[this.currentChallenge.category]) {
            this.currentUser.categoryStats[this.currentChallenge.category] = { solved: 0, attempted: 0, xp: 0 };
        }
        
        // Only increment attempted on first attempt to avoid double counting
        if (attempts === 1) {
            this.currentUser.categoryStats[this.currentChallenge.category].attempted++;
        }
        
        if (success) {
            // Calculate XP with all bonuses/penalties
            const xpData = this.calculateXPReward(
                this.currentChallenge.difficulty,
                this.currentChallenge.category,
                timeSpent,
                attempts
            );
            
            // Mark challenge as completed first
            this.currentChallenge.completed = true;
            this.currentChallenge.completedAt = new Date().toISOString();
            this.currentChallenge.solveTime = timeSpent;
            this.currentChallenge.attempts = attempts;
            
            // Find and update the challenge in the challenges array
            const challengeIndex = this.challenges.findIndex(c => c.id === this.currentChallenge.id);
            if (challengeIndex !== -1) {
                this.challenges[challengeIndex].completed = true;
                this.challenges[challengeIndex].completedAt = new Date().toISOString();
                this.challenges[challengeIndex].solveTime = timeSpent;
            }
            
            // Update user stats BEFORE awarding XP to ensure proper progression
            this.currentUser.challengesSolved++;
            this.updateStreak();
            this.updateSolveTimeStats(timeSpent);
            
            // Update category stats for successful solve
            this.currentUser.categoryStats[this.currentChallenge.category].solved++;
            this.currentUser.categoryStats[this.currentChallenge.category].xp += xpData.finalXP;
            
            // Award XP and handle level progression
            this.awardXP(xpData, this.currentChallenge);
            
            // Update success rate after completion
            this.updateSuccessRate();
            
            // Update skill points based on difficulty and category
            this.updateSkillPoints(this.currentChallenge.category, this.currentChallenge.difficulty);
            
            // Check for achievements
            this.checkAllAchievements(timeSpent, this.currentChallenge);
            
            // Track stats for analytics
            this.statsTracker.trackChallengeSolved(this.currentChallenge, timeSpent, xpData.finalXP);
            
            // Save all progress
            this.saveUserData();
            
            // Update UI
            this.updateUserStats();
            this.renderChallenges();
            
            // Show success notification with detailed breakdown
            this.showXPBreakdown(xpData, false);
            
            setTimeout(() => {
                this.closeCodeEditor();
            }, 2000);
            
        } else {
            // Failed attempt
            this.currentChallenge.attempts = attempts + 1;
            
            // Update success rate for failed attempt
            this.updateSuccessRate();
            
            // Save failed attempt data
            this.saveUserData();
            
            this.showNotification(
                `❌ Solution incorrect. Attempt ${attempts + 1}/${attempts + 3}. Try again!`, 
                'error'
            );
            
            // Give a hint after 3 failed attempts
            if (attempts >= 3) {
                setTimeout(() => {
                    this.getHint();
                }, 1000);
            }
        }
    }
    
    updateStreak() {
        const lastSolved = localStorage.getItem('lastSolvedDate');
        const today = new Date().toDateString();
        
        if (lastSolved === today) {
            // Already solved today, maintain streak
            return;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastSolved === yesterday.toDateString()) {
            // Consecutive day, increment streak
            this.currentUser.streak++;
            this.currentUser.dailyStreak++;
            if (this.currentUser.streak > this.currentUser.maxStreak) {
                this.currentUser.maxStreak = this.currentUser.streak;
            }
        } else {
            // Streak broken, reset
            this.currentUser.streak = 1;
            this.currentUser.dailyStreak = 1;
        }
        
        localStorage.setItem('lastSolvedDate', today);
    }
    
    updateStats(solveTime) {
        // Update fastest solve time
        if (!this.currentUser.fastestSolve || solveTime < this.currentUser.fastestSolve) {
            this.currentUser.fastestSolve = solveTime;
        }
        
        // Update average solve time
        const totalTime = this.currentUser.avgSolveTime * (this.currentUser.challengesSolved - 1) + solveTime;
        this.currentUser.avgSolveTime = totalTime / this.currentUser.challengesSolved;
    }
    
    checkSpeedAchievements(solveTime, difficulty) {
        const speedThresholds = {
            beginner: 120,    // 2 minutes
            intermediate: 300, // 5 minutes
            advanced: 600,    // 10 minutes
            expert: 1200      // 20 minutes
        };
        
        if (solveTime < speedThresholds[difficulty]) {
            this.achievementSystem.unlock('speed-demon-' + difficulty);
        }
    }
    
    checkStreakAchievements() {
        const streakMilestones = [5, 10, 15, 30, 50, 100];
        streakMilestones.forEach(milestone => {
            if (this.currentUser.streak === milestone) {
                this.achievementSystem.unlock(`streak-${milestone}`);
            }
        });
    }
    
    checkCategoryAchievements(category) {
        const solved = this.currentUser.categoryStats[category]?.solved || 0;
        const milestones = [10, 25, 50, 100];
        
        milestones.forEach(milestone => {
            if (solved === milestone) {
                this.achievementSystem.unlock(`${category}-${milestone}`);
            }
        });
    }

    getHint() {
        const hints = [
            "Consider using a hash map for O(1) lookups",
            "Think about the edge cases for empty inputs",
            "Try using a two-pointer approach",
            "Dynamic programming might be helpful here",
            "Consider the time complexity of your solution"
        ];
        
        const hint = hints[Math.floor(Math.random() * hints.length)];
        this.showNotification(`Hint: ${hint}`, 'info');
    }

    // Advanced XP and Level System
    awardXP(xpData, challenge) {
        const { finalXP, baseXP, categoryBonus, timeBonus, attemptPenalty, streakBonus } = xpData;
        
        // Update user XP
        this.currentUser.xp += finalXP;
        this.currentUser.totalXP += finalXP;
        this.currentUser.weeklyXP += finalXP;
        this.currentUser.monthlyXP += finalXP;
        
        // Update category stats
        if (this.currentUser.categoryStats[challenge.category]) {
            this.currentUser.categoryStats[challenge.category].xp += finalXP;
            this.currentUser.categoryStats[challenge.category].solved++;
        }
        
        // Calculate new level using exponential progression
        const newLevel = this.calculateLevel(this.currentUser.totalXP);
        const leveledUp = newLevel > this.currentUser.level;
        
        if (leveledUp) {
            const levelsGained = newLevel - this.currentUser.level;
            this.currentUser.level = newLevel;
            this.updateUserRank();
            this.handleLevelUp(levelsGained);
        }
        
        // Save user data after XP changes
        this.saveUserData();
        
        // Update skill points based on category
        this.updateSkillPoints(challenge.category, challenge.difficulty);
        
        // Check for achievements
        this.achievementSystem.checkAchievements(this.currentUser, challenge, xpData);
        
        // Update success rate
        this.updateSuccessRate(true);
        
        // Show detailed XP breakdown
        this.showXPBreakdown(xpData, leveledUp);
    }
    
    calculateLevel(totalXP) {
        if (!totalXP || totalXP < 0) return 1;
        
        // Progressive level system: Level 1: 0-99 XP, Level 2: 100-299 XP, etc.
        let level = 1;
        let currentXP = 0;
        let xpNeeded = 100; // XP needed for level 2
        
        while (totalXP >= currentXP + xpNeeded) {
            currentXP += xpNeeded;
            level++;
            xpNeeded = level * 100; // Each level requires more XP
        }
        
        return level;
    }
    
    getXPForLevel(level) {
        if (level <= 1) return 0;
        
        let totalXP = 0;
        for (let i = 2; i <= level; i++) {
            totalXP += (i - 1) * 100;
        }
        return totalXP;
    }
    
    getXPToNextLevel() {
        const currentLevel = this.currentUser.level;
        const currentLevelXP = this.getXPForLevel(currentLevel);
        const nextLevelXP = this.getXPForLevel(currentLevel + 1);
        const progress = Math.max(0, this.currentUser.totalXP - currentLevelXP);
        const required = nextLevelXP - currentLevelXP;
        
        return { 
            progress, 
            required, 
            percentage: Math.min(100, Math.max(0, (progress / required) * 100)),
            currentLevelXP,
            nextLevelXP,
            totalXP: this.currentUser.totalXP
        };
    }
    
    handleLevelUp(levelsGained) {
        // Unlock new features, challenges, or rewards based on level
        const rewards = [];
        
        for (let i = 0; i < levelsGained; i++) {
            const level = this.currentUser.level - levelsGained + i + 1;
            
            if (level % 5 === 0) {
                rewards.push(`New challenge category unlocked!`);
            }
            if (level % 10 === 0) {
                rewards.push(`XP multiplier increased!`);
                this.xpMultiplier += 0.1;
            }
            if (level === 25) {
                rewards.push(`AI Code Review unlocked!`);
            }
            if (level === 50) {
                rewards.push(`Certification system unlocked!`);
            }
        }
        
        this.showNotification(`🎉 Level up! You are now level ${this.currentUser.level}`, 'success');
        rewards.forEach(reward => {
            this.showNotification(`🎁 ${reward}`, 'info');
        });
    }
    
    updateSkillPoints(category, difficulty) {
        const pointsGained = {
            beginner: 1,
            intermediate: 2,
            advanced: 3,
            expert: 5
        };
        
        if (this.currentUser.skillPoints[category] !== undefined) {
            this.currentUser.skillPoints[category] = Math.min(100, 
                this.currentUser.skillPoints[category] + pointsGained[difficulty]);
        }
    }
    
    updateSuccessRate() {
        // Calculate success rate based on actual category stats
        const totalAttempts = Object.values(this.currentUser.categoryStats)
            .reduce((sum, cat) => sum + (cat.attempted || 0), 0);
        const totalSolved = Object.values(this.currentUser.categoryStats)
            .reduce((sum, cat) => sum + (cat.solved || 0), 0);
        
        if (totalAttempts > 0) {
            this.currentUser.successRate = Math.min(100, Math.max(0, Math.round((totalSolved / totalAttempts) * 100)));
        } else {
            this.currentUser.successRate = 0;
        }
        
        // Ensure challenges solved matches category stats
        if (this.currentUser.challengesSolved !== totalSolved) {
            this.currentUser.challengesSolved = totalSolved;
        }
    }
    
    updateSolveTimeStats(solveTime) {
        if (!solveTime || solveTime <= 0) return;
        
        // Update fastest solve time
        if (!this.currentUser.fastestSolve || solveTime < this.currentUser.fastestSolve) {
            this.currentUser.fastestSolve = solveTime;
        }
        
        // Update average solve time using running average
        const totalChallenges = this.currentUser.challengesSolved;
        if (totalChallenges > 0) {
            const currentTotal = (this.currentUser.avgSolveTime || 0) * (totalChallenges - 1);
            this.currentUser.avgSolveTime = Math.round((currentTotal + solveTime) / totalChallenges);
        } else {
            this.currentUser.avgSolveTime = solveTime;
        }
    }
    
    checkAllAchievements(timeSpent, challenge) {
        this.checkSpeedAchievements(timeSpent, challenge.difficulty);
        this.checkStreakAchievements();
        this.checkCategoryAchievements(challenge.category);
        this.checkProgressAchievements();
        this.checkSpecialAchievements(timeSpent);
    }
    
    checkProgressAchievements() {
        const milestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
        milestones.forEach(milestone => {
            if (this.currentUser.challengesSolved === milestone) {
                this.achievementSystem.unlock(`challenges-${milestone}`);
            }
        });
    }
    
    checkSpecialAchievements(timeSpent) {
        // Night owl achievement (between 10 PM and 6 AM)
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 6) {
            const nightSolves = parseInt(localStorage.getItem('nightSolves') || '0') + 1;
            localStorage.setItem('nightSolves', nightSolves.toString());
            if (nightSolves >= 20) {
                this.achievementSystem.unlock('night-owl');
            }
        }
        
        // Early bird achievement (between 5 AM and 9 AM)
        if (hour >= 5 && hour <= 9) {
            const earlySolves = parseInt(localStorage.getItem('earlySolves') || '0') + 1;
            localStorage.setItem('earlySolves', earlySolves.toString());
            if (earlySolves >= 20) {
                this.achievementSystem.unlock('early-bird');
            }
        }
        
        // Perfectionist achievement (solved on first attempt)
        if (this.currentChallenge && this.currentChallenge.attempts === 1) {
            const perfectSolves = parseInt(localStorage.getItem('perfectSolves') || '0') + 1;
            localStorage.setItem('perfectSolves', perfectSolves.toString());
            if (perfectSolves >= 10) {
                this.achievementSystem.unlock('perfectionist');
            }
        }
    }
    
    updateUserRank() {
        const ranks = [
            { level: 1, name: 'Rookie' },
            { level: 5, name: 'Code Cadet' },
            { level: 10, name: 'Developer' },
            { level: 15, name: 'Code Warrior' },
            { level: 25, name: 'Senior Developer' },
            { level: 35, name: 'Tech Lead' },
            { level: 50, name: 'Code Master' },
            { level: 75, name: 'Programming Guru' },
            { level: 100, name: 'Code Legend' }
        ];
        
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (this.currentUser.level >= ranks[i].level) {
                this.currentUser.rank = ranks[i].name;
                break;
            }
        }
    }
    
    showXPBreakdown(xpData, leveledUp) {
        const { baseXP, categoryBonus, timeBonus, attemptPenalty, streakBonus, finalXP } = xpData;
        
        let message = `+${finalXP} XP earned!\n`;
        message += `Base: ${baseXP} XP\n`;
        if (categoryBonus > 0) message += `Category Bonus: +${categoryBonus}\n`;
        if (timeBonus > 0) message += `Speed Bonus: +${timeBonus}\n`;
        if (attemptPenalty < 0) message += `Attempt Penalty: ${attemptPenalty}\n`;
        if (streakBonus > 0) message += `Streak Bonus: +${streakBonus}\n`;
        
        this.showNotification(message, 'success');
    }

    updateUserStats() {
        try {
            // Ensure user data integrity first
            if (!this.currentUser) {
                console.error('No user data available');
                this.currentUser = this.createNewUser();
            }
        
        // Recalculate level based on current total XP
        const calculatedLevel = this.calculateLevel(this.currentUser.totalXP);
        if (this.currentUser.level !== calculatedLevel) {
            this.currentUser.level = calculatedLevel;
            this.updateUserRank();
        }
        
        // Update header stats
        const xpElement = document.getElementById('user-xp');
        const levelElement = document.getElementById('user-level');
        
        if (xpElement) {
            xpElement.textContent = `${(this.currentUser.totalXP || 0).toLocaleString()} XP`;
        }
        if (levelElement) {
            levelElement.textContent = `Level ${this.currentUser.level}`;
        }
        
        // Update progress bar with accurate calculation
        const xpProgress = this.getXPToNextLevel();
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill && xpProgress) {
            const percentage = Math.min(100, Math.max(0, xpProgress.percentage || 0));
            progressFill.style.width = `${percentage}%`;
        }
        if (progressText && xpProgress) {
            if (this.currentUser.level >= 100) {
                progressText.textContent = 'MAX LEVEL REACHED!';
            } else {
                progressText.textContent = `${Math.floor(xpProgress.progress || 0)}/${Math.floor(xpProgress.required || 100)} XP to Level ${this.currentUser.level + 1}`;
            }
        }
        
        // Update profile info
        const profileInfo = document.querySelector('.profile-info h3');
        const rankInfo = document.querySelector('.profile-info p');
        if (profileInfo) profileInfo.textContent = this.currentUser.username;
        if (rankInfo) rankInfo.textContent = `Rank: ${this.currentUser.rank}`;
        
        // Update dashboard stats with proper validation
        const statNumbers = document.querySelectorAll('.stat-number');
        const stats = [
            this.currentUser.challengesSolved || 0,
            this.currentUser.streak || 0,
            this.currentUser.successRate || 0,
            this.currentUser.languagesMastered || 0
        ];
        
        statNumbers.forEach((el, index) => {
            if (stats[index] !== undefined && el) {
                if (index === 2) { // Success rate
                    el.textContent = Math.round(stats[index]) + '%';
                } else {
                    el.textContent = stats[index].toLocaleString();
                }
            }
        });
        
        // Update detailed stats if elements exist
        this.updateDetailedStats();
        this.updateSkillChart();
        this.updateCategoryStats();
        
        // Save the updated data
            this.saveUserData();
        } catch (error) {
            console.error('Error updating user stats:', error);
            // Try to show a basic error message
            try {
                this.showNotification('Error updating user statistics. Please refresh the page.', 'error');
            } catch (e) {
                console.error('Failed to show error notification:', e);
            }
        }
    }
    
    updateDetailedStats() {
        const detailedStats = {
            weeklyXP: this.currentUser.weeklyXP || 0,
            monthlyXP: this.currentUser.monthlyXP || 0,
            maxStreak: this.currentUser.maxStreak || 0,
            fastestSolve: this.currentUser.fastestSolve || 0,
            avgSolveTime: this.currentUser.avgSolveTime || 0,
            certifications: (this.currentUser.certifications && this.currentUser.certifications.length) || 0
        };
        
        Object.entries(detailedStats).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element && value !== null && value !== undefined) {
                if (key.includes('Time')) {
                    element.textContent = this.formatTime(value);
                } else if (key.includes('XP')) {
                    element.textContent = `${value.toLocaleString()}`;
                } else {
                    element.textContent = value.toString();
                }
            }
        });
    }
    
    updateSkillChart() {
        if (!this.currentUser.skillPoints) return;
        
        Object.entries(this.currentUser.skillPoints).forEach(([skill, points]) => {
            const progressBar = document.querySelector(`[data-skill="${skill}"] .skill-progress`);
            if (progressBar && points !== undefined && points !== null) {
                const validPoints = Math.max(0, Math.min(100, Math.floor(points)));
                progressBar.style.width = `${validPoints}%`;
                progressBar.textContent = `${validPoints}`;
            }
        });
    }
    
    updateCategoryStats() {
        Object.entries(this.currentUser.categoryStats).forEach(([category, stats]) => {
            const categoryElement = document.querySelector(`[data-category="${category}"]`);
            if (categoryElement) {
                categoryElement.querySelector('.solved').textContent = stats.solved;
                categoryElement.querySelector('.attempted').textContent = stats.attempted;
                categoryElement.querySelector('.xp').textContent = `${stats.xp} XP`;
                categoryElement.querySelector('.success-rate').textContent = 
                    `${Math.round((stats.solved / stats.attempted) * 100)}%`;
            }
        });
    }
    
    formatTime(seconds) {
        if (!seconds || seconds <= 0) return '0s';
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    }

    // Leaderboard
    renderLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        if (!container) return;

        container.innerHTML = this.leaderboard.map(user => `
            <div class="leaderboard-item">
                <span class="rank ${this.getRankClass(user.rank)}">#${user.rank}</span>
                <div class="user-info">
                    <h4>${user.username}</h4>
                    <p>Level ${user.level} • ${user.challengesSolved} solved</p>
                </div>
                <div class="user-stats">
                    <span class="xp">${user.xp.toLocaleString()} XP</span>
                    <span class="streak">${user.streak} day streak</span>
                </div>
            </div>
        `).join('');
    }

    getRankClass(rank) {
        if (rank === 1) return 'gold';
        if (rank === 2) return 'silver';
        if (rank === 3) return 'bronze';
        return '';
    }

    switchLeaderboardTab(tab) {
        document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Simulate different leaderboard data
        this.renderLeaderboard();
    }

    // Terminal System
    initTerminal() {
        this.terminalCommands = {
            help: () => `Available commands:
• status - Show system status
• challenges - List recent challenges
• stats - Display user statistics
• clear - Clear terminal
• hack - Enter the matrix
• languages - List supported languages
• achievements - Show achievements
• leaderboard - Show top users`,
            
            status: () => `CODE ARSENAL System Status:
• Server: Online ✓
• AI Assistant: Active ✓
• Challenge Engine: Running ✓
• User Session: Active ✓
• Security Level: Maximum ✓`,
            
            challenges: () => `Recent Challenges:
1. Two Sum Problem [COMPLETED] +50 XP
2. Binary Tree Traversal [IN PROGRESS]
3. Dynamic Programming Challenge [LOCKED]`,
            
            stats: () => `User Statistics:
• XP: ${this.currentUser.xp.toLocaleString()}
• Level: ${this.currentUser.level}
• Challenges Solved: ${this.currentUser.challengesSolved}
• Success Rate: ${this.currentUser.successRate}%
• Current Streak: ${this.currentUser.streak} days`,
            
            clear: () => {
                document.getElementById('terminal-body').innerHTML = '';
                return '';
            },
            
            hack: () => `Initiating matrix connection...
▓▓▓▓▓▓▓▓▓▓ 100%
Welcome to the CODE ARSENAL matrix.
You are now connected to the global network.`,
            
            languages: () => `Supported Languages (50+):
JavaScript, Python, Java, C++, C#, Go, Rust, 
TypeScript, Swift, Kotlin, PHP, Ruby, Scala,
Haskell, Clojure, Erlang, F#, and many more...`,
            
            achievements: () => `Your Achievements:
🔥 Speed Demon - Complete 10 challenges in under 5 minutes
🧠 Algorithm Master - Solve 50 algorithm challenges
🛡️ Security Expert - Complete all cybersecurity challenges
🔒 Code Ninja - Maintain a 30-day streak (LOCKED)`,
            
            leaderboard: () => `Top 5 Global Rankings:
1. CodeNinja - 2000 XP
2. AlgoMaster - 1950 XP
3. DataWizard - 1900 XP
4. ByteBender - 1850 XP
5. LogicLord - 1800 XP`
        };
    }

    executeTerminalCommand(command) {
        const terminalBody = document.getElementById('terminal-body');
        const cmd = command.trim().toLowerCase();
        
        // Add command to terminal
        const commandLine = document.createElement('div');
        commandLine.className = 'terminal-line';
        commandLine.innerHTML = `<span class="prompt">coder@arsenal:~$</span> <span class="command">${command}</span>`;
        terminalBody.appendChild(commandLine);
        
        // Execute command
        let output = '';
        if (this.terminalCommands[cmd]) {
            output = this.terminalCommands[cmd]();
        } else if (cmd === '') {
            output = '';
        } else {
            output = `Command not found: ${command}. Type 'help' for available commands.`;
        }
        
        if (output) {
            const outputLine = document.createElement('div');
            outputLine.className = 'terminal-line';
            outputLine.innerHTML = `<span class="output">${output}</span>`;
            terminalBody.appendChild(outputLine);
        }
        
        // Scroll to bottom
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    // AI Assistant
    initAIAssistant() {
        this.aiContext = {
            conversationHistory: [],
            userSkillLevel: this.calculateUserSkillLevel(),
            currentTopic: null,
            codeSnippets: [],
            debuggingSessions: [],
            learningPath: this.generateLearningPath(),
            recentErrors: [],
            codeAnalysisCache: new Map(),
            personalityTraits: this.analyzeUserPersonality(),
            sessionContext: {
                startTime: Date.now(),
                questionsAsked: 0,
                topicsDiscussed: [],
                helpfulnessRating: 0
            }
        };
        
        // Advanced AI capabilities
        this.aiCapabilities = {
            codeAnalysis: true,
            bugDetection: true,
            performanceOptimization: true,
            securityAudit: true,
            learningRecommendations: true,
            contextualHints: true,
            codeGeneration: true,
            architectureAdvice: true,
            careerGuidance: true,
            realTimeDebugging: true
        };
        
        this.aiResponses = {
            greetings: [
                `🚀 **Welcome to ARSENAL AI v3.0** - Your Elite Programming Mentor!\n\nI've analyzed your profile:\n• **Level:** ${this.currentUser.level} (${this.currentUser.rank})\n• **Challenges Solved:** ${this.currentUser.challengesSolved}\n• **Strongest Skill:** ${this.getStrongestSkill()}\n• **Recommended Focus:** ${this.getRecommendedFocus()}\n\n💡 **What I can do for you:**\n🔍 **Deep Code Analysis** - Review code for bugs, performance, security\n🐛 **Advanced Debugging** - Step-through debugging and error resolution\n🚀 **Performance Optimization** - Identify bottlenecks and suggest improvements\n🛡️ **Security Assessment** - Scan for vulnerabilities and best practices\n📚 **Personalized Learning** - Custom roadmaps based on your progress\n🎯 **Smart Hints** - Context-aware assistance for challenges\n\nWhat coding challenge can I help you conquer today?`,
                
                `👋 **Welcome back, ${this.currentUser.username}!**\n\nI remember our last conversation about ${this.getLastTopic()}. Here's your updated status:\n\n📊 **Progress Update:**\n• XP Gained: +${this.currentUser.weeklyXP} this week\n• Current Streak: ${this.currentUser.streak} days\n• Success Rate: ${this.currentUser.successRate}%\n\n🎯 **Personalized Recommendations:**\n${this.generatePersonalizedRecommendations()}\n\n💪 **Ready to level up?** I'm here to help you master coding with advanced AI assistance!`,
                
                `🤖 **ARSENAL AI v3.0 - Advanced Mode Activated**\n\nI'm your next-generation coding mentor with enhanced capabilities:\n\n✨ **New Features:**\n• **Smart Context Awareness** - I remember our conversations\n• **Predictive Debugging** - I can predict issues before they happen\n• **Adaptive Learning** - Recommendations based on your learning style\n• **Code Generation** - I can write code snippets for you\n• **Real-time Analysis** - Live code review as you type\n\n🎓 **Based on your Level ${this.currentUser.level} status, I recommend:**\n${this.getAdvancedRecommendations()}\n\nLet's build something amazing together!`
            ],
            
            codeReview: [
                "🔍 **Advanced Code Review Mode Activated**\n\nI'll analyze your code for:\n• Time & Space complexity\n• Security vulnerabilities\n• Performance optimizations\n• Code style & best practices\n• Potential bugs\n• Refactoring suggestions\n\nPlease share your code snippet!",
                "**Professional Code Analysis Ready**\n\nI'll provide detailed feedback on:\n✓ Algorithm efficiency\n✓ Code readability\n✓ Error handling\n✓ Scalability concerns\n✓ Industry best practices\n\nShare your code and I'll give you enterprise-level feedback!"
            ],
            
            debugging: [
                "🐛 **Advanced Debugging Assistant**\n\nI can help with:\n• Error trace analysis\n• Logic flow debugging\n• Performance bottlenecks\n• Memory leaks detection\n• Race condition analysis\n• Step-by-step debugging\n\nDescribe your issue or share the error message!",
                "**Smart Debugging Mode**\n\nLet's solve this systematically:\n1. Error analysis\n2. Root cause identification\n3. Solution strategies\n4. Prevention techniques\n\nWhat's the problem you're facing?"
            ],
            
            algorithms: [
                "🧠 **Algorithm Expert Mode**\n\nI can explain and optimize:\n• Sorting algorithms (Quick, Merge, Heap, etc.)\n• Search algorithms (Binary, DFS, BFS, A*)\n• Dynamic Programming patterns\n• Graph algorithms\n• String algorithms\n• Mathematical algorithms\n\nWhich algorithm interests you?",
                "**Advanced Algorithm Analysis**\n\nI'll provide:\n✓ Step-by-step explanations\n✓ Time/Space complexity analysis\n✓ Visual representations\n✓ Real-world applications\n✓ Optimization techniques\n\nWhat algorithm would you like to master?"
            ],
            
            dataStructures: [
                "📊 **Data Structures Specialist**\n\nI can help with:\n• Arrays & Dynamic Arrays\n• Linked Lists (Single, Double, Circular)\n• Stacks & Queues\n• Trees (Binary, BST, AVL, Red-Black)\n• Graphs (Directed, Undirected, Weighted)\n• Hash Tables & Maps\n• Heaps & Priority Queues\n• Tries & Suffix Trees\n\nWhich data structure shall we explore?",
                "**Advanced Data Structure Guide**\n\nI'll explain:\n✓ Implementation details\n✓ Use cases & applications\n✓ Performance characteristics\n✓ Memory considerations\n✓ Comparison with alternatives\n\nWhat would you like to learn about?"
            ],
            
            performance: [
                "⚡ **Performance Optimization Expert**\n\nI can analyze and improve:\n• Algorithm complexity\n• Memory usage\n• CPU optimization\n• Cache efficiency\n• Parallel processing\n• Database query optimization\n\nShare your code for performance analysis!",
                "**Advanced Performance Tuning**\n\nOptimization areas:\n✓ Time complexity reduction\n✓ Space optimization\n✓ Caching strategies\n✓ Algorithmic improvements\n✓ Resource management\n\nWhat needs optimization?"
            ],
            
            security: [
                "🛡️ **Cybersecurity Analysis Mode**\n\nSecurity review for:\n• Input validation vulnerabilities\n• SQL injection risks\n• XSS prevention\n• Authentication flaws\n• Encryption weaknesses\n• Access control issues\n\nShare your code for security assessment!",
                "**Security Expert Analysis**\n\nI'll check for:\n✓ OWASP Top 10 vulnerabilities\n✓ Secure coding practices\n✓ Data protection measures\n✓ Authentication mechanisms\n✓ Authorization controls\n\nWhat needs security review?"
            ],
            
            learning: [
                "📚 **Personalized Learning Path**\n\nBased on your Level " + this.currentUser.level + " status, I recommend:\n• Focus areas for improvement\n• Next skill to develop\n• Practice challenges\n• Learning resources\n• Career progression tips\n\nWhat skill would you like to develop?",
                "**Adaptive Learning Assistant**\n\nCustomized for your progress:\n✓ Skill gap analysis\n✓ Targeted exercises\n✓ Progress tracking\n✓ Milestone planning\n✓ Career guidance\n\nHow can I help you grow?"
            ],
            
            general: [
                "🤖 **ARSENAL AI Advanced Mode**\n\nI'm equipped with:\n• Contextual code understanding\n• Multi-language expertise (50+ languages)\n• Real-time debugging\n• Performance optimization\n• Security analysis\n• Personalized mentoring\n\nWhat coding challenge can I help you conquer?",
                "**Your Elite Programming Assistant**\n\nAdvanced capabilities:\n✓ Intelligent code completion\n✓ Bug prediction & prevention\n✓ Architecture recommendations\n✓ Code quality assessment\n✓ Learning path optimization\n\nWhat would you like to work on today?",
                "**Next-Generation AI Mentor**\n\nI provide:\n• Deep code analysis\n• Contextual explanations\n• Personalized feedback\n• Industry best practices\n• Career guidance\n\nReady to level up your coding skills?"
            ]
        };
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;

        this.addChatMessage(message, 'user');
        input.value = '';

        // Simulate AI thinking
        setTimeout(() => {
            const response = this.generateAIResponse(message);
            this.addChatMessage(response, 'ai');
        }, 1000);
    }

    addChatMessage(message, sender) {
        const container = document.getElementById('chat-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        const avatar = sender === 'ai' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${message}</p>
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    generateAIResponse(message) {
        const msg = message.toLowerCase();
        
        // Advanced conversation context tracking
        this.aiContext.conversationHistory.push({
            user: message,
            timestamp: Date.now(),
            userLevel: this.currentUser.level,
            sessionTime: Date.now() - this.aiContext.sessionContext.startTime,
            messageId: this.aiContext.conversationHistory.length + 1
        });
        
        this.aiContext.sessionContext.questionsAsked++;
        
        // Advanced intent detection and response generation
        const intent = this.detectUserIntent(message);
        const context = this.analyzeMessageContext(message);
        const urgency = this.detectUrgency(message);
        
        // Smart routing based on detected intent
        switch (intent.primary) {
            case 'greeting':
                return this.generateSmartGreeting();
                
            case 'codeAnalysis':
                return this.generateCodeAnalysisResponse(context);
                
            case 'debugging':
                return this.generateDebuggingResponse(context, urgency);
                
            case 'learning':
                return this.generateLearningResponse(context);
                
            case 'explanation':
                return this.generateSmartExplanation(message, context);
                
            case 'optimization':
                return this.generateOptimizationResponse(context);
                
            case 'security':
                return this.generateSecurityResponse(context);
                
            case 'careerAdvice':
                return this.generateCareerGuidance(context);
                
            case 'challenge':
                return this.generateChallengeAssistance(context);
                
            case 'codeGeneration':
                return this.generateCodeResponse(context);
                
            default:
                return this.generateContextualResponse(message, intent, context);
        }
    }
    
    // Advanced intent detection system
    detectUserIntent(message) {
        const msg = message.toLowerCase();
        const intents = {
            primary: 'general',
            secondary: [],
            confidence: 0.5
        };
        
        // Pattern matching for intent detection
        const patterns = {
            greeting: /\b(hello|hi|hey|welcome|good morning|good afternoon|good evening)\b/,
            codeAnalysis: /\b(review|analyze|check|examine|audit|inspect)\s+(my\s+)?code\b/,
            debugging: /\b(debug|fix|error|bug|broken|issue|problem|exception|crash)\b/,
            learning: /\b(learn|study|tutorial|teach|understand|master|practice)\b/,
            explanation: /\b(explain|how|what|why|tell me|describe|clarify)\b/,
            optimization: /\b(optimize|improve|faster|performance|efficient|speed up)\b/,
            security: /\b(security|secure|vulnerability|hack|safe|protect)\b/,
            careerAdvice: /\b(career|job|interview|skills|resume|salary|promotion)\b/,
            challenge: /\b(challenge|problem|exercise|stuck|hint|solution)\b/,
            codeGeneration: /\b(generate|create|write|build|make)\s+(code|function|class|script)\b/
        };
        
        // Find matching patterns
        for (const [intent, pattern] of Object.entries(patterns)) {
            if (pattern.test(msg)) {
                intents.primary = intent;
                intents.confidence = 0.8;
                break;
            }
        }
        
        // Advanced context scoring
        if (this.currentChallenge) {
            if (msg.includes('hint') || msg.includes('help') || msg.includes('stuck')) {
                intents.primary = 'challenge';
                intents.confidence = 0.9;
            }
        }
        
        return intents;
    }
    
    // Context analysis for smarter responses
    analyzeMessageContext(message) {
        return {
            hasCodeSnippet: /```|`|\bcode\b/.test(message),
            mentionsLanguage: this.detectProgrammingLanguage(message),
            isQuestion: /\?|how|what|why|when|where|can|could|should|would/.test(message.toLowerCase()),
            complexity: message.length > 100 ? 'high' : message.length > 50 ? 'medium' : 'low',
            emotion: this.detectEmotion(message),
            topics: this.extractTopics(message),
            codePatterns: this.detectCodePatterns(message)
        };
    }
    
    // Smart greeting generation
    generateSmartGreeting() {
        const timeOfDay = this.getTimeOfDay();
        const recentActivity = this.analyzeRecentActivity();
        const personalizedTip = this.getPersonalizedTip();
        
        return `🌟 **Good ${timeOfDay}, ${this.currentUser.username}!**\n\n` +
               `📊 **Your Coding Journey:**\n` +
               `• Current Level: **${this.currentUser.level}** (${this.currentUser.rank})\n` +
               `• Total XP: **${this.currentUser.totalXP.toLocaleString()}**\n` +
               `• Success Rate: **${this.currentUser.successRate}%**\n` +
               `• Current Streak: **${this.currentUser.streak} days** 🔥\n\n` +
               `${recentActivity}\n\n` +
               `💡 **Personalized Tip:** ${personalizedTip}\n\n` +
               `🚀 **I'm ready to help with:**\n` +
               `• 🔍 Code review and optimization\n` +
               `• 🐛 Debugging and error resolution\n` +
               `• 📚 Personalized learning recommendations\n` +
               `• 🛡️ Security analysis and best practices\n` +
               `• 🎯 Challenge hints and solutions\n\n` +
               `What would you like to work on today?`;
    }
    
    // Advanced code analysis response
    generateCodeAnalysisResponse(context) {
        return `🔬 **Advanced Code Analysis Mode Activated**\n\n` +
               `I'll perform a comprehensive analysis including:\n\n` +
               `📋 **Analysis Checklist:**\n` +
               `✅ **Code Quality** - Readability, maintainability, style\n` +
               `✅ **Performance** - Time/space complexity, optimization opportunities\n` +
               `✅ **Security** - Vulnerability scanning, best practices\n` +
               `✅ **Architecture** - Design patterns, structure analysis\n` +
               `✅ **Testing** - Coverage analysis, test recommendations\n\n` +
               `📝 **To get started:**\n` +
               `1. Paste your code snippet using \`\`\`language\n` +
               `2. Or describe the specific area you'd like me to focus on\n` +
               `3. I'll provide detailed feedback with specific recommendations\n\n` +
               `🎯 **Pro Tip:** Based on your Level ${this.currentUser.level} status, I'll tailor the analysis to match your skill level and learning goals.\n\n` +
               `Ready to share your code? 🚀`;
    }
    
    // Enhanced debugging assistance
    generateDebuggingResponse(context, urgency) {
        const urgencyLevel = urgency.level || 'normal';
        const debuggingSteps = this.getDebugSteps(urgencyLevel);
        
        return `🐛 **Advanced Debugging Assistant - ${urgencyLevel.toUpperCase()} Priority**\n\n` +
               `🔧 **Systematic Debugging Approach:**\n\n` +
               `**Step 1: Error Analysis**\n` +
               `• Share the exact error message\n` +
               `• Include the problematic code section\n` +
               `• Describe when the error occurs\n\n` +
               `**Step 2: Context Gathering**\n` +
               `• Programming language: ${context.mentionsLanguage || 'Please specify'}\n` +
               `• Expected behavior vs actual behavior\n` +
               `• Recent changes made to the code\n\n` +
               `**Step 3: Smart Diagnosis**\n` +
               `• I'll analyze patterns and common issues\n` +
               `• Provide multiple solution approaches\n` +
               `• Suggest preventive measures\n\n` +
               `🎯 **Common Debug Strategies:**\n` +
               `• **Rubber Duck Debugging** - Explain your code line by line\n` +
               `• **Binary Search** - Isolate the problematic section\n` +
               `• **Print Debugging** - Add strategic console.log statements\n` +
               `• **Stack Trace Analysis** - Follow the error trail\n\n` +
               `💡 **Share your error details and I'll provide specific solutions!**`;
    }
    
    // Learning response generation
    generateLearningResponse(context) {
        const learningPath = this.generatePersonalizedLearningPath();
        const skillGaps = this.identifySkillGaps();
        
        return `📚 **Personalized Learning Assistant**\n\n` +
               `🎯 **Your Learning Profile:**\n` +
               `• Current Level: **${this.currentUser.level}**\n` +
               `• Learning Style: **${this.getUserLearningStyle()}**\n` +
               `• Strongest Areas: **${this.getTopSkills().join(', ')}**\n` +
               `• Growth Areas: **${skillGaps.join(', ')}**\n\n` +
               `🗺️ **Recommended Learning Path:**\n` +
               `${learningPath}\n\n` +
               `📖 **Study Resources:**\n` +
               `• **Interactive Challenges** - Practice with hands-on problems\n` +
               `• **Algorithm Patterns** - Master common problem-solving techniques\n` +
               `• **Code Reviews** - Learn from expert feedback\n` +
               `• **Project Building** - Apply skills in real scenarios\n\n` +
               `⚡ **Quick Learning Tips:**\n` +
               `• Focus on understanding concepts, not memorizing syntax\n` +
               `• Practice regularly with spaced repetition\n` +
               `• Build projects to reinforce learning\n` +
               `• Join coding communities for support\n\n` +
               `What specific topic would you like to dive deeper into?`;
    }
    
    // Helper methods for advanced features
    calculateUserSkillLevel() {
        const level = this.currentUser.level;
        if (level < 5) return 'beginner';
        if (level < 15) return 'intermediate';
        if (level < 35) return 'advanced';
        return 'expert';
    }
    
    generateLearningPath() {
        const weakestSkills = Object.entries(this.currentUser.skillPoints || {})
            .sort(([,a], [,b]) => a - b)
            .slice(0, 3)
            .map(([skill,]) => skill);
            
        return {
            immediate: weakestSkills,
            shortTerm: ['system design', 'testing', 'deployment'],
            longTerm: ['architecture', 'leadership', 'mentoring']
        };
    }
    
    analyzeUserPersonality() {
        const solveTime = this.currentUser.avgSolveTime || 600;
        const successRate = this.currentUser.successRate || 0;
        const streak = this.currentUser.streak || 0;
        
        return {
            patience: solveTime > 900 ? 'high' : solveTime < 300 ? 'low' : 'medium',
            persistence: streak > 10 ? 'high' : 'medium',
            riskTaking: successRate > 80 ? 'conservative' : 'experimental',
            learningStyle: this.getUserLearningStyle()
        };
    }
    
    getUserLearningStyle() {
        const patterns = this.aiContext.conversationHistory
            .map(h => h.user.toLowerCase())
            .join(' ');
            
        if (patterns.includes('explain') || patterns.includes('why')) return 'analytical';
        if (patterns.includes('example') || patterns.includes('show')) return 'visual';
        if (patterns.includes('practice') || patterns.includes('exercise')) return 'kinesthetic';
        return 'balanced';
    }
    
    getStrongestSkill() {
        const skills = this.currentUser.skillPoints || {};
        const strongest = Object.entries(skills).sort(([,a], [,b]) => b - a)[0];
        return strongest ? strongest[0] : 'algorithms';
    }
    
    getRecommendedFocus() {
        const skills = this.currentUser.skillPoints || {};
        const weakest = Object.entries(skills).sort(([,a], [,b]) => a - b)[0];
        return weakest ? weakest[0] : 'data structures';
    }
    
    getLastTopic() {
        const lastConvo = this.aiContext.conversationHistory.slice(-1)[0];
        return lastConvo ? 'our previous discussion' : 'getting started';
    }
    
    generatePersonalizedRecommendations() {
        const level = this.currentUser.level;
        const successRate = this.currentUser.successRate;
        
        let recommendations = [];
        
        if (successRate < 70) {
            recommendations.push('• Focus on understanding fundamentals before tackling harder problems');
        }
        if (this.currentUser.streak < 5) {
            recommendations.push('• Build consistency with daily practice (even 15 minutes helps!)');
        }
        if (level < 10) {
            recommendations.push('• Master basic data structures (arrays, strings, hash maps)');
        }
        
        return recommendations.join('\n') || '• Keep up the excellent work! You\'re on track.';
    }
    
    getAdvancedRecommendations() {
        const level = this.currentUser.level;
        if (level < 10) return '• Focus on algorithm fundamentals and basic data structures';
        if (level < 25) return '• Practice dynamic programming and advanced graph algorithms';
        if (level < 50) return '• Explore system design and scalability concepts';
        return '• Consider contributing to open source and mentoring others';
    }
    
    detectUrgency(message) {
        const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'deadline'];
        const hasUrgent = urgentWords.some(word => message.toLowerCase().includes(word));
        return { level: hasUrgent ? 'high' : 'normal' };
    }
    
    detectProgrammingLanguage(message) {
        const languages = ['javascript', 'python', 'java', 'cpp', 'c++', 'go', 'rust', 'typescript'];
        return languages.find(lang => message.toLowerCase().includes(lang)) || null;
    }
    
    detectEmotion(message) {
        const msg = message.toLowerCase();
        if (msg.includes('frustrated') || msg.includes('stuck') || msg.includes('confused')) return 'frustrated';
        if (msg.includes('excited') || msg.includes('love') || msg.includes('awesome')) return 'excited';
        if (msg.includes('worried') || msg.includes('concerned') || msg.includes('afraid')) return 'concerned';
        return 'neutral';
    }
    
    extractTopics(message) {
        const topics = ['algorithm', 'data structure', 'performance', 'security', 'testing', 'debugging'];
        return topics.filter(topic => message.toLowerCase().includes(topic));
    }
    
    detectCodePatterns(message) {
        const patterns = [];
        if (/for\s*\(/i.test(message)) patterns.push('loop');
        if (/function|def\s+/i.test(message)) patterns.push('function');
        if (/class\s+/i.test(message)) patterns.push('class');
        if (/if\s*\(/i.test(message)) patterns.push('conditional');
        return patterns;
    }
    
    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
    }
    
    analyzeRecentActivity() {
        const weeklyXP = this.currentUser.weeklyXP || 0;
        const recentChallenges = this.currentUser.challengesSolved || 0;
        
        if (weeklyXP > 500) return '🔥 **Amazing progress this week!** You\'ve been crushing challenges.';
        if (weeklyXP > 200) return '👍 **Solid week of coding!** Keep up the momentum.';
        return '💪 **Ready for a productive session?** Let\'s make some progress!';
    }
    
    getPersonalizedTip() {
        const tips = [
            'Break complex problems into smaller, manageable pieces',
            'Use descriptive variable names to make your code self-documenting',
            'Practice explaining your solutions - it solidifies understanding',
            'Review failed attempts to identify patterns and improve',
            'Time-box your problem-solving to avoid getting stuck too long'
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }
    
    generatePersonalizedLearningPath() {
        const currentLevel = this.currentUser.level;
        const skillGaps = this.identifySkillGaps();
        
        let path = '';
        if (currentLevel < 10) {
            path = '1. **Master Arrays & Strings** (Foundation)\n2. **Hash Maps & Sets** (Key data structures)\n3. **Basic Recursion** (Problem-solving technique)';
        } else if (currentLevel < 25) {
            path = '1. **Dynamic Programming** (Optimization technique)\n2. **Graph Algorithms** (BFS, DFS, shortest path)\n3. **Advanced Data Structures** (Trees, heaps)';
        } else {
            path = '1. **System Design** (Scalability concepts)\n2. **Advanced Algorithms** (Network flow, string algorithms)\n3. **Architecture Patterns** (Design principles)';
        }
        
        return path;
    }
    
    identifySkillGaps() {
        const skills = this.currentUser.skillPoints || {};
        return Object.entries(skills)
            .filter(([, score]) => score < 60)
            .map(([skill,]) => skill)
            .slice(0, 3);
    }
    
    getTopSkills() {
        const skills = this.currentUser.skillPoints || {};
        return Object.entries(skills)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([skill,]) => skill);
    }
    
    getDebugSteps(urgency) {
        // Return debugging steps based on urgency level
        return urgency === 'high' ? 'quick' : 'comprehensive';
    }
    
    getContextualResponse(category) {
        const responses = this.aiResponses[category];
        const baseResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // Add contextual information based on user progress
        let contextualAddition = "";
        
        if (this.currentUser.level < 5) {
            contextualAddition = "\n\n💡 **Beginner Tip**: Start with basic concepts and don't worry about advanced optimization yet. Focus on understanding the fundamentals!";
        } else if (this.currentUser.level < 15) {
            contextualAddition = "\n\n🎯 **Intermediate Focus**: You're making great progress! Consider exploring more complex algorithms and data structures.";
        } else if (this.currentUser.level < 50) {
            contextualAddition = "\n\n🚀 **Advanced Challenge**: You're at an advanced level! Focus on system design, optimization, and best practices.";
        } else {
            contextualAddition = "\n\n👑 **Expert Level**: You're among the elite! Consider mentoring others and exploring cutting-edge technologies.";
        }
        
        return baseResponse + contextualAddition;
    }
    
    generateContextualHint() {
        const currentChallenge = this.currentChallenge;
        if (!currentChallenge) {
            return "🤔 I notice you're not currently working on a challenge. Would you like me to recommend one based on your Level " + this.currentUser.level + " status?";
        }
        
        const hints = {
            algorithms: [
                "💡 Consider the time complexity - can you solve this in O(n) or O(log n)?",
                "🔍 Think about edge cases: empty inputs, single elements, duplicates",
                "⚡ Hash maps often provide O(1) lookup time for optimization",
                "🎯 Two-pointer technique might be useful here"
            ],
            'data-structures': [
                "📊 Consider which data structure provides the best access pattern",
                "🔗 Think about the relationships between elements",
                "⚖️ Balance between memory usage and access time",
                "🏗️ Sometimes a hybrid approach works best"
            ],
            'web-development': [
                "🌐 Consider browser compatibility and user experience",
                "📱 Think mobile-first design",
                "⚡ Optimize for performance and loading times",
                "🔒 Don't forget security considerations"
            ]
        };
        
        const categoryHints = hints[currentChallenge.category] || hints.algorithms;
        const hint = categoryHints[Math.floor(Math.random() * categoryHints.length)];
        
        return `**Challenge Hint for "${currentChallenge.title}"**\n\n${hint}\n\n🎲 Difficulty: ${currentChallenge.difficulty}\n📈 Potential XP: ${currentChallenge.xpReward}+`;
    }
    
    generateExplanation(message) {
        const explanations = [
            "🧠 **Detailed Explanation:**\n\nLet me break this down step by step with examples and visual representations...",
            "📚 **Educational Deep Dive:**\n\nHere's a comprehensive explanation with practical applications...",
            "🔬 **Technical Analysis:**\n\nI'll explain the underlying concepts and their real-world implications...",
            "💡 **Conceptual Overview:**\n\nLet me provide context, examples, and best practices for this topic..."
        ];
        
        const baseExplanation = explanations[Math.floor(Math.random() * explanations.length)];
        return baseExplanation + "\n\n*Note: This would include detailed explanations based on the specific question asked.*";
    }

    getRandomResponse(category) {
        const responses = this.aiResponses[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Notifications
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <p>${message}</p>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showWelcomeNotification() {
        setTimeout(() => {
            if ((this.currentUser.totalXP || 0) === 0 && (this.currentUser.challengesSolved || 0) === 0) {
                this.showNotification('🚀 Welcome to CODE ARSENAL! You start at Level 1 with 0 XP. Complete your first challenge to begin your coding journey!', 'success');
            } else {
                this.showNotification(`👋 Welcome back, ${this.currentUser.username}! Level ${this.currentUser.level} - ${this.currentUser.totalXP} XP earned. Ready to continue your coding journey?`, 'success');
            }
        }, 1000);
    }
}

// Achievement System Class
class AchievementSystem {
    constructor() {
        try {
            this.achievements = {
            // Progress Achievements
            'first-solve': { name: 'First Steps', description: 'Solve your first challenge', icon: 'fa-baby', category: 'progress' },
            'challenger-10': { name: 'Rising Challenger', description: 'Solve 10 challenges', icon: 'fa-chart-line', category: 'progress' },
            'challenger-50': { name: 'Dedicated Solver', description: 'Solve 50 challenges', icon: 'fa-fire', category: 'progress' },
            'challenger-100': { name: 'Century Club', description: 'Solve 100 challenges', icon: 'fa-trophy', category: 'progress' },
            'challenger-500': { name: 'Elite Programmer', description: 'Solve 500 challenges', icon: 'fa-crown', category: 'progress' },
            
            // Speed Achievements
            'speed-demon-beginner': { name: 'Quick Starter', description: 'Solve a beginner challenge in under 2 minutes', icon: 'fa-bolt', category: 'speed' },
            'speed-demon-intermediate': { name: 'Speed Coder', description: 'Solve an intermediate challenge in under 5 minutes', icon: 'fa-rocket', category: 'speed' },
            'speed-demon-advanced': { name: 'Lightning Fast', description: 'Solve an advanced challenge in under 10 minutes', icon: 'fa-zap', category: 'speed' },
            'speed-demon-expert': { name: 'Time Master', description: 'Solve an expert challenge in under 20 minutes', icon: 'fa-stopwatch', category: 'speed' },
            
            // Streak Achievements
            'streak-5': { name: 'Getting Consistent', description: 'Maintain a 5-day streak', icon: 'fa-calendar-check', category: 'streak' },
            'streak-10': { name: 'Habit Former', description: 'Maintain a 10-day streak', icon: 'fa-fire', category: 'streak' },
            'streak-30': { name: 'Unstoppable', description: 'Maintain a 30-day streak', icon: 'fa-meteor', category: 'streak' },
            'streak-100': { name: 'Legend', description: 'Maintain a 100-day streak', icon: 'fa-infinity', category: 'streak' },
            
            // Category Achievements
            'algorithms-master': { name: 'Algorithm Master', description: 'Solve 50 algorithm challenges', icon: 'fa-brain', category: 'algorithms' },
            'data-structures-guru': { name: 'Data Structures Guru', description: 'Solve 50 data structure challenges', icon: 'fa-project-diagram', category: 'data-structures' },
            'web-dev-expert': { name: 'Web Development Expert', description: 'Solve 50 web development challenges', icon: 'fa-globe', category: 'web-development' },
            'security-specialist': { name: 'Security Specialist', description: 'Solve 25 cybersecurity challenges', icon: 'fa-shield-alt', category: 'cybersecurity' },
            
            // Special Achievements
            'perfectionist': { name: 'Perfectionist', description: 'Solve 10 challenges on first attempt', icon: 'fa-bullseye', category: 'special' },
            'polyglot': { name: 'Polyglot Programmer', description: 'Solve challenges in 10 different languages', icon: 'fa-language', category: 'special' },
            'night-owl': { name: 'Night Owl', description: 'Solve 20 challenges between midnight and 6 AM', icon: 'fa-moon', category: 'special' },
            'early-bird': { name: 'Early Bird', description: 'Solve 20 challenges between 5 AM and 9 AM', icon: 'fa-sun', category: 'special' }
        };
            
            try {
                this.unlockedAchievements = JSON.parse(localStorage.getItem('unlockedAchievements')) || [];
            } catch (error) {
                console.warn('Failed to load achievements from localStorage:', error);
                this.unlockedAchievements = [];
            }
        } catch (error) {
            console.error('Achievement system initialization error:', error);
            this.achievements = {};
            this.unlockedAchievements = [];
        }
    }
    
    checkAchievements(user, challenge, xpData) {
        const newlyUnlocked = [];
        
        // Check progress achievements
        if (user.challengesSolved === 1) newlyUnlocked.push('first-solve');
        if (user.challengesSolved === 10) newlyUnlocked.push('challenger-10');
        if (user.challengesSolved === 50) newlyUnlocked.push('challenger-50');
        if (user.challengesSolved === 100) newlyUnlocked.push('challenger-100');
        if (user.challengesSolved === 500) newlyUnlocked.push('challenger-500');
        
        // Check category-specific achievements
        const categoryStats = user.categoryStats[challenge.category];
        if (categoryStats && categoryStats.solved === 50) {
            newlyUnlocked.push(`${challenge.category}-master`);
        }
        
        // Unlock new achievements
        newlyUnlocked.forEach(achievementId => {
            if (!this.unlockedAchievements.includes(achievementId)) {
                this.unlock(achievementId);
            }
        });
    }
    
    unlock(achievementId) {
        if (this.unlockedAchievements.includes(achievementId)) return;
        
        this.unlockedAchievements.push(achievementId);
        localStorage.setItem('unlockedAchievements', JSON.stringify(this.unlockedAchievements));
        
        const achievement = this.achievements[achievementId];
        if (achievement) {
            codeArsenal.showNotification(
                `🏆 Achievement Unlocked: ${achievement.name}\n${achievement.description}`, 
                'achievement'
            );
        }
    }
    
    getProgress() {
        return {
            total: Object.keys(this.achievements).length,
            unlocked: this.unlockedAchievements.length,
            percentage: Math.round((this.unlockedAchievements.length / Object.keys(this.achievements).length) * 100)
        };
    }
}

// Stats Tracker Class
class StatsTracker {
    constructor() {
        try {
            this.sessionStart = Date.now();
            
            try {
                this.dailyStats = JSON.parse(localStorage.getItem('dailyStats')) || this.getEmptyDayStats();
            } catch (error) {
                console.warn('Failed to load daily stats:', error);
                this.dailyStats = this.getEmptyDayStats();
            }
            
            try {
                this.weeklyStats = JSON.parse(localStorage.getItem('weeklyStats')) || this.getEmptyWeekStats();
            } catch (error) {
                console.warn('Failed to load weekly stats:', error);
                this.weeklyStats = this.getEmptyWeekStats();
            }
            
            try {
                this.monthlyStats = JSON.parse(localStorage.getItem('monthlyStats')) || this.getEmptyMonthStats();
            } catch (error) {
                console.warn('Failed to load monthly stats:', error);
                this.monthlyStats = this.getEmptyMonthStats();
            }
        } catch (error) {
            console.error('StatsTracker initialization error:', error);
            this.sessionStart = Date.now();
            this.dailyStats = this.getEmptyDayStats();
            this.weeklyStats = this.getEmptyWeekStats();
            this.monthlyStats = this.getEmptyMonthStats();
        }
    }
    
    getEmptyDayStats() {
        return {
            date: new Date().toDateString(),
            challengesSolved: 0,
            xpEarned: 0,
            timeSpent: 0,
            categoriesWorked: [],
            averageAttempts: 0,
            streakMaintained: false
        };
    }
    
    getEmptyWeekStats() {
        return {
            week: this.getWeekNumber(),
            challengesSolved: 0,
            xpEarned: 0,
            timeSpent: 0,
            daysActive: 0,
            topCategory: '',
            improvementAreas: []
        };
    }
    
    getEmptyMonthStats() {
        return {
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            challengesSolved: 0,
            xpEarned: 0,
            timeSpent: 0,
            skillGrowth: {},
            achievements: 0,
            rankProgress: 0
        };
    }
    
    getWeekNumber() {
        const date = new Date();
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    trackChallengeSolved(challenge, timeSpent, xpEarned) {
        // Update daily stats
        if (this.dailyStats.date !== new Date().toDateString()) {
            this.dailyStats = this.getEmptyDayStats();
        }
        
        this.dailyStats.challengesSolved++;
        this.dailyStats.xpEarned += xpEarned;
        this.dailyStats.timeSpent += timeSpent;
        
        if (!this.dailyStats.categoriesWorked.includes(challenge.category)) {
            this.dailyStats.categoriesWorked.push(challenge.category);
        }
        
        // Update weekly stats
        if (this.weeklyStats.week !== this.getWeekNumber()) {
            this.weeklyStats = this.getEmptyWeekStats();
        }
        
        this.weeklyStats.challengesSolved++;
        this.weeklyStats.xpEarned += xpEarned;
        this.weeklyStats.timeSpent += timeSpent;
        
        // Update monthly stats
        const currentMonth = new Date().getMonth();
        if (this.monthlyStats.month !== currentMonth) {
            this.monthlyStats = this.getEmptyMonthStats();
        }
        
        this.monthlyStats.challengesSolved++;
        this.monthlyStats.xpEarned += xpEarned;
        this.monthlyStats.timeSpent += timeSpent;
        
        // Save to localStorage
        this.saveStats();
    }
    
    saveStats() {
        localStorage.setItem('dailyStats', JSON.stringify(this.dailyStats));
        localStorage.setItem('weeklyStats', JSON.stringify(this.weeklyStats));
        localStorage.setItem('monthlyStats', JSON.stringify(this.monthlyStats));
    }
    
    getInsights() {
        return {
            mostActiveTime: this.getMostActiveTime(),
            favoriteCategory: this.getFavoriteCategory(),
            learningVelocity: this.getLearningVelocity(),
            consistencyScore: this.getConsistencyScore(),
            recommendations: this.getRecommendations()
        };
    }
    
    getMostActiveTime() {
        // This would analyze when user is most active
        return 'Evening (6-9 PM)';
    }
    
    getFavoriteCategory() {
        return Object.entries(codeArsenal.currentUser.categoryStats)
            .sort(([,a], [,b]) => b.solved - a.solved)[0]?.[0] || 'algorithms';
    }
    
    getLearningVelocity() {
        const daysActive = 30; // This would be calculated from actual data
        return Math.round(this.monthlyStats.challengesSolved / daysActive * 10) / 10;
    }
    
    getConsistencyScore() {
        // Calculate based on streak and regular activity
        return Math.min(100, codeArsenal.currentUser.streak * 3 + (this.weeklyStats.daysActive / 7) * 30);
    }
    
    getRecommendations() {
        const insights = [];
        
        if (this.getConsistencyScore() < 50) {
            insights.push('Try to solve at least one challenge daily to improve consistency');
        }
        
        const weakestCategory = Object.entries(codeArsenal.currentUser.skillPoints)
            .sort(([,a], [,b]) => a - b)[0];
        
        if (weakestCategory && weakestCategory[1] < 50) {
            insights.push(`Focus on ${weakestCategory[0]} to improve your weakest skill area`);
        }
        
        return insights;
    }
}

// Initialize the application with error handling
let codeArsenal;
try {
    codeArsenal = new CodeArsenal();
} catch (error) {
    console.error('Failed to initialize CODE ARSENAL:', error);
    
    // Create a minimal fallback object
    codeArsenal = {
        showNotification: (message, type) => {
            console.log(`${type.toUpperCase()}: ${message}`);
        },
        currentUser: {
            username: 'NewCoder',
            xp: 0,
            level: 1,
            streak: 0,
            challengesSolved: 0,
            successRate: 0,
            languagesMastered: 0
        }
    };
    
    // Show error message after a delay
    setTimeout(() => {
        alert('CODE ARSENAL failed to initialize properly. Please refresh the page.');
    }, 1000);
}

// Additional utility functions
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function timeAgo(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

// Performance monitoring
console.log('🚀 CODE ARSENAL loaded successfully!');
console.log('💡 Type "help" in the terminal for available commands');
console.log('🎯 Ready to challenge yourself with 5000+ coding problems!');
