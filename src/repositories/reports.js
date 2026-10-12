const pool = require('../db');

/**
 * Отчёт №1. Обмены за период.
 * Отвечает на вопрос: «Сколько обменов прошло, в каком состоянии, откуда и как менялась активность?»
 * Возвращает 4 среза:
 *   - totals:  агрегаты по всему периоду (всего/подтверждено/завершено/передано)
 *   - byStatus: разбивка по статусам обмена
 *   - byCity:   разбивка по городам дарителей
 *   - byMonth:  динамика по месяцам
 */
async function getExchangesReport({ from, to } = {}) {
  const params = [];
  const dateWhere = [];

  if (from) {
    params.push(from);
    dateWhere.push(`e.exchange_created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    dateWhere.push(`e.exchange_created_at <= $${params.length}`);
  }
  const whereSql = dateWhere.length ? `WHERE ${dateWhere.join(' AND ')}` : '';

  const totalsRes = await pool.query(
    `SELECT
       COUNT(*)::int                                                    AS total,
       COUNT(*) FILTER (WHERE e.exchange_status_id = 1)::int           AS requested,
       COUNT(*) FILTER (WHERE e.exchange_status_id = 2)::int           AS confirmed,
       COUNT(*) FILTER (WHERE e.exchange_status_id = 3)::int           AS completed,
       COUNT(*) FILTER (WHERE e.exchange_transfer_date IS NOT NULL)::int AS transferred
     FROM exchanges e
     ${whereSql}`,
    params
  );

  const byStatusRes = await pool.query(
    `SELECT es.exchange_status_name AS status, COUNT(*)::int AS total
       FROM exchanges e
       JOIN exchange_statuses es ON es.exchange_status_id = e.exchange_status_id
       ${whereSql}
       GROUP BY es.exchange_status_name
       ORDER BY total DESC`,
    params
  );

  const byCityRes = await pool.query(
    `SELECT c.city_name AS city, COUNT(*)::int AS total
       FROM exchanges e
       JOIN users u ON u.user_id = e.exchange_giver_id
       JOIN cities c ON c.city_id = u.user_city_id
       ${whereSql}
       GROUP BY c.city_name
       ORDER BY total DESC, c.city_name`,
    params
  );

  const byMonthRes = await pool.query(
    `SELECT TO_CHAR(e.exchange_created_at, 'YYYY-MM') AS month, COUNT(*)::int AS total
       FROM exchanges e
       ${whereSql}
       GROUP BY month
       ORDER BY month`,
    params
  );

  return {
    period: { from: from || null, to: to || null },
    totals: totalsRes.rows[0],
    byStatus: byStatusRes.rows,
    byCity: byCityRes.rows,
    byMonth: byMonthRes.rows,
  };
}

/**
 * Отчёт №2. Активность каталога и пользователей.
 * Отвечает на вопрос: «Что в каталоге сейчас — сколько книг, кто популярнее, как оценивают?»
 * Возвращает:
 *   - totals:      сводные счётчики по всей БД + средняя оценка
 *   - topAuthors:  топ-5 авторов по количеству экземпляров в каталоге
 *   - topBooks:    топ-5 книг по средней оценке (при наличии отзывов)
 *   - byStatus:    разбивка книг по статусам
 */
async function getCatalogReport() {
  const totalsRes = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM books)     AS total_books,
       (SELECT COUNT(*)::int FROM users)     AS total_users,
       (SELECT COUNT(*)::int FROM reviews)   AS total_reviews,
       (SELECT COUNT(*)::int FROM exchanges) AS total_exchanges,
       (SELECT ROUND(AVG(rating_reviews)::numeric, 2) FROM reviews) AS avg_rating_all`
  );

  const topAuthorsRes = await pool.query(
    `SELECT a.author_id,
            a.author_last_name,
            a.author_first_name,
            COUNT(b.book_id)::int AS books_count
       FROM authors a
       LEFT JOIN books b ON b.book_author_id = a.author_id
       GROUP BY a.author_id, a.author_last_name, a.author_first_name
       ORDER BY books_count DESC, a.author_last_name
       LIMIT 5`
  );

  const topBooksRes = await pool.query(
    `SELECT b.book_id,
            b.book_title,
            ROUND(AVG(r.rating_reviews)::numeric, 2) AS avg_rating,
            COUNT(r.review_id)::int                  AS reviews_count
       FROM books b
       JOIN reviews r ON r.review_book_id = b.book_id
       GROUP BY b.book_id, b.book_title
       ORDER BY avg_rating DESC, reviews_count DESC
       LIMIT 5`
  );

  const byStatusRes = await pool.query(
    `SELECT bs.book_status_name AS status, COUNT(*)::int AS total
       FROM books b
       JOIN book_statuses bs ON bs.book_status_id = b.book_status_id
       GROUP BY bs.book_status_name
       ORDER BY total DESC`
  );

  return {
    totals: totalsRes.rows[0],
    byStatus: byStatusRes.rows,
    topAuthors: topAuthorsRes.rows,
    topBooks: topBooksRes.rows,
  };
}

module.exports = { getExchangesReport, getCatalogReport };