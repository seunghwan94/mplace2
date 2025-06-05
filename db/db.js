// db/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// 1. 커넥션 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,        // e.g. 'localhost' 또는 Docker 환경에서는 'db'
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,        // .env 에 정의된 사용자명
  password: process.env.DB_PASSWORD,// .env 에 정의된 비밀번호
  database: process.env.DB_NAME,    // .env 에 정의된 DB 이름
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 2. 현재 pixel_state 테이블에 들어 있는 모든 픽셀을 조회
async function getAllPixels() {
  const [rows] = await pool.query(
    'SELECT x, y, color FROM pixel_state'
  );
  // rows: [{ x: 0, y: 0, color: '#ffffff' }, { ... }, ...]
  return rows;
}

// 3. (x, y) 좌표의 픽셀 업데이트 + 로그 기록
async function updatePixel(x, y, color, nickname, ip) {
  // 3-1) pixel_state 테이블에 REPLACE (기존 행이 있으면 덮어쓰고, 없으면 INSERT)
  await pool.query(
    'REPLACE INTO pixel_state (x, y, color) VALUES (?, ?, ?)',
    [x, y, color]
  );

  // 3-2) pixel_log 테이블에 클릭 로그를 남김
  await pool.query(
    'INSERT INTO pixel_log (x, y, color, nickname, ip) VALUES (?, ?, ?, ?, ?)',
    [x, y, color, nickname, ip]
  );
}

// 4. 특정 날짜에 찍힌 로그를 순서대로 가져오는 함수 (YYYY-MM-DD 형식)
async function getLogsByDate(dateString) {
  // dateString 예: '2025-06-05'
  const [rows] = await pool.query(
    `SELECT x, y, color, nickname, ip, created_at
     FROM pixel_log
     WHERE DATE(created_at) = ?
     ORDER BY created_at ASC`,
    [dateString]
  );
  // rows: [{ x, y, color, nickname, ip, created_at }, ...]
  return rows;
}

module.exports = {
  pool,
  getAllPixels,
  updatePixel,
  getLogsByDate
};
