const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createBook,
  getBookById,
  listBooks,
  updateBook,
  deleteBook,
} = require('../repositories/books');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { title, author, city_id, status_id, owner_id } = req.query;
    const books = await listBooks({
      title,
      author,
      city_id: city_id ? Number(city_id) : undefined,
      status_id: status_id ? Number(status_id) : undefined,
      owner_id: owner_id ? Number(owner_id) : undefined,
    });
    return res.json({ items: books });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// --- Вспомогательная функция формирования CSV ---
function buildCsv(rows, columns) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Если значение содержит запятую, кавычку или перевод строки — берём в кавычки,
    // а внутренние кавычки удваиваем (RFC 4180).
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return header + '\n' + body;
}

// --- GET /api/books/export?format=csv&title=...&city_id=... ---
// Выгружает те же строки, что и GET /api/books с теми же фильтрами.
router.get('/export', async (req, res) => {
  try {
    const { format = 'csv', title, author, city_id, status_id, owner_id } = req.query;

    if (format !== 'csv') {
      return res.status(400).json({ error: 'Поддерживается только format=csv' });
    }

    const books = await listBooks({
      title,
      author,
      city_id:   city_id   ? Number(city_id)   : undefined,
      status_id: status_id ? Number(status_id) : undefined,
      owner_id:  owner_id  ? Number(owner_id)  : undefined,
    });

    const columns = [
      'book_id',
      'book_title',
      'author_last_name',
      'author_first_name',
      'user_city_id',
      'book_status_id',
      'book_created_at',
    ];

    const csv = buildCsv(books, columns);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="books_${Date.now()}.csv"`
    );

    // BOM в начале — чтобы Excel корректно показал кириллицу
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const book = await getBookById(id);
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });
    return res.json(book);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { title, author_id, description, status_id } = req.body || {};
  if (!title || !author_id) {
    return res.status(400).json({ error: 'title и author_id обязательны' });
  }
  try {
    const book = await createBook({
      title,
      author_id: Number(author_id),
      description,
      status_id: status_id ? Number(status_id) : 1,
      owner_id: req.user.user_id,
    });
    return res.status(201).json(book);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Некорректный author_id или status_id' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const existing = await getBookById(id);
    if (!existing) return res.status(404).json({ error: 'Книга не найдена' });

    const isOwner = existing.book_owner_id === req.user.user_id;
    const isAdmin = req.user.role_name === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    const updated = await updateBook(id, req.body || {});
    return res.json(updated);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Некорректный author_id или status_id' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const existing = await getBookById(id);
    if (!existing) return res.status(404).json({ error: 'Книга не найдена' });

    const isOwner = existing.book_owner_id === req.user.user_id;
    const isAdmin = req.user.role_name === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    await deleteBook(id);
    return res.status(204).send();
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({ error: 'Нельзя удалить книгу: есть связанные запросы, обмены или отзывы' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;