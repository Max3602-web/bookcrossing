const pool = require('../db');

async function createBook(data) {
  const { title, author_id, description = null, owner_id, status_id = 1 } = data;
  const result = await pool.query(
    `INSERT INTO books
       (book_title, book_author_id, book_description, book_status_id, book_owner_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, author_id, description, status_id, owner_id]
  );
  return result.rows[0];
}

async function getBookById(id) {
  const result = await pool.query(
    `SELECT b.book_id,
            b.book_title,
            b.book_description,
            b.book_status_id,
            bs.book_status_name,
            b.book_owner_id,
            u.user_full_name   AS owner_full_name,
            u.user_city_id     AS owner_city_id,
            c.city_name        AS owner_city_name,
            a.author_id,
            a.author_last_name,
            a.author_first_name,
            b.book_created_at
       FROM books b
       JOIN authors a        ON a.author_id        = b.book_author_id
       JOIN users u          ON u.user_id          = b.book_owner_id
       JOIN cities c         ON c.city_id          = u.user_city_id
       JOIN book_statuses bs ON bs.book_status_id  = b.book_status_id
      WHERE b.book_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listBooks({ title, author, city_id, status_id, owner_id } = {}) {
  const where = [];
  const params = [];

  if (title) {
    params.push(`%${title}%`);
    where.push(`b.book_title ILIKE $${params.length}`);
  }
  if (author) {
    params.push(`%${author}%`);
    where.push(`(a.author_last_name ILIKE $${params.length}
              OR a.author_first_name ILIKE $${params.length})`);
  }
  if (city_id) {
    params.push(city_id);
    where.push(`u.user_city_id = $${params.length}`);
  }
  if (status_id) {
    params.push(status_id);
    where.push(`b.book_status_id = $${params.length}`);
  }
  if (owner_id) {
    params.push(owner_id);
    where.push(`b.book_owner_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT b.book_id,
            b.book_title,
            b.book_description,
            b.book_status_id,
            b.book_owner_id,
            u.user_city_id,
            a.author_last_name,
            a.author_first_name,
            b.book_created_at
       FROM books b
       JOIN authors a ON a.author_id = b.book_author_id
       JOIN users u   ON u.user_id   = b.book_owner_id
       ${whereSql}
       ORDER BY b.book_created_at DESC`,
    params
  );
  return result.rows;
}

async function updateBook(id, data) {
  const fields = [];
  const params = [];

  const map = {
    title:       'book_title',
    author_id:   'book_author_id',
    description: 'book_description',
    status_id:   'book_status_id',
  };

  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${column} = $${params.length}`);
    }
  }

  if (fields.length === 0) return getBookById(id);

  params.push(id);
  const result = await pool.query(
    `UPDATE books SET ${fields.join(', ')}
      WHERE book_id = $${params.length}
      RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteBook(id) {
  const result = await pool.query(
    'DELETE FROM books WHERE book_id = $1 RETURNING book_id',
    [id]
  );
  return result.rowCount > 0;
}

module.exports = {
  createBook,
  getBookById,
  listBooks,
  updateBook,
  deleteBook,
};