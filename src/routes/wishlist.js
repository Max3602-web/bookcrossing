const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
} = require('../repositories/wishlists');
const { getBookById } = require('../repositories/books');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const items = await listWishlist(req.user.user_id);
    return res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/', async (req, res) => {
  const { book_id } = req.body || {};
  if (!book_id) return res.status(400).json({ error: 'book_id обязателен' });

  try {
    const book = await getBookById(Number(book_id));
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });

    const item = await addToWishlist(req.user.user_id, Number(book_id));
    return res.status(201).json({ item });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Книга уже в списке желаемого' });
    if (e.code === '23503') return res.status(400).json({ error: 'Некорректный user_id или book_id' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/:bookId', async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isInteger(bookId)) return res.status(400).json({ error: 'bookId должен быть числом' });

  try {
    const ok = await removeFromWishlist(req.user.user_id, bookId);
    if (!ok) return res.status(404).json({ error: 'Запись не найдена' });
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;