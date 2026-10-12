const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.user_email,
      role_id: user.user_role_id,
      role_name: user.role_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

router.post('/register', async (req, res) => {
  const { full_name, email, password, city_id, role_id } = req.body || {};

  if (!full_name || !email || !password || !city_id) {
    return res.status(400).json({ error: 'full_name, email, password, city_id обязательны' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль короче 6 символов' });
  }

  try {
    const hash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users
         (user_full_name, user_email, user_password_hash, user_role_id, user_city_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, user_full_name, user_email, user_role_id, user_city_id, user_created_at`,
      [full_name, email, hash, role_id || 1, city_id]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email уже занят' });
    if (e.code === '23503') return res.status(400).json({ error: 'Некорректный city_id или role_id' });
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email и password обязательны' });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.user_full_name, u.user_email, u.user_password_hash,
              u.user_role_id, r.role_name
         FROM users u
         JOIN roles r ON r.role_id = u.user_role_id
        WHERE u.user_email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const ok = await verifyPassword(password, user.user_password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = signToken(user);
    return res.status(200).json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.user_full_name,
        email: user.user_email,
        role_name: user.role_name,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT u.user_id, u.user_full_name, u.user_email, u.user_city_id,
            u.rating_users, r.role_name
       FROM users u
       JOIN roles r ON r.role_id = u.user_role_id
      WHERE u.user_id = $1`,
    [req.user.user_id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
  return res.json(result.rows[0]);
});

module.exports = router;