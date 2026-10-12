const pool = require('../db');

async function createReview({ book_id, author_id, text, rating }) {
  const result = await pool.query(
    `INSERT INTO reviews
       (review_book_id, review_author_id, review_text, rating_reviews)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [book_id, author_id, text, rating]
  );
  return result.rows[0];
}

async function getReviewById(id) {
  const result = await pool.query(
    `SELECT r.*, u.user_full_name AS author_name
       FROM reviews r
       JOIN users u ON u.user_id = r.review_author_id
      WHERE r.review_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listReviewsByBook(book_id) {
  const result = await pool.query(
    `SELECT r.*, u.user_full_name AS author_name
       FROM reviews r
       JOIN users u ON u.user_id = r.review_author_id
      WHERE r.review_book_id = $1
      ORDER BY r.review_created_at DESC`,
    [book_id]
  );
  return result.rows;
}

async function getAverageRating(book_id) {
  const result = await pool.query(
    `SELECT ROUND(AVG(rating_reviews)::numeric, 2) AS avg_rating,
            COUNT(*) AS reviews_count
       FROM reviews
      WHERE review_book_id = $1`,
    [book_id]
  );
  return result.rows[0];
}

async function updateReview(id, data) {
  const fields = [];
  const params = [];
  const map = { text: 'review_text', rating: 'rating_reviews' };

  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${column} = $${params.length}`);
    }
  }
  if (fields.length === 0) return getReviewById(id);

  params.push(id);
  const result = await pool.query(
    `UPDATE reviews SET ${fields.join(', ')}
      WHERE review_id = $${params.length}
      RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteReview(id) {
  const result = await pool.query(
    'DELETE FROM reviews WHERE review_id = $1 RETURNING review_id',
    [id]
  );
  return result.rowCount > 0;
}

module.exports = {
  createReview,
  getReviewById,
  listReviewsByBook,
  getAverageRating,
  updateReview,
  deleteReview,
};