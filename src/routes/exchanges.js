const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createExchange,
  getExchangeById,
  listExchanges,
  confirmExchange,
  deleteExchange,
} = require('../repositories/exchanges');
const { getRequestById } = require('../repositories/requests');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status_id, mine } = req.query;
    const user_id = mine === 'false' && req.user.role_name === 'admin'
      ? undefined
      : req.user.user_id;

    const items = await listExchanges({
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
    const exchange = await getExchangeById(id);
    if (!exchange) return res.status(404).json({ error: 'Обмен не найден' });

    const isParticipant =
      exchange.exchange_giver_id === req.user.user_id ||
      exchange.exchange_receiver_id === req.user.user_id;
    if (!isParticipant && req.user.role_name !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    return res.json(exchange);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/exchanges  { request_id }
// Обмен создаётся на основе запроса (request_id уникален в exchanges)
router.post('/', requireAuth, async (req, res) => {
  const { request_id } = req.body || {};
  if (!request_id) return res.status(400).json({ error: 'request_id обязателен' });

  try {
    const request = await getRequestById(Number(request_id));
    if (!request) return res.status(404).json({ error: 'Запрос не найден' });

    // Только владелец книги инициирует обмен
    if (request.request_owner_id !== req.user.user_id && req.user.role_name !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    if (request.request_status_id !== 2) {
      return res.status(400).json({ error: 'Обмен возможен только по принятому запросу' });
    }

    const exchange = await createExchange({
      book_id: request.request_book_id,
      giver_id: request.request_owner_id,
      receiver_id: request.request_requester_id,
      request_id: request.request_id,
    });
    return res.status(201).json(exchange);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'По этому запросу обмен уже создан' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/exchanges/:id/confirm — подтверждение передачи владельцем книги
router.put('/:id/confirm', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id должен быть числом' });
  }
  try {
    const exchange = await getExchangeById(id);
    if (!exchange) return res.status(404).json({ error: 'Обмен не найден' });

    const isGiver = exchange.exchange_giver_id === req.user.user_id;
    const isAdmin = req.user.role_name === 'admin';
    if (!isGiver && !isAdmin) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    if (exchange.exchange_status_id !== 1) {
      return res.status(400).json({ error: 'Подтвердить можно только запрошенный обмен' });
    }

    // Доп. проверка: книга всё ещё у дарителя
    const book = await getBookById(exchange.exchange_book_id);
    if (!book) return res.status(404).json({ error: 'Книга не найдена' });
    if (book.book_holder_id && book.book_holder_id !== exchange.exchange_giver_id) {
      return res.status(409).json({
        error: 'Книга уже передана другому пользователю',
      });
    }

    const updated = await confirmExchange(id);
    if (!updated) return res.status(404).json({ error: 'Обмен не найден' });
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
    const exchange = await getExchangeById(id);
    if (!exchange) return res.status(404).json({ error: 'Обмен не найден' });

    const isParticipant =
      exchange.exchange_giver_id === req.user.user_id ||
      exchange.exchange_receiver_id === req.user.user_id;
    if (!isParticipant && req.user.role_name !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    await deleteExchange(id);
    return res.status(204).send();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;