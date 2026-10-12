const pool = require('../db');

async function addToWishlist(user_id, book_id) {
  const result = await pool.query(
    `INSERT INTO wishlists_items (wishlist_user_id, wishlist_book_id)
     VALUES ($1, $2)
     RETURNING wishlist_user_id, wishlist_book_id, wishlist_created_at`,
    [user_id, book_id]
  );
  return result.rows[0];
}

async function listWishlist(user_id) {
  const result = await pool.query(
    `SELECT b.book_id,
            b.book_title,
            b.book_description,
            b.book_status_id,
            a.author_last_name,
            a.author_first_name,
            w.wishlist_created_at
       FROM wishlists_items w
       JOIN books b   ON b.book_id   = w.wishlist_book_id
       JOIN authors a ON a.author_id = b.book_author_id
      WHERE w.wishlist_user_id = $1
      ORDER BY w.wishlist_created_at DESC`,
    [user_id]
  );
  return result.rows;
}

async function removeFromWishlist(user_id, book_id) {
  const result = await pool.query(
    `DELETE FROM wishlists_items
      WHERE wishlist_user_id = $1 AND wishlist_book_id = $2
      RETURNING wishlist_book_id`,
    [user_id, book_id]
  );
  return result.rowCount > 0;
}

module.exports = {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
};