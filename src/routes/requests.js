const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createRequest,
  getRequestById,
  listRequests,
  updateRequestStatus,
  deleteRequest,
} = require('../repositories/requests');
const { getBookById } = require('../repositories/books');

const router = express.Router();

// GET /api/requests?status_id=... — свои запросы (в которых я участник)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status_id, mine } = req.query;
    const user_id = mine === 'false' && req.user.role_name === 'admin'
      ? undefined
      : req.user.user_id;

    const items = await listRequests({
      user_id,
      status_id: status_id ? Number(status_id) : undefined,
    });
    return res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const request = await getRequestById(id);
    if (!request) return res.status(404).json({ error: 'Запрос не найден' });

    const isParticipant =
      request.request_requester_id === req.user.user_id ||
      request.request_owner_id === req.user.user_id;
    if (!isParticipant && req.user.role_name !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    return res.json(request);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/requests  { book_id, message? }
// Заявитель — текущий пользователь. Владелец определяется по книге.
router.post('/', requireAuth, async (req, res) => {
  const { book_id, message } = req.body || {};
  if (!book_id) return res.status(400).json({ error: 'book_id обязателен' });

  try {
    const book = await getBookById(Number(book_id));
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });

    if (book.book_owner_id === req.user.user_id) {
      return res.status(400).json({ error: 'Нельзя запросить собственную книгу' });
    }

    const request = await createRequest({
      book_id: Number(book_id),
      requester_id: req.user.user_id,
      owner_id: book.book_owner_id,
      message: message || null,
    });
    return res.status(201).json(request);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PATCH /api/requests/:id/status  { status_id }
router.patch('/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status_id } = req.body || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id должен быть числом' });
  }

  const newStatus = Number(status_id);
  if (![1, 2, 3, 4].includes(newStatus)) {
    return res.status(400).json({ error: 'status_id должен быть 1..4' });
  }

  // Статус 1 (sent) — начальный. Перевести обратно в него нельзя никому.
  if (newStatus === 1) {
    return res.status(400).json({ error: 'Статус 1 (sent) устанавливается автоматически' });
  }

  try {
    const request = await getRequestById(id);
    if (!request) return res.status(404).json({ error: 'Запрос не найден' });

    // Менять статус можно только у «свежего» запроса (статус 1 = sent)
    if (request.request_status_id !== 1) {
      return res.status(409).json({
        error: 'Изменить можно только запрос в статусе sent (1)',
      });
    }

    const isRequester = request.request_requester_id === req.user.user_id;
    const isOwner     = request.request_owner_id     === req.user.user_id;
    const isStaff     = req.user.role_name === 'admin' || req.user.role_name === 'moderator';

    let allowed = false;

    // Владелец книги: принять (2) или отклонить (3)
    if (isOwner && (newStatus === 2 || newStatus === 3)) {
      allowed = true;
    }

    // Заявитель: только отменить (4)
    if (isRequester && newStatus === 4) {
      allowed = true;
    }

    // Администратор / модератор: только отменить (4)
    if (isStaff && newStatus === 4) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({
        error: 'Недостаточно прав для установки указанного статуса',
      });
    }

    const updated = await updateRequestStatus(id, newStatus);
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id должен быть числом' });
  try {
    const request = await getRequestById(id);
    if (!request) return res.status(404).json({ error: 'Запрос не найден' });

    const isRequester = request.request_requester_id === req.user.user_id;
    const isAdmin = req.user.role_name === 'admin';
    if (!isRequester && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    await deleteRequest(id);
    return res.status(204).send();
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'Нельзя удалить: есть связанный обмен' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;