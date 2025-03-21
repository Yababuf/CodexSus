const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// Создаем таблицу для статистики, если её нет
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            link_id TEXT NOT NULL,
            email TEXT NOT NULL,
            clicked INTEGER DEFAULT 0,
            date TEXT NOT NULL
        )
    `);
});

module.exports = db;