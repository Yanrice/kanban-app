const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./kanban.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Boards table
  db.run(`CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Columns table
  db.run(`CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    board_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
  )`);

  // Tasks table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    column_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    priority TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES columns (id) ON DELETE CASCADE
  )`);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign(
          { userId: this.lastID, username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    }
  );
});

// Board routes
app.get('/api/boards', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.userId],
    (err, boards) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(boards);
    }
  );
});

app.post('/api/boards', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.run(
    'INSERT INTO boards (title, description, user_id) VALUES (?, ?, ?)',
    [title, description || '', req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Create default columns
      const boardId = this.lastID;
      const defaultColumns = ['To Do', 'In Progress', 'Done'];
      
      let completed = 0;
      defaultColumns.forEach((columnTitle, index) => {
        db.run(
          'INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)',
          [columnTitle, boardId, index],
          (err) => {
            if (err) console.error('Error creating default column:', err);
            completed++;
            if (completed === defaultColumns.length) {
              res.json({ id: boardId, title, description, user_id: req.user.userId });
            }
          }
        );
      });
    }
  );
});

app.get('/api/boards/:id', authenticateToken, (req, res) => {
  const boardId = req.params.id;
  
  // Get board details
  db.get(
    'SELECT * FROM boards WHERE id = ? AND user_id = ?',
    [boardId, req.user.userId],
    (err, board) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }

      // Get columns and tasks
      db.all(
        `SELECT c.*, 
                json_group_array(
                  CASE WHEN t.id IS NOT NULL 
                  THEN json_object(
                    'id', t.id,
                    'title', t.title,
                    'description', t.description,
                    'priority', t.priority,
                    'position', t.position,
                    'created_at', t.created_at
                  ) 
                  ELSE NULL END
                ) as tasks
         FROM columns c
         LEFT JOIN tasks t ON c.id = t.column_id
         WHERE c.board_id = ?
         GROUP BY c.id
         ORDER BY c.position`,
        [boardId],
        (err, columns) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Parse tasks JSON and filter nulls
          const formattedColumns = columns.map(col => ({
            ...col,
            tasks: JSON.parse(col.tasks).filter(task => task !== null)
              .sort((a, b) => a.position - b.position)
          }));

          res.json({
            ...board,
            columns: formattedColumns
          });
        }
      );
    }
  );
});

// Column routes
app.post('/api/boards/:id/columns', authenticateToken, (req, res) => {
  const boardId = req.params.id;
  const { title } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Verify board ownership
  db.get(
    'SELECT * FROM boards WHERE id = ? AND user_id = ?',
    [boardId, req.user.userId],
    (err, board) => {
      if (err || !board) {
        return res.status(404).json({ error: 'Board not found' });
      }

      // Get next position
      db.get(
        'SELECT MAX(position) as max_pos FROM columns WHERE board_id = ?',
        [boardId],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          const position = (result.max_pos || -1) + 1;
          
          db.run(
            'INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)',
            [title, boardId, position],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              
              res.json({
                id: this.lastID,
                title,
                board_id: boardId,
                position,
                tasks: []
              });
            }
          );
        }
      );
    }
  );
});

// Task routes
app.post('/api/columns/:id/tasks', authenticateToken, (req, res) => {
  const columnId = req.params.id;
  const { title, description, priority } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Verify column ownership through board
  db.get(
    `SELECT c.* FROM columns c 
     JOIN boards b ON c.board_id = b.id 
     WHERE c.id = ? AND b.user_id = ?`,
    [columnId, req.user.userId],
    (err, column) => {
      if (err || !column) {
        return res.status(404).json({ error: 'Column not found' });
      }

      // Get next position
      db.get(
        'SELECT MAX(position) as max_pos FROM tasks WHERE column_id = ?',
        [columnId],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          const position = (result.max_pos || -1) + 1;
          
          db.run(
            'INSERT INTO tasks (title, description, column_id, position, priority) VALUES (?, ?, ?, ?, ?)',
            [title, description || '', columnId, position, priority || 'medium'],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              
              res.json({
                id: this.lastID,
                title,
                description: description || '',
                column_id: columnId,
                position,
                priority: priority || 'medium'
              });
            }
          );
        }
      );
    }
  );
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const taskId = req.params.id;
  const { title, description, priority, column_id, position } = req.body;

  // Verify task ownership
  db.get(
    `SELECT t.* FROM tasks t 
     JOIN columns c ON t.column_id = c.id 
     JOIN boards b ON c.board_id = b.id 
     WHERE t.id = ? AND b.user_id = ?`,
    [taskId, req.user.userId],
    (err, task) => {
      if (err || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updates = [];
      const values = [];

      if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        values.push(priority);
      }
      if (column_id !== undefined) {
        updates.push('column_id = ?');
        values.push(column_id);
      }
      if (position !== undefined) {
        updates.push('position = ?');
        values.push(position);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(taskId);

      db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ message: 'Task updated successfully' });
        }
      );
    }
  );
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const taskId = req.params.id;

  // Verify task ownership
  db.get(
    `SELECT t.* FROM tasks t 
     JOIN columns c ON t.column_id = c.id 
     JOIN boards b ON c.board_id = b.id 
     WHERE t.id = ? AND b.user_id = ?`,
    [taskId, req.user.userId],
    (err, task) => {
      if (err || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ message: 'Task deleted successfully' });
      });
    }
  );
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
