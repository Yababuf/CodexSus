const express = require('express');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('./database'); // Подключаем базу данных
const { v4: uuidv4 } = require('uuid'); // Для генерации UUID

const app = express();
const port = 3000;

// Хранилище статистики (временное, можно удалить после перехода на SQLite)
const statistics = {
    clicks: []
};

// Настройка сессий
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware для обработки данных
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Фейковые учетные данные администратора
const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'password123'
};

// Проверка аутентификации
function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/login');
}

// Настройка транспортера для MailHog
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'localhost',
    port: process.env.MAIL_PORT || 1025,
    secure: false
});

// Функция для отправки письма
async function sendMail(to, subject, text, html) {
    const mailOptions = {
        from: process.env.MAIL_FROM || 'codexsus@domain.com',
        to,
        subject,
        text,
        html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Письмо отправлено:', info.response);
        return info;
    } catch (error) {
        console.error('Ошибка при отправке письма:', error);
        throw error;
    }
}

// Страница входа
app.get('/login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Обработка логина
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.isAdmin = true;

        try {
            await sendMail('admin@example.com', 'Вход в админ-панель', 'Пользователь вошел в админ-панель.');
            return res.redirect('/admin');
        } catch (error) {
            return res.status(500).send(`Ошибка при отправке письма: ${error.message}`);
        }
    }

    res.send('Неверные учетные данные <a href="/login">Попробовать снова</a>');
});

// Выход
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка при выходе:', err);
            return res.status(500).send('Ошибка при выходе. Попробуйте снова.');
        }
        res.redirect('/login');
    });
});

// Админ-панель (доступ только после авторизации)
app.get('/admin', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Маршрут для отображения страницы статистики
app.get('/admin/statistics', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'statistics.html'));
});

// Маршрут для получения данных статистики (API)
app.get('/api/statistics', isAuthenticated, (req, res) => {
    db.all('SELECT * FROM stats', (err, rows) => {
        if (err) {
            console.error('Ошибка при получении данных:', err);
            return res.status(500).send('Ошибка при получении данных');
        }
        res.json(rows); // Отправляем данные в формате JSON
    });
});

// Страница для создания нового теста
app.get('/admin/new-check', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'new-check.html'));
});

// Обработка отправки почты с формы на странице "Новая проверка"
app.post('/admin/send-email', isAuthenticated, async (req, res) => {
    const { subject, email, message } = req.body;

    if (!subject || !email || !message) {
        return res.status(400).send('Все поля должны быть заполнены!');
    }

    // Генерация уникальной ссылки
    const uniqueId = uuidv4();
    const uniqueLink = `http://localhost:3000/track/${uniqueId}`;

    const htmlMessage = `<p>${message}</p><a href="${uniqueLink}">Перейти по ссылке</a>`;

    try {
        await sendMail(email, subject, message, htmlMessage);

        // Сохраняем информацию о письме в базе данных
        db.run(
            'INSERT INTO stats (link_id, email, clicked, date) VALUES (?, ?, ?, ?)',
            [uniqueId, email, 0, new Date().toISOString()],
            (err) => {
                if (err) {
                    console.error('Ошибка при сохранении данных:', err);
                    return res.status(500).send('Ошибка при сохранении данных');
                }
                console.log(`Письмо отправлено и данные сохранены для ID: ${uniqueId}`);
                res.redirect('/admin');
            }
        );
    } catch (error) {
        res.status(500).send('Ошибка при отправке письма: ' + error.message);
    }
});

// Фиксация переходов
app.get('/track/:id', (req, res) => {
    const uniqueId = req.params.id;

    // Обновляем статистику в базе данных
    db.run(
        'UPDATE stats SET clicked = 1 WHERE link_id = ?',
        [uniqueId],
        (err) => {
            if (err) {
                console.error('Ошибка при обновлении данных:', err);
                return res.status(500).send('Ошибка при обновлении данных');
            }
            console.log(`Переход зафиксирован для ID: ${uniqueId}`);
            res.redirect('http://localhost:3000'); // Перенаправляем пользователя
        }
    );
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});