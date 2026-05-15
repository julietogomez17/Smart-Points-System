const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_points_secret_key';

// REGISTER
exports.register = async (req, res) => {
  const { full_name, email, password, role, partner_name } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ message: 'All required fields must be filled' });
  }

  if (role === 'partner' && !partner_name) {
    return res.status(400).json({ message: 'Organization name is required for partners' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const userSql = `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `;

    db.query(userSql, [full_name, email, hashedPassword, role], (err, result) => {
      if (err) {
        console.error('Register user error:', err);
        return res.status(500).json({ message: 'Registration failed' });
      }

      const userId = result.insertId;

      if (role === 'partner') {
        const partnerSql = `
          INSERT INTO partners (partner_id, organization_name, email, status)
          VALUES (?, ?, ?, ?)
        `;

        db.query(partnerSql, [userId, partner_name, email, 'active'], (partnerErr) => {
          if (partnerErr) {
            console.error('Register partner error:', partnerErr);
            return res.status(500).json({ message: 'Partner registration failed' });
          }

          return res.status(201).json({ message: 'Registration successful' });
        });
      } else {
        return res.status(201).json({ message: 'Registration successful' });
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// LOGIN
exports.login = (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT
      users.user_id,
      users.full_name,
      users.email,
      users.password_hash,
      users.role,
      users.points_balance,
      partners.organization_name
    FROM users
    LEFT JOIN partners
      ON users.user_id = partners.partner_id
    WHERE users.email = ?
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('Login database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const user = results[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        points_balance: user.points_balance,
        partner_name: user.organization_name || null
      }
    });
  });
};

// CURRENT USER
exports.getCurrentUser = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      users.user_id,
      users.full_name,
      users.email,
      users.role,
      users.points_balance,
      partners.organization_name
    FROM users
    LEFT JOIN partners
      ON users.user_id = partners.partner_id
    WHERE users.user_id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Get current user error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const user = results[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        points_balance: user.points_balance,
        partner_name: user.organization_name || null
      }
    });
  });
};