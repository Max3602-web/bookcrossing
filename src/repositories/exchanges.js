const pool = require('../db');

async function createExchange({ book_id, giver_id, receiver_id, request_id }) {
  const result = await pool.query(
    `INSERT INTO exchanges
       (exchange_book_id, exchange_giver_id, exchange_receiver_id,
        exchange_request_id, exchange_status_id)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [book_id, giver_id, receiver_id, request_id]
  );
  return result.rows[0];
}

async function getExchangeById(id) {
  const result = await pool.query(
    `SELECT e.*,
            es.exchange_status_name,
            b.book_title,
            g.user_full_name AS giver_name,
            r.user_full_name AS receiver_name
       FROM exchanges e
       JOIN exchange_statuses es ON es.exchange_status_id = e.exchange_status_id
       JOIN books b              ON b.book_id             = e.exchange_book_id
       JOIN users g              ON g.user_id             = e.exchange_giver_id
       JOIN users r              ON r.user_id             = e.exchange_receiver_id
      WHERE e.exchange_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listExchanges({ user_id, status_id } = {}) {
  const where = [];
  const params = [];

  if (user_id) {
    params.push(user_id);
    where.push(`(e.exchange_giver_id = $${params.length}
              OR e.exchange_receiver_id = $${params.length})`);
  }
  if (status_id) {
    params.push(status_id);
    where.push(`e.exchange_status_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT e.*, es.exchange_status_name, b.book_title
       FROM exchanges e
       JOIN exchange_statuses es ON es.exchange_status_id = e.exchange_status_id
       JOIN books b              ON b.book_id             = e.exchange_book_id
       ${whereSql}
       ORDER BY e.exchange_created_at DESC`,
    params
  );
  return result.rows;
}

async function confirmExchange(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Подтверждаем обмен
    const exchRes = await client.query(
      `UPDATE exchanges
          SET exchange_status_id = 2,
              exchange_transfer_date = NOW()
        WHERE exchange_id = $1
        RETURNING *`,
      [id]
    );
    const exchange = exchRes.rows[0];
    if (!exchange) {
      await client.query('ROLLBACK');
      return null;
    }

    // 2. Переводим книгу на получателя: меняем holder и статус
    await client.query(
      `UPDATE books
          SET book_holder_id = $1,
              book_status_id = 2      -- 2 = at_reader (у читателя)
        WHERE book_id = $2`,
      [exchange.exchange_receiver_id, exchange.exchange_book_id]
    );

    await client.query('COMMIT');
    return exchange;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deleteExchange(id) {
  const result = await pool.query(
    'DELETE FROM exchanges WHERE exchange_id = $1 RETURNING exchange_id',
    [id]
  );
  return result.rowCount > 0;
}

module.exports = {
  createExchange,
  getExchangeById,
  listExchanges,
  confirmExchange,
  deleteExchange,
};