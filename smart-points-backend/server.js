require('dotenv').config();


const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const {
  startRankDecayJob,
  processMonthlyRankDecay
} = require('./utils/rankDecayJob');

dotenv.config();

const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const activityRoutes = require('./routes/activityRoutes');
const participationRoutes = require('./routes/participationRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const citizenProfileRoutes = require('./routes/citizenProfileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminProfileRoutes = require('./routes/adminProfileRoutes');
const auditRoutes = require('./routes/auditRoutes');


const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [])
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ],
    credentials: true
  })
);
app.use(express.json());


// Public activity images
app.use(
  '/uploads/activities',
  express.static(path.join(__dirname, 'uploads', 'activities'))
);

// Public reward images
app.use(
  '/uploads/rewards',
  express.static(path.join(__dirname, 'uploads', 'rewards'))
);

// Block direct access to private participation proofs
app.use('/uploads/proofs', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Participation proofs require authorized access.'
  });
});





app.get('/', (req, res) => {
  res.send('Smart Points Backend API is running');
});

app.get('/api/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
message: 'Database query failed'
      });
    }

    res.json({
      success: true,
      message: 'Database connected successfully',
      data: results
    });
  });
});

app.use('/api/auth', authRoutes); 
app.use('/api/activities', activityRoutes);
app.use('/api/participations', participationRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/citizen', citizenProfileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminProfileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit-logs', auditRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
 startRankDecayJob();



});