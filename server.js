const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.express = express.json();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Папка для загруженных картинок
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Инициализация базы данных SQLite
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Ошибка подключения к БД', err.message);
    else console.log('Подключено к базе данных SQLite.');
});

// Создание таблиц
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imageUrl TEXT,
        caption TEXT,
        author TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// --- API РОУТЫ ---

// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || username.length < 5) {
        return res.status(400).json({ error: 'Юзернейм должен быть не менее 5 символов!' });
    }
    if (!email || !password) {
        return res.status(400).json({ error: 'Заполни все поля!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
            [username, email, hashedPassword], 
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Пользователь с таким email или юзернеймом уже существует.' });
                }
                res.json({ success: true, userId: this.lastID, username });
            }
        );
    } catch (e) {
        res.status(500.0).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Неверный email или пароль.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Неверный email или пароль.' });
        }

        res.json({ success: true, username: user.username, email: user.email });
    });
});

// Получить посты галереи
app.get('/api/posts', (req, res) => {
    db.all(`SELECT * FROM posts ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка загрузки постов' });
        res.json(rows);
    });
});

// Загрузка поста
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { caption, username } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Картинка не загружена' });

    const imageUrl = `/uploads/${req.file.filename}`;

    db.run(`INSERT INTO posts (imageUrl, caption, author) VALUES (?, ?, ?)`,
        [imageUrl, caption, username || 'Аноним'],
        function(err) {
            if (err) return res.status(500).json({ error: 'Ошибка сохранения поста' });
            res.json({ success: true, postId: this.lastID });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
