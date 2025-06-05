// server/adminRoute.js

const express = require('express');
const router = express.Router();
const { getLogsByDate } = require('./db/db');

// 1) 로그인 처리
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
});

// 2) 로그 조회 (타임랩스용)
router.get('/logs', async (req, res) => {
  const date = req.query.date; // 'YYYY-MM-DD'
  if (!date) return res.status(400).json({ message: '날짜 누락' });

  try {
    const logs = await getLogsByDate(date);
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'DB 오류' });
  }
});

module.exports = router;
