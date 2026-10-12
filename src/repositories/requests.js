const pool = require('../db');

async function createRequest({ book_id, requester_id, owner_id, message = null }) {
  const result = await pool.query(
    `INSERT INTO requests
       (request_book_id, request_requester_id, request_owner_id, request_message, request_status_id)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [book_id, requester_id, owner_id, message]
  );
  return result.rows[0];
}

async function getRequestById(id) {
  const result = await pool.query(
    `SELECT r.*,
            rs.request_status_name,
            b.book_title,
            u_req.user_full_name AS requester_name,
            u_own.user_full_name AS owner_name
       FROM requests r
       JOIN request_statuses rs ON rs.request_status_id = r.request_status_id
       JOIN books b             ON b.book_id            = r.request_book_id
       JOIN users u_req         ON u_req.user_id        = r.request_requester_id
       JOIN users u_own         ON u_own.user_id        = r.request_owner_id
      WHERE r.request_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listRequests({ user_id, status_id } = {}) {
  const where = [];
  const params = [];

  if (user_id) {
    params.push(user_id);
    where.push(`(r.request_requester_id = $${params.length}
              OR r.request_owner_id     = $${params.length})`);
  }
  if (status_id) {
    params.push(status_id);
    where.push(`r.request_status_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT r.*, rs.request_status_name, b.book_title
       FROM requests r
       JOIN request_statuses rs ON rs.request_status_id = r.request_status_id
       JOIN books b             ON b.book_id            = r.request_book_id
       ${whereSql}
       ORDER BY r.request_created_at DESC`,
    params
  );
  return result.rows;
}

async function updateRequestStatus(id, status_id) {
  const result = await pool.query(
    `UPDATE requests
        SET request_status_id = $1,
            request_updated_at = NOW()
      WHERE request_id = $2
      RETURNING *`,
    [status_id, id]
  );
  return result.rows[0] || null;
}

async function deleteRequest(id) {
  const result = await pool.query(
    'DELETE FROM requests WHERE request_id = $1 RETURNING request_id',
    [id]
  );
  return result.rowCount > 0;
}

module.exports = {
  createRequest,
  getRequestById,
  listRequests,
  updateRequestStatus,
  deleteRequest,
};