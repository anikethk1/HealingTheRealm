const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'users.sqlite');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            mood INTEGER NOT NULL,
            has_goals INTEGER NOT NULL,
            has_selftime INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS journals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            body TEXT NOT NULL,
            entry_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    `);
});

app.use(express.json());
app.use(express.static(__dirname));

function sendError(res, message, code = 400) {
    return res.status(code).json({ ok: false, message });
}

app.post('/api/signup', (req, res) => {
    const { username, password, confirmPassword } = req.body || {};
    if (!username || !password || !confirmPassword) {
        return sendError(res, 'All fields are required.');
    }
    if (password !== confirmPassword) {
        return sendError(res, 'Passwords do not match.');
    }
    if (password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters.');
    }

    const normalized = username.trim().toLowerCase();
    if (!normalized) {
        return sendError(res, 'Username cannot be empty.');
    }

    db.get('SELECT id FROM users WHERE username = ?', [normalized], (err, row) => {
        if (err) {
            return sendError(res, 'Database error.', 500);
        }
        if (row) {
            return sendError(res, 'User already exists.');
        }
        const hash = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [normalized, hash], function (runErr) {
            if (runErr) {
                return sendError(res, 'Could not create user.', 500);
            }
            return res.json({ ok: true, username: normalized });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return sendError(res, 'Username and password required.');
    }
    const normalized = username.trim().toLowerCase();
    db.get('SELECT id, password_hash FROM users WHERE username = ?', [normalized], (err, row) => {
        if (err) {
            return sendError(res, 'Database error.', 500);
        }
        if (!row) {
            return sendError(res, 'Invalid username or password.', 401);
        }
        const valid = bcrypt.compareSync(password, row.password_hash);
        if (!valid) {
            return sendError(res, 'Invalid username or password.', 401);
        }
        return res.json({ ok: true, username: normalized });
    });
});

// Goals endpoints
app.get('/api/goals', (req, res) => {
    const { username } = req.query;
    if (!username) return sendError(res, 'Username required.', 400);
    const normalized = username.trim().toLowerCase();
    db.all('SELECT id, title, description, completed FROM goals WHERE username = ? ORDER BY created_at DESC', [normalized], (err, rows) => {
        if (err) return sendError(res, 'Database error.', 500);
        res.json({ ok: true, goals: rows || [] });
    });
});

app.post('/api/goals', (req, res) => {
    const { username, title, description } = req.body || {};
    if (!username || !title || !description) return sendError(res, 'Username, title, and description are required.');
    const normalized = username.trim().toLowerCase();
    const cleanTitle = String(title).trim();
    const cleanDesc = String(description).trim();
    if (!cleanTitle || !cleanDesc) return sendError(res, 'Title and description cannot be empty.');
    db.run('INSERT INTO goals (username, title, description) VALUES (?, ?, ?)', [normalized, cleanTitle, cleanDesc], function (err) {
        if (err) return sendError(res, 'Could not save goal.', 500);
        res.json({ ok: true, goal: { id: this.lastID, title: cleanTitle, description: cleanDesc, completed: 0 } });
    });
});

app.patch('/api/goals/:id/complete', (req, res) => {
    const { username, completed } = req.body || {};
    const goalId = Number(req.params.id);
    if (!username || Number.isNaN(goalId)) return sendError(res, 'Username and goal id required.');
    const normalized = username.trim().toLowerCase();
    const completedValue = completed ? 1 : 0;
    db.run('UPDATE goals SET completed = ? WHERE id = ? AND username = ?', [completedValue, goalId, normalized], function (err) {
        if (err) return sendError(res, 'Could not update goal.', 500);
        if (this.changes === 0) return sendError(res, 'Goal not found.', 404);
        res.json({ ok: true });
    });
});

app.delete('/api/goals/:id', (req, res) => {
    const { username } = req.body || {};
    const goalId = Number(req.params.id);
    if (!username || Number.isNaN(goalId)) return sendError(res, 'Username and goal id required.');
    const normalized = username.trim().toLowerCase();
    db.run('DELETE FROM goals WHERE id = ? AND username = ?', [goalId, normalized], function (err) {
        if (err) return sendError(res, 'Could not delete goal.', 500);
        if (this.changes === 0) return sendError(res, 'Goal not found.', 404);
        res.json({ ok: true });
    });
});

// Daily check-ins
app.get('/api/checkins/latest', (req, res) => {
    const { username } = req.query;
    if (!username) return sendError(res, 'Username required.', 400);
    const normalized = username.trim().toLowerCase();
    db.get(
        'SELECT id, mood, has_goals, has_selftime, created_at FROM checkins WHERE username = ? ORDER BY created_at DESC LIMIT 1',
        [normalized],
        (err, row) => {
            if (err) return sendError(res, 'Database error.', 500);
            res.json({ ok: true, checkin: row || null });
        }
    );
});

app.delete('/api/journals/:id', (req, res) => {
    const { username } = req.body || {};
    const journalId = Number(req.params.id);
    if (!username || Number.isNaN(journalId)) return sendError(res, 'Username and journal id required.');
    const normalized = username.trim().toLowerCase();
    db.run('DELETE FROM journals WHERE id = ? AND username = ?', [journalId, normalized], function (err) {
        if (err) return sendError(res, 'Could not delete journal.', 500);
        if (this.changes === 0) return sendError(res, 'Journal not found.', 404);
        res.json({ ok: true });
    });
});

app.post('/api/checkins', (req, res) => {
    const { username, mood, hasGoals, hasSelftime } = req.body || {};
    if (!username || mood == null || hasGoals == null || hasSelftime == null) {
        return sendError(res, 'All fields are required.');
    }
    const normalized = username.trim().toLowerCase();
    const moodVal = Number(mood);
    if (Number.isNaN(moodVal) || moodVal < 1 || moodVal > 5) {
        return sendError(res, 'Mood must be between 1 and 5.');
    }

    const now = Date.now();
    const since = now - 24 * 60 * 60 * 1000;
    db.get(
        'SELECT created_at FROM checkins WHERE username = ? ORDER BY created_at DESC LIMIT 1',
        [normalized],
        (err, row) => {
            if (err) return sendError(res, 'Database error.', 500);
            if (row) {
                const last = new Date(row.created_at).getTime();
                if (last && last > since) {
                    return sendError(res, 'Check-in already submitted in the last 24 hours.');
                }
            }

            db.run(
                'INSERT INTO checkins (username, mood, has_goals, has_selftime) VALUES (?, ?, ?, ?)',
                [normalized, moodVal, hasGoals ? 1 : 0, hasSelftime ? 1 : 0],
                function (insertErr) {
                    if (insertErr) return sendError(res, 'Could not save check-in.', 500);
                    db.get('SELECT id, mood, has_goals, has_selftime, created_at FROM checkins WHERE id = ?', [this.lastID], (gErr, newRow) => {
                        if (gErr) return sendError(res, 'Database error.', 500);
                        res.json({ ok: true, checkin: newRow });
                    });
                }
            );
        }
    );
});

// Journals
app.get('/api/journals', (req, res) => {
    const { username } = req.query;
    if (!username) return sendError(res, 'Username required.', 400);
    const normalized = username.trim().toLowerCase();
    db.all(
        'SELECT id, body, entry_date, created_at FROM journals WHERE username = ? ORDER BY created_at DESC',
        [normalized],
        (err, rows) => {
            if (err) return sendError(res, 'Database error.', 500);
            res.json({ ok: true, journals: rows || [] });
        }
    );
});

app.post('/api/journals', (req, res) => {
    const { username, body, entryDate } = req.body || {};
    if (!username || !body) return sendError(res, 'Username and body are required.');
    const normalized = username.trim().toLowerCase();
    const cleanBody = String(body).trim();
    if (!cleanBody) return sendError(res, 'Journal entry cannot be empty.');
    const dateVal = entryDate ? String(entryDate).trim() : null;
    db.run(
        'INSERT INTO journals (username, body, entry_date) VALUES (?, ?, ?)',
        [normalized, cleanBody, dateVal],
        function (err) {
            if (err) return sendError(res, 'Could not save journal.', 500);
            db.get('SELECT id, body, entry_date, created_at FROM journals WHERE id = ?', [this.lastID], (gErr, row) => {
                if (gErr) return sendError(res, 'Database error.', 500);
                res.json({ ok: true, journal: row });
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
