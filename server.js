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
    if (!fs.existsSync(dbFile)) {
        const initial = { users: [], posts: [] };
        fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
        return initial;
    }
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

function addNotification(db, username, text) {
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        if (!user.notifications) user.notifications = [];
        user.notifications.unshift({ id: Date.now(), text, read: false, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    }
}

// Регистрация
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || username.length < 5) return res.status(400).json({ error: 'Юзернейм от 5 символов!' });
    if (!email || !password) return res.status(400).json({ error: 'Заполни все поля!' });

    const db = readDB();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email уже занят!' });
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ error: 'Юзернейм уже занят!' });

    const role = db.users.length === 0 ? 'admin' : 'user';

    db.users.push({ 
        username, 
        email, 
        password, 
        role, 
        bio: 'Игрок сервера ValhallaSMP 26.2', 
        avatarUrl: '',
        notifications: []
    });
    writeDB(db);
    res.json({ success: true, username, email, role, avatarUrl: '' });
});

// Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Заполни все поля!' });

    const db = readDB();
    const user = db.users.find(u => (u.username.toLowerCase() === login.toLowerCase() || u.email.toLowerCase() === login.toLowerCase()) && u.password === password);
    
    if (!user) return res.status(400).json({ error: 'Неверный логин или пароль.' });
    res.json({ success: true, username: user.username, email: user.email, role: user.role || 'user', avatarUrl: user.avatarUrl || '' });
});

// Поиск по сайту (посты, подписи, категории, авторы)
app.get('/api/search', (req, res) => {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json({ posts: [], users: [] });

    const db = readDB();
    
    // Ищем посты, где подпись, категория или автор содержат запрос
    const matchedPosts = db.posts.filter(p => 
        (p.caption && p.caption.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query)) ||
        (p.author && p.author.toLowerCase().includes(query))
    );

    // Ищем пользователей по нику
    const matchedUsers = db.users.filter(u => u.username.toLowerCase().includes(query));

    res.json({
        posts: matchedPosts.reverse(),
        users: matchedUsers.map(u => ({ username: u.username, bio: u.bio, avatarUrl: u.avatarUrl }))
    });
});

// Получить посты
app.get('/api/posts', (req, res) => {
    const db = readDB();
    res.json(db.posts.reverse());
});

// Загрузить пост
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { caption, username, category } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Картинка не загружена' });

    const db = readDB();
    const newPost = {
        id: Date.now(),
        imageUrl: `/uploads/${req.file.filename}`,
        caption: caption || '',
        category: category || 'Разное',
        author: username || 'Аноним',
        likes: [],
        comments: []
    };

    db.posts.push(newPost);
    writeDB(db);
    res.json({ success: true });
});

// Удаление поста
app.delete('/api/posts/:id', (req, res) => {
    const postId = Number(req.params.id);
    const { username } = req.body;
    const db = readDB();
    const postIndex = db.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return res.status(404).json({ error: 'Пост не найден' });

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    const isOwner = db.posts[postIndex].author.toLowerCase() === username.toLowerCase();
    const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

    if (!isOwner && !isAdminOrMod) return res.status(403).json({ error: 'Недостаточно прав!' });

    db.posts.splice(postIndex, 1);
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
        post.likes.splice(index, 1);
    } else {
        post.likes.push(username);
        if (post.author !== username) {
            addNotification(db, post.author, `${username} оценил(а) ваш скриншот ❤️`);
        }
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
    post.comments.push({ id: Date.now(), author: username, text: text.trim(), replies: [] });

    if (post.author !== username) {
        addNotification(db, post.author, `${username} оставил(а) комментарий к вашему фото`);
    }

    writeDB(db);
    res.json({ success: true, comments: post.comments });
});

// Ответы
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
    comment.replies.push({ id: Date.now(), author: username, text: text.trim() });

    if (comment.author !== username) {
        addNotification(db, comment.author, `${username} ответил(а) на ваш комментарий`);
    }

    writeDB(db);
    res.json({ success: true });
});

// Удаление комментария
app.delete('/api/posts/:postId/comment/:commentId', (req, res) => {
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const { username, isReply, parentId } = req.body;

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

    if (isReply) {
        const comment = post.comments.find(c => c.id === parentId);
        if (!comment) return res.status(404).json({ error: 'Родительский коммент не найден' });
        const replyIndex = comment.replies.findIndex(r => r.id === commentId);
        if (replyIndex === -1) return res.status(404).json({ error: 'Ответ не найден' });
        
        const isOwner = comment.replies[replyIndex].author.toLowerCase() === username.toLowerCase();
        if (!isOwner && !isAdminOrMod) return res.status(403).json({ error: 'Недостаточно прав!' });
        
        comment.replies.splice(replyIndex, 1);
    } else {
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ error: 'Комментарий не найден' });

        const isOwner = post.comments[commentIndex].author.toLowerCase() === username.toLowerCase();
        if (!isOwner && !isAdminOrMod) return res.status(403).json({ error: 'Недостаточно прав!' });

        post.comments.splice(commentIndex, 1);
    }

    writeDB(db);
    res.json({ success: true });
});

// Админ-панель
app.post('/api/admin/update-user', (req, res) => {
    const { adminUsername, targetUsername, newRole, newBio } = req.body;
    const db = readDB();

    const admin = db.users.find(u => u.username.toLowerCase() === adminUsername.toLowerCase());
    if (!admin || (admin.role !== 'admin' && admin.role !== 'moderator')) {
        return res.status(403).json({ error: 'Недостаточно прав!' });
    }

    const target = db.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    if (newRole && admin.role === 'admin') target.role = newRole;
    if (newBio !== undefined) target.bio = newBio;

    writeDB(db);
    res.json({ success: true, role: target.role, bio: target.bio });
});

app.post('/api/user/update-avatar', upload.single('avatar'), (req, res) => {
    const { username } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (req.file) user.avatarUrl = `/uploads/${req.file.filename}`;
    writeDB(db);
    res.json({ success: true, avatarUrl: user.avatarUrl });
});

app.get('/api/user/:username', (req, res) => {
    const searchName = req.params.username.toLowerCase();
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === searchName);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const userPosts = db.posts.filter(p => p.author.toLowerCase() === searchName);
    res.json({
        username: user.username,
        role: user.role || 'user',
        bio: user.bio || 'Игрок сервера',
        avatarUrl: user.avatarUrl || '',
        notifications: user.notifications || [],
        postsCount: userPosts.length,
        posts: userPosts.reverse()
    });
});

app.post('/api/user/notifications/clear', (req, res) => {
    const { username } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        user.notifications = [];
        writeDB(db);
    }
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
