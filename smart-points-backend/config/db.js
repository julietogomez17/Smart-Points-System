
const mysql = require('mysql2');
require('dotenv').config();

const useSSL = process.env.DB_SSL === 'true';

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
    // Interpret MySQL DATETIME values as Philippine local time.
  timezone: '+08:00',

  // Enable SSL for cloud MySQL, disable for local XAMPP.
  ...(useSSL
    ? {
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        }
      }
    : {}),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});
  // Set Philippine Time for every MySQL connection in the pool.
db.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'", (error) => {
    if (error) {
      console.error('Failed to set MySQL timezone:', error.message);
    }
  });
});
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }

  console.log('Database connected successfully');
  connection.release();
});

module.exports = db;
