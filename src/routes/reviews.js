const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createReview,
  getReviewById,
  listReviewsByBook,
  getAverageRating,
  updateReview,
  deleteReview,
} = require('../repositories/reviews');
const { getBookById } = require('../repositories/books');

const router = express.Router();

// GET /api/reviews/book/:bookId — все отзывы книги + средняя оценка
router.get('/book/:bookId', async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isInteger(bookId)) return res.status(400).json({ error: 'bookId должен быть числом' });

  try {
    const book = await getBookById(bookId);
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });

    const items = await listReviewsByBook(bookId);
    const stats = await getAverageRating(bookId);
    return res.json({ items, avg_rating: stats.avg_rating, reviews_count: stats.reviews_count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const review = await getReviewById(id);
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    return res.json(review);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/reviews  { book_id, text, rating }
router.post('/', requireAuth, async (req, res) => {
  const { book_id, text, rating } = req.body || {};
  if (!book_id || !text) {
    return res.status(400).json({ error: 'book_id и text обязательны' });
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'rating должен быть целым от 1 до 5' });
  }

  try {
    const book = await getBookById(Number(book_id));
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });

    const review = await createReview({
      book_id: Number(book_id),
      author_id: req.user.user_id,
      text,
      rating: r,
    });
    return res.status(201).json(review);
  } catch (e) {
    if (e.code === '23514') return res.status(400).json({ error: 'Недопустимое значение rating' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PATCH /api/reviews/:id  — только автор отзыва
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const existing = await getReviewById(id);
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });

    const isAuthor = existing.review_author_id === req.user.user_id;
    const isAdmin  = req.user.role_name === 'admin';
    if (!isAuthor && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    const { text, rating } = req.body || {};
    if (rating !== undefined) {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'rating должен быть целым от 1 до 5' });
      }
    }
    if (text !== undefined && text.length === 0) {
      return res.status(400).json({ error: 'text не может быть пустым' });
    }

    const updated = await updateReview(id, { text, rating });
    return res.json(updated);
  } catch (e) {
    if (e.code === '23514') return res.status(400).json({ error: 'Недопустимое значение rating' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/reviews/:id — только автор отзыва или admin
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const existing = await getReviewById(id);
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });

    const isAuthor = existing.review_author_id === req.user.user_id;
    const isAdmin  = req.user.role_name === 'admin';
    if (!isAuthor && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    await deleteReview(id);
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;