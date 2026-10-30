const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Папка для загруженных картинок
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// База данных через JSON-файл
const dbFile = path.join(__dirname, 'database.json');
function readDB() {
    if (!fs.existsSync(dbFile)) return { users: [], posts: [] };
    try {
        return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
        return { users: [], posts: [] };
    }
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
    if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email уже занят!' });
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ error: 'Юзернейм уже занят!' });

    db.users.push({ username, email, password });
    writeDB(db);
    res.json({ success: true, username, email });
});

// Вход по юзернейму ИЛИ почте
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Заполни все поля!' });

    const db = readDB();
    const user = db.users.find(u => (u.username.toLowerCase() === login.toLowerCase() || u.email.toLowerCase() === login.toLowerCase()) && u.password === password);
    
    if (!user) return res.status(400).json({ error: 'Неверный логин или пароль.' });
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
        author: username || 'Аноним',
        likes: [],       // массив юзернеймов, кто лайкнул
        comments: []     // массив комментариев { author, text }
    };

    db.posts.push(newPost);
    writeDB(db);
    res.json({ success: true });
});

// Лайки
app.post('/api/posts/:id/like', (req, res) => {
    const postId = Number(req.params.id);
    const { username } = req.body;
    const db = readDB();
    const post = db.posts.find(p => p.id === postId);

    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    if (!post.likes) post.likes = [];
    const index = post.likes.indexOf(username);
    if (index > -1) {
        post.likes.splice(index, 1); // убрать лайк если уже был
    } else {
        post.likes.push(username);   // поставить лайк
    }

    writeDB(db);
    res.json({ success: true, likes: post.likes });
});

// Комментарии
app.post('/api/posts/:id/comment', (req, res) => {
    const postId = Number(req.params.id);
    const { username, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустой комментарий' });

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    if (!post.comments) post.comments = [];
    post.comments.push({ author: username, text: text.trim() });

    writeDB(db);
    res.json({ success: true, comments: post.comments });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
