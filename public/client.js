// public/client.js

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // 내부 캔버스 해상도 (HTML <canvas width="1000" height="1000"> 와 동일)
  const INTERNAL_SIZE = 1000;

  // DOM 요소 캐싱
  const canvas = document.getElementById('pixelCanvas');
  const ctx = canvas.getContext('2d');
  const nicknameInput = document.getElementById('nicknameInput');
  const colorPicker = document.getElementById('colorPicker');
  const cooldownMsg = document.getElementById('cooldownMsg');
  const onlineCountSpan = document.getElementById('onlineCount');

  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');

  // 로컬 쿨다운 상태
  let lastClickTime = 0;
  const COOLDOWN_MS = 3000;
  let cooldownIntervalId = null;

  // 현재 줌 레벨 (1.0 = 기본, >1.0 = 확대, <1.0 = 축소)
  let zoomLevel = 1.0;
  const ZOOM_STEP = 0.2;  // 한 번 누를 때마다 20%씩 증감
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3.0;

  // ────────────────────────────────────────────────────────────────
  // 1) 닉네임 관리 (localStorage ↔ 서버 join)
  // ────────────────────────────────────────────────────────────────
  const savedNick = localStorage.getItem('mplace_nickname');
  if (savedNick) {
    nicknameInput.value = savedNick;
    socket.emit('join', savedNick);
  }

  nicknameInput.addEventListener('change', () => {
    const nick = nicknameInput.value.trim();
    if (nick.length >= 3 && nick.length <= 12) {
      localStorage.setItem('mplace_nickname', nick);
      socket.emit('join', nick);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 2) 캔버스 초기화: 배경 + 격자 그리기
  // ────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, INTERNAL_SIZE, INTERNAL_SIZE);

    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= INTERNAL_SIZE; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERNAL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= INTERNAL_SIZE; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERNAL_SIZE, y);
      ctx.stroke();
    }
  }
  drawGrid();

  // ────────────────────────────────────────────────────────────────
  // 3) 초기 픽셀 상태 불러와서 그리기
  // ────────────────────────────────────────────────────────────────
  fetch('/api/pixels')
    .then(res => res.json())
    .then(pixels => {
      pixels.forEach(({ x, y, color }) => {
        drawPixel(x, y, color);
      });
    })
    .catch(err => {
      console.error('초기 픽셀 로드 오류:', err);
    });

  // ────────────────────────────────────────────────────────────────
  // 4) 픽셀 그리기 함수
  // ────────────────────────────────────────────────────────────────
  function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    // 10×10 셀 안쪽 8×8 영역을 채워서 격자선과 겹치지 않도록 함
    ctx.fillRect(x * 10 + 1, y * 10 + 1, 8, 8);
  }

  // ────────────────────────────────────────────────────────────────
  // 5) 로컬 쿨다운 처리
  // ────────────────────────────────────────────────────────────────
  function canClick() {
    return Date.now() - lastClickTime >= COOLDOWN_MS;
  }

  function startLocalCooldown() {
    let remaining = COOLDOWN_MS;
    cooldownMsg.textContent = `${Math.ceil(remaining / 1000)}초`;

    cooldownIntervalId = setInterval(() => {
      remaining -= 1000;
      if (remaining > 0) {
        cooldownMsg.textContent = `${Math.ceil(remaining / 1000)}초`;
      } else {
        clearInterval(cooldownIntervalId);
        cooldownIntervalId = null;
        cooldownMsg.textContent = '';
      }
    }, 1000);
  }

  // ────────────────────────────────────────────────────────────────
  // 6) 캔버스 클릭 이벤트 (좌표 보정 + 서버 전송)
  // ────────────────────────────────────────────────────────────────
  canvas.addEventListener('click', (e) => {
    const nick = nicknameInput.value.trim();
    if (!nick || nick.length < 3 || nick.length > 12) {
      alert('닉네임을 3~12자로 입력해주세요.');
      return;
    }

    // 로컬 쿨다운 체크
    if (!canClick()) {
      return;
    }

    // 클릭 시각 기록 및 쿨다운 시작
    lastClickTime = Date.now();
    startLocalCooldown();
    localStorage.setItem('mplace_nickname', nick);

    // 화면에 보이는 캔버스 크기
    const rect = canvas.getBoundingClientRect();
    const displayWidth  = rect.width;
    const displayHeight = rect.height;

    // 클릭한 화면 좌표 (캔버스 내부 상대 위치)
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 화면 크기 → 내부 1000×1000 좌표 비율
    const scaleX = INTERNAL_SIZE / displayWidth;
    const scaleY = INTERNAL_SIZE / displayHeight;

    // 내부 캔버스 좌표 (0 ~ 1000)
    const internalX = clickX * scaleX;
    const internalY = clickY * scaleY;

    // 셀 단위 인덱스 (0 ~ 99)
    const gridX = Math.floor(internalX / 10);
    const gridY = Math.floor(internalY / 10);

    if (gridX < 0 || gridX > 99 || gridY < 0 || gridY > 99) {
      return;
    }

    const color = colorPicker.value;
    socket.emit('pixel_click', { x: gridX, y: gridY, color });
  });

  // ────────────────────────────────────────────────────────────────
  // 7) Socket.IO 이벤트 수신
  // ────────────────────────────────────────────────────────────────
  socket.on('pixel_update', ({ x, y, color }) => {
    drawPixel(x, y, color);
  });

  socket.on('error_message', (msg) => {
    console.warn('서버:', msg);
  });

  // 온라인 접속자 수 표시 (서버에서 해당 이벤트를 브로드캐스트해야 함)
  socket.on('online_count', (count) => {
    onlineCountSpan.textContent = count;
  });

  // ────────────────────────────────────────────────────────────────
  // 8) 줌(In/Out/Reset) 버튼 기능 구현
  // ────────────────────────────────────────────────────────────────
  function applyZoom() {
    // transform-origin: top left 기준으로 확대/축소
    canvas.style.transform = `scale(${zoomLevel})`;
  }

  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
    applyZoom();
  });

  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
    applyZoom();
  });

  zoomResetBtn.addEventListener('click', () => {
    zoomLevel = 1.0;
    applyZoom();
  });

  // ────────────────────────────────────────────────────────────────
  // 9) 터치 디바이스 감지 및 기타 초기화
  // ────────────────────────────────────────────────────────────────
  if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
  }
});
