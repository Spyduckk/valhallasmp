const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Папка для картинок
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Надежная база данных через JSON-файл
const dbFile = path.join(__dirname, 'database.json');
function readDB() {
    if (!fs.existsSync(dbFile)) return { users: [], posts: [] };
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: [], posts: [] };
    }
}
function writeDB(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Регистрация с проверкой уникальности почты И юзернейма
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || username.length < 5) {
        return res.status(400).json({ error: 'Юзернейм должен быть не менее 5 символов!' });
    }
    if (!email || !password) {
        return res.status(400).json({ error: 'Заполни все поля!' });
    }

    const db = readDB();

    // Проверяем, занят ли email
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Этот Email уже зарегистрирован!' });
    }

    // Проверяем, занят ли юзернейм (чтобы не было дубликатов)
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Этот юзернейм уже занят другим игроком!' });
    }

    db.users.push({ username, email, password });
    writeDB(db);
    
    res.json({ success: true, username, email });
});

// Вход в аккаунт
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Заполни все поля!' });
    }

    const db = readDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(400).json({ error: 'Неверный email или пароль.' });
    }

    res.json({ success: true, username: user.username, email: user.email });
});

// Получить посты галереи
app.get('/api/posts', (req, res) => {
    const db = readDB();
    res.json(db.posts.reverse());
});

// Загрузить пост
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { caption, username } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Картинка не загружена' });

    const db = readDB();
    const newPost = {
        id: Date.now(),
        imageUrl: `/uploads/${req.file.filename}`,
        caption: caption || '',
        author: username || 'Аноним'
    };

    db.posts.push(newPost);
    writeDB(db);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
