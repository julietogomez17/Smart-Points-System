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



const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get('/', (req, res) => {
  res.send('Smart Points Backend API is running');
});

app.get('/api/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database query failed',
        error: err.message
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


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
 startRankDecayJob();

});