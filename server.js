const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secure-secret-key';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // limit each IP to 5 auth requests per windowMs
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize SQLite database (in-memory for development)
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Boards table (updated with description)
    db.run(`
        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    // Tasks table (updated with priority)
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'todo',
            board_id INTEGER NOT NULL,
            position INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
        )
    `);

    console.log('Database tables initialized');
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Validation helpers
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validateUsername(username) {
    return username && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
}

// === AUTH ROUTES ===

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!validateUsername(username)) {
            return res.status(400).json({ 
                message: 'Username must be at least 3 characters and contain only letters, numbers, and underscores' 
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email],
            async (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Server error' });
                }

                if (row) {
                    return res.status(400).json({ message: 'Username or email already exists' });
                }

                // Hash password and create user
                const saltRounds = 12;
                const passwordHash = await bcrypt.hash(password, saltRounds);

                db.run(
                    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                    [username, email, passwordHash],
                    function(err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ message: 'Failed to create user' });
                        }

                        const userId = this.lastID;
                        const token = jwt.sign(
                            { userId, username, email },
                            JWT_SECRET,
                            { expiresIn: '7d' }
                        );

                        res.status(201).json({
                            message: 'User created successfully',
                            token,
                            user: { id: userId, username, email }
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', authLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!user) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            try {
                const validPassword = await bcrypt.compare(password, user.password_hash);
                if (!validPassword) {
                    return res.status(401).json({ message: 'Invalid username or password' });
                }

                const token = jwt.sign(
                    { userId: user.id, username: user.username, email: user.email },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.json({
                    message: 'Login successful',
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({ message: 'Server error' });
            }
        }
    );
});

// === BOARD ROUTES ===

// Get all boards for user
app.get('/api/boards', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.all(
        `SELECT b.*, 
                COUNT(t.id) as task_count 
         FROM boards b 
         LEFT JOIN tasks t ON b.id = t.board_id 
         WHERE b.user_id = ? 
         GROUP BY b.id 
         ORDER BY b.created_at DESC`,
        [userId],
        (err, boards) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to fetch boards' });
            }
            res.json(boards);
        }
    );
});

// Create new board
app.post('/api/boards', authenticateToken, (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: 'Board name is required' });
    }

    if (name.length > 50) {
        return res.status(400).json({ message: 'Board name must be 50 characters or less' });
    }

    db.run(
        'INSERT INTO boards (name, description, user_id) VALUES (?, ?, ?)',
        [name.trim(), description?.trim() || null, userId],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to create board' });
            }

            db.get(
                'SELECT * FROM boards WHERE id = ?',
                [this.lastID],
                (err, board) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Board created but failed to fetch' });
                    }
                    res.status(201).json(board);
                }
            );
        }
    );
});

// Delete board
app.delete('/api/boards/:id', authenticateToken, (req, res) => {
    const boardId = req.params.id;
    const userId = req.user.userId;

    // First verify the board belongs to the user
    db.get(
        'SELECT id FROM boards WHERE id = ? AND user_id = ?',
        [boardId, userId],
        (err, board) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!board) {
                return res.status(404).json({ message: 'Board not found' });
            }

            // Delete the board (tasks will be deleted automatically due to CASCADE)
            db.run(
                'DELETE FROM boards WHERE id = ? AND user_id = ?',
                [boardId, userId],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Failed to delete board' });
                    }
                    res.json({ message: 'Board deleted successfully' });
                }
            );
        }
    );
});

// === TASK ROUTES ===

// Get all tasks for a board
app.get('/api/boards/:boardId/tasks', authenticateToken, (req, res) => {
    const boardId = req.params.boardId;
    const userId = req.user.userId;

    // First verify the board belongs to the user
    db.get(
        'SELECT id FROM boards WHERE id = ? AND user_id = ?',
        [boardId, userId],
        (err, board) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!board) {
                return res.status(404).json({ message: 'Board not found' });
            }

            // Get tasks for the board
            db.all(
                'SELECT * FROM tasks WHERE board_id = ? ORDER BY position ASC, created_at ASC',
                [boardId],
                (err, tasks) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Failed to fetch tasks' });
                    }
                    res.json(tasks);
                }
            );
        }
    );
});

// Create new task
app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, priority, board_id, status } = req.body;
    const userId = req.user.userId;

    if (!title || title.trim().length === 0) {
        return res.status(400).json({ message: 'Task title is required' });
    }

    if (!board_id) {
        return res.status(400).json({ message: 'Board ID is required' });
    }

    const validPriorities = ['low', 'medium', 'high'];
    const validStatuses = ['todo', 'in-progress', 'done'];

    if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ message: 'Invalid priority level' });
    }

    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    // Verify board belongs to user
    db.get(
        'SELECT id FROM boards WHERE id = ? AND user_id = ?',
        [board_id, userId],
        (err, board) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!board) {
                return res.status(404).json({ message: 'Board not found' });
            }

            // Create task
            db.run(
                'INSERT INTO tasks (title, priority, board_id, status) VALUES (?, ?, ?, ?)',
                [title.trim(), priority || 'medium', board_id, status || 'todo'],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Failed to create task' });
                    }

                    db.get(
                        'SELECT * FROM tasks WHERE id = ?',
                        [this.lastID],
                        (err, task) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).json({ message: 'Task created but failed to fetch' });
                            }
                            res.status(201).json(task);
                        }
                    );
                }
            );
        }
    );
});

// Update task
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const taskId = req.params.id;
    const { title, priority, status, position } = req.body;
    const userId = req.user.userId;

    // First verify the task belongs to a board owned by the user
    db.get(
        `SELECT t.id, t.board_id 
         FROM tasks t 
         JOIN boards b ON t.board_id = b.id 
         WHERE t.id = ? AND b.user_id = ?`,
        [taskId, userId],
        (err, task) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            // Build update query dynamically
            const updates = [];
            const values = [];

            if (title !== undefined) {
                if (!title.trim()) {
                    return res.status(400).json({ message: 'Task title cannot be empty' });
                }
                updates.push('title = ?');
                values.push(title.trim());
            }

            if (priority !== undefined) {
                const validPriorities = ['low', 'medium', 'high'];
                if (!validPriorities.includes(priority)) {
                    return res.status(400).json({ message: 'Invalid priority level' });
                }
                updates.push('priority = ?');
                values.push(priority);
            }

            if (status !== undefined) {
                const validStatuses = ['todo', 'in-progress', 'done'];
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ message: 'Invalid status' });
                }
                updates.push('status = ?');
                values.push(status);
            }

            if (position !== undefined) {
                updates.push('position = ?');
                values.push(position);
            }

            if (updates.length === 0) {
                return res.status(400).json({ message: 'No valid fields to update' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(taskId);

            const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;

            db.run(query, values, function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Failed to update task' });
                }

                db.get(
                    'SELECT * FROM tasks WHERE id = ?',
                    [taskId],
                    (err, updatedTask) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ message: 'Task updated but failed to fetch' });
                        }
                        res.json(updatedTask);
                    }
                );
            });
        }
    );
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.userId;

    // Verify the task belongs to a board owned by the user
    db.get(
        `SELECT t.id 
         FROM tasks t 
         JOIN boards b ON t.board_id = b.id 
         WHERE t.id = ? AND b.user_id = ?`,
        [taskId, userId],
        (err, task) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            db.run(
                'DELETE FROM tasks WHERE id = ?',
                [taskId],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Failed to delete task' });
                    }
                    res.json({ message: 'Task deleted successfully' });
                }
            );
        }
    );
});

// === SERVE STATIC FILES ===

// Serve the main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the app at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
