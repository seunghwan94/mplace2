// public/admin/admin.js

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('loginSection');
  const adminSection = document.getElementById('adminSection');
  const adminUser = document.getElementById('adminUser');
  const adminPass = document.getElementById('adminPass');
  const loginBtn = document.getElementById('loginBtn');
  const messageDiv = document.getElementById('message');

  const datePicker = document.getElementById('datePicker');
  const playBtn = document.getElementById('playBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');

  const progressBar = document.querySelector('.progress-bar');
  const progressFill = document.querySelector('.progress-fill');

  const adminCanvas = document.getElementById('adminCanvas');
  const ctx = adminCanvas.getContext('2d');

  const totalClicksSpan = document.getElementById('totalClicks');
  const activeUsersSpan = document.getElementById('activeUsers');
  const recentList = document.getElementById('recentList');

  // 내부 캔버스 해상도(1000×1000)
  const INTERNAL_SIZE = 1000;
  let zoomLevel = 1.0;
  const ZOOM_STEP = 0.2;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3.0;

  // ────────────────────────────────────────────────────────────────
  // 1) 캔버스 격자 그리기 (100×100 격자)
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
  // 2) 페이지 로드 시 오늘 날짜를 기본값으로 설정
  // ────────────────────────────────────────────────────────────────
  (function initDate() {
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
  })();

  // ────────────────────────────────────────────────────────────────
  // 3) 관리자 로그인 처리
  // ────────────────────────────────────────────────────────────────
  loginBtn.addEventListener('click', async () => {
    const username = adminUser.value.trim();
    const password = adminPass.value.trim();
    if (!username || !password) {
      messageDiv.innerHTML =
        '<div class="message error"><i class="fas fa-exclamation-triangle"></i> 아이디와 비밀번호를 모두 입력해주세요.</div>';
      return;
    }

    try {
      const res = await fetch('/admin/data/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('인증 실패');
      const data = await res.json();
      if (data.success) {
        messageDiv.innerHTML =
          '<div class="message success"><i class="fas fa-check-circle"></i> 로그인 성공!</div>';
        setTimeout(() => {
          loginSection.style.display = 'none';
          adminSection.style.display = 'block';
          playBtn.disabled = false;
        }, 800);
      } else {
        messageDiv.innerHTML =
          '<div class="message error"><i class="fas fa-exclamation-triangle"></i> 잘못된 인증 정보입니다.</div>';
      }
    } catch (err) {
      console.error(err);
      messageDiv.innerHTML =
        '<div class="message error"><i class="fas fa-exclamation-triangle"></i> 서버 오류가 발생했습니다.</div>';
    }
  });

  // Enter 키로 로그인
  adminPass.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginBtn.click();
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 4) playBtn 클릭 → 타임랩스 재생 & 통계·로그 업데이트
  // ────────────────────────────────────────────────────────────────
  playBtn.addEventListener('click', async () => {
    const date = datePicker.value; // 'YYYY-MM-DD'
    if (!date) return;

    // (A) 캔버스 초기화
    drawGrid();

    // (B) 프로그레스 UI 초기화
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    playBtn.innerHTML = '<i class="fas fa-spinner loading"></i> 재생 중...';
    playBtn.disabled = true;

    try {
      // (C) 서버에서 해당 날짜의 모든 로그 가져오기
      const res = await fetch(`/admin/data/logs?date=${date}`);
      if (!res.ok) throw new Error('로그 데이터를 가져오는 중 오류');
      const logs = await res.json();
      // logs: [{ x, y, color, nickname, ip, created_at }, ...]

      // (D) 통계 계산: 총 클릭 수 = logs.length, 활성 사용자 = unique nickname 수
      const totalCount = logs.length;
      const uniqueNicks = new Set(logs.map((item) => item.nickname));
      const activeCount = uniqueNicks.size;

      // 화면에 통계 반영
      totalClicksSpan.textContent = totalCount.toLocaleString();
      activeUsersSpan.textContent = activeCount.toLocaleString();

      // (E) 타임랩스 재생: 1초(=1000ms) 간격으로 순차 그리기
      let idx = 0;
      const total = logs.length;
      if (total === 0) {
        // 로그가 없으면 바로 완료 처리
        finishPlayback();
        return;
      }

      const interval = setInterval(() => {
        if (idx >= total) {
          clearInterval(interval);
          finishPlayback();
          return;
        }
        const { x, y, color, nickname, ip, created_at } = logs[idx++];

        // 1) 캔버스에 픽셀 그리기
        ctx.fillStyle = color;
        ctx.fillRect(x * 10 + 1, y * 10 + 1, 8, 8);

        // 2) 실시간 총 클릭 수(재생 중 누적) → idx 기준
        totalClicksSpan.textContent = idx.toLocaleString();

        // 3) 실시간 활성 사용자(재생 중 누적) → idx 로그까지의 unique nickname 개수
        const nicksSoFar = new Set(logs.slice(0, idx).map((item) => item.nickname));
        activeUsersSpan.textContent = nicksSoFar.size.toLocaleString();

        // 4) 최근 로그 리스트 업데이트
        addRecentLog({ color, nickname, ip, created_at });

        // 5) 프로그레스 바 업데이트
        const percent = Math.floor((idx / total) * 100);
        progressFill.style.width = percent + '%';
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('로그 로드 중 오류가 발생했습니다.');
      finishPlayback();
    }
  });

  // 재생 완료 시 UI 복귀 함수
  function finishPlayback() {
    playBtn.innerHTML = '<i class="fas fa-play"></i> 재생 시작';
    playBtn.disabled = false;
    setTimeout(() => {
      progressBar.style.display = 'none';
      progressFill.style.width = '0%';
    }, 500);
  }

  // ────────────────────────────────────────────────────────────────
  // 5) 최근 로그 리스트에 항목 추가 (최대 10개, 최신순)
  // ────────────────────────────────────────────────────────────────
  function addRecentLog({ color, nickname, ip, created_at }) {
    const li = document.createElement('li');
    li.classList.add('log-item');

    // (1) 색상 스와치
    const swatch = document.createElement('span');
    swatch.classList.add('color-swatch');
    swatch.style.backgroundColor = color;
    li.appendChild(swatch);

    // (2) 정보 영역
    const infoDiv = document.createElement('div');
    infoDiv.classList.add('log-info');

    // 닉네임
    const nickSpan = document.createElement('div');
    nickSpan.classList.add('nickname');
    nickSpan.textContent = nickname;
    infoDiv.appendChild(nickSpan);

    // IP
    const ipSpan = document.createElement('div');
    ipSpan.classList.add('coordinates');
    ipSpan.textContent = ip;
    infoDiv.appendChild(ipSpan);

    // 시간 (HH:MM:SS 기준)
    const timeSpan = document.createElement('div');
    timeSpan.classList.add('time');
    let timeOnly;
    if (typeof created_at === 'string') {
      const dt = new Date(created_at);
      const h = String(dt.getHours()).padStart(2, '0');
      const m = String(dt.getMinutes()).padStart(2, '0');
      const s = String(dt.getSeconds()).padStart(2, '0');
      timeOnly = `${h}:${m}:${s}`;
    } else {
      const dt = new Date(created_at);
      const h = String(dt.getHours()).padStart(2, '0');
      const m = String(dt.getMinutes()).padStart(2, '0');
      const s = String(dt.getSeconds()).padStart(2, '0');
      timeOnly = `${h}:${m}:${s}`;
    }
    timeSpan.textContent = timeOnly;
    infoDiv.appendChild(timeSpan);

    li.appendChild(infoDiv);

    // (3) 리스트 맨 위에 추가
    recentList.prepend(li);

    // (4) 최대 10개 유지
    while (recentList.children.length > 10) {
      recentList.removeChild(recentList.lastChild);
    }
  }

  // 새로고침 버튼 클릭 시 캔버스·로그·통계 초기화
  refreshBtn.addEventListener('click', () => {
    drawGrid();
    recentList.innerHTML = '';
    totalClicksSpan.textContent = '0';
    activeUsersSpan.textContent = '0';
    progressFill.style.width = '0%';
  });

  // ────────────────────────────────────────────────────────────────
  // 6) Canvas 줌(In/Out/Reset) 기능
  // ────────────────────────────────────────────────────────────────
  function applyZoom() {
    adminCanvas.style.transform = `scale(${zoomLevel})`;
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
});
