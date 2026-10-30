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

// Простая база данных через JSON-файлы
const dbFile = path.join(__dirname, 'database.json');
function readDB() {
    if (!fs.existsSync(dbFile)) return { users: [], posts: [] };
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}
function writeDB(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Регистрация
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || username.length < 5) return res.status(400).json({ error: 'Юзернейм от 5 символов!' });
    if (!email || !password) return res.status(400).json({ error: 'Заполни все поля!' });

    const db = readDB();
    if (db.users.find(u => u.email === email || u.username === username)) {
        return res.status(400).json({ error: 'Такой пользователь или email уже есть.' });
    }

    db.users.push({ username, email, password });
    writeDB(db);
    res.json({ success: true, username });
});

// Вход
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(400).json({ error: 'Неверный email или пароль.' });

    res.json({ success: true, username: user.username, email: user.email });
});

// Получить посты
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
