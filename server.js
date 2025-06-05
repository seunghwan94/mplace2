// server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const path = require('path');
const { pool, updatePixel, getAllPixels } = require('./db/db');
const adminRoute = require('./adminRoute');

const app = express();
const server = http.createServer(app);

// Socket.IO 설정
const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

// 접속자 수를 브로드캐스트하는 헬퍼 함수
function broadcastOnlineCount() {
  const count = io.engine.clientsCount; // 현재 총 웹소켓 연결 수
  io.emit('online_count', count);
}

// 1) 정적 파일 서빙
app.use('/', express.static(path.join(__dirname, 'public')));

// 2) 관리자 API 라우트
app.use('/admin/data', express.json(), adminRoute);

// 3) Socket.IO 로직
const cooldownMap = new Map();
const COOLDOWN_MS = 3000;

io.on('connection', (socket) => {
  // 새 클라이언트가 접속할 때마다 온라인 수 브로드캐스트
  broadcastOnlineCount();

  socket.on('join', (nickname) => {
    socket.data.nickname = nickname;
    socket.data.clientIp = socket.handshake.address;
  });

  socket.on('pixel_click', async ({ x, y, color }) => {
    const nickname = socket.data.nickname || '익명';
    const ip = socket.data.clientIp || '';

    const now = Date.now();
    const lastClick = cooldownMap.get(socket.id) || 0;
    if (now - lastClick < COOLDOWN_MS) {
      return socket.emit('error_message', '3초 쿨다운이 남았습니다.');
    }
    cooldownMap.set(socket.id, now);

    try {
      await updatePixel(x, y, color, nickname, ip);
    } catch (err) {
      console.error('DB 업데이트 오류:', err);
      return socket.emit('error_message', '서버 오류가 발생했습니다.');
    }

    io.emit('pixel_update', { x, y, color });
  });

  socket.on('disconnect', () => {
    cooldownMap.delete(socket.id);
    // 클라이언트가 나갈 때마다 온라인 수 갱신
    broadcastOnlineCount();
  });
});

// 4) 픽셀 상태 조회 API
app.get('/api/pixels', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT x, y, color FROM pixel_state');
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

// 5) 서버 시작
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
