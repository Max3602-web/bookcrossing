require('dotenv').config();
const express = require('express');
const authRoutes     = require('./routes/auth');
const wishlistRoutes = require('./routes/wishlist');
const booksRoutes    = require('./routes/books');
const requestsRoutes = require('./routes/requests');
const exchangesRoutes = require('./routes/exchanges');
const reviewsRoutes  = require('./routes/reviews');
const reportsRoutes = require('./routes/reports');
const { requireAuth, requireRole, requireAnyRole } = require('./middleware/auth');

const app = express();
app.use(express.json());

app.use('/api/auth',      authRoutes);
app.use('/api/wishlist',  wishlistRoutes);
app.use('/api/books',     booksRoutes);
app.use('/api/requests',  requestsRoutes);
app.use('/api/exchanges', exchangesRoutes);
app.use('/api/reviews',   reviewsRoutes);
app.use('/api/reports', reportsRoutes);

// Проверка ролей для отчёта
app.get('/api/protected/reader',    requireAuth, requireRole('reader'),
  (req, res) => res.json({ message: 'Доступно читателю', user: req.user }));
app.get('/api/protected/moderator', requireAuth, requireRole('moderator'),
  (req, res) => res.json({ message: 'Доступно модератору', user: req.user }));
app.get('/api/protected/admin',     requireAuth, requireRole('admin'),
  (req, res) => res.json({ message: 'Доступно администратору', user: req.user }));
app.get('/api/protected/staff',     requireAuth, requireAnyRole('moderator', 'admin'),
  (req, res) => res.json({ message: 'Доступно модератору или администратору', user: req.user }));

app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));