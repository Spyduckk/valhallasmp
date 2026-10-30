const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const dbFile = path.join(__dirname, 'database.json');
function readDB() {
    if (!fs.existsSync(dbFile)) return { users: [], posts: [] };
    try {
        const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        if (!data.users) data.users = [];
        if (!data.posts) data.posts = [];
        return data;
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

    db.users.push({ 
        username, 
        email, 
        password, 
        bio: 'Игрок сервера ValhallaSMP 26.2',
        createdAt: Date.now() 
    });
    writeDB(db);
    res.json({ success: true, username, email });
});

// Вход
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
        likes: [],
        comments: [] // структура: { id, author, text, replies: [{ id, author, text }] }
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
    if (index > -1) post.likes.splice(index, 1);
    else post.likes.push(username);

    writeDB(db);
    res.json({ success: true, likes: post.likes });
});

// Добавить комментарий
app.post('/api/posts/:id/comment', (req, res) => {
    const postId = Number(req.params.id);
    const { username, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустой комментарий' });

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    if (!post.comments) post.comments = [];
    post.comments.push({
        id: Date.now(),
        author: username,
        text: text.trim(),
        replies: []
    });

    writeDB(db);
    res.json({ success: true, comments: post.comments });
});

// Ответить на комментарий
app.post('/api/posts/:postId/comment/:commentId/reply', (req, res) => {
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const { username, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустой ответ' });

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

    if (!comment.replies) comment.replies = [];
    comment.replies.push({
        id: Date.now(),
        author: username,
        text: text.trim()
    });

    writeDB(db);
    res.json({ success: true });
});

// Удалить комментарий или ответ (только свой!)
app.delete('/api/posts/:postId/comment/:commentId', (req, res) => {
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const { username, isReply, parentId } = req.body;

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    if (isReply) {
        const comment = post.comments.find(c => c.id === parentId);
        if (!comment) return res.status(404).json({ error: 'Родительский коммент не найден' });
        const replyIndex = comment.replies.findIndex(r => r.id === commentId);
        if (replyIndex === -1) return res.status(404).json({ error: 'Ответ не найден' });
        
        if (comment.replies[replyIndex].author !== username) return res.status(403).json({ error: 'Чужой комментарий удалить нельзя!' });
        comment.replies.splice(replyIndex, 1);
    } else {
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ error: 'Комментарий не найден' });

        if (post.comments[commentIndex].author !== username) return res.status(403).json({ error: 'Чужой комментарий удалить нельзя!' });
        post.comments.splice(commentIndex, 1);
    }

    writeDB(db);
    res.json({ success: true });
});

// Получить данные профиля игрока
app.get('/api/user/:username', (req, res) => {
    const username = req.params.username;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Находим все посты этого пользователя
    const userPosts = db.posts.filter(p => p.author.toLowerCase() === username.toLowerCase());

    res.json({
        username: user.username,
        bio: user.bio || 'Игрок сервера',
        postsCount: userPosts.length,
        posts: userPosts.reverse()
    });
});

// Обновить био профиля
app.post('/api/user/bio', (req, res) => {
    const { username, bio } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.bio = bio;
    writeDB(db);
    res.json({ success: true, bio });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
