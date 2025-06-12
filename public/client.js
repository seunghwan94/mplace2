// client.js

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Modal elements
    const nicknameModal = document.getElementById('nicknameModal');
    const nicknameInput = document.getElementById('nicknameInput');
    const joinButton = document.getElementById('joinButton');
    const joinErrorP = document.getElementById('joinError');
    const appContainer = document.getElementById('appContainer');

    // Canvas elements
    const canvas = document.getElementById('pixelCanvas');
    const ctx = canvas.getContext('2d');

    // Control/display elements
    const userNicknameDisplay = document.getElementById('userNicknameDisplay');
    const userCountSpan = document.getElementById('userCount');
    const cooldownTimerP = document.getElementById('cooldownTimer');
    const actionErrorP = document.getElementById('actionError');

    const colorPaletteDiv = document.querySelector('.colorPalette');
    const customColorPicker = document.getElementById('customColorPicker');
    const selectCustomColorButton = document.getElementById('selectCustomColor');

    const zoomInButton = document.getElementById('zoomIn');
    const zoomOutButton = document.getElementById('zoomOut');
    const zoomResetButton = document.getElementById('zoomReset');

    const feedListUl = document.getElementById('feedList');
    const MAX_FEED_ITEMS = 10;

    // Canvas settings - defaults, overridden by server
    let CANVAS_WIDTH = 1000;
    let CANVAS_HEIGHT = 1000;
    const PIXEL_SIZE = 10;
    const GRID_INTERVAL = 10;
    const GRID_LINE_COLOR = '#CCCCCC';

    // User/session state
    let currentNickname = localStorage.getItem('mplaceNickname');
    let selectedColor = '#000000';
    let currentZoom = 1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 30;
    const ZOOM_STEP = 1.2;

    // Panning state
    let isPanning = false;
    let lastPanPosition = { x: 0, y: 0 };
    let viewOffset = { x: 0, y: 0 };

    // Sparse client-side canvas cache
    let clientCanvasState = {};

    // Disable image smoothing
    ctx.imageSmoothingEnabled = false;

    // Restore nickname if saved
    if (currentNickname) {
        nicknameInput.value = currentNickname;
    }

    // Join logic
    joinButton.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim();
        if (nickname && nickname.length <= 50) {
            currentNickname = nickname;
            localStorage.setItem('mplaceNickname', nickname);
            userNicknameDisplay.textContent = nickname;
            joinErrorP.textContent = '';
            socket.emit('requestInitialState', nickname);
        } else {
            joinErrorP.textContent = 'Nickname must be 1-50 characters.';
        }
    });

    socket.on('joinError', (message) => {
        joinErrorP.textContent = message;
        nicknameModal.style.display = 'flex';
        appContainer.style.display = 'none';
    });

    // Initial canvas state
    socket.on('initialCanvas', (data) => {
        const { pixels, width, height } = data;
        CANVAS_WIDTH = width;
        CANVAS_HEIGHT = height;
        clientCanvasState = pixels;

        nicknameModal.style.display = 'none';
        appContainer.style.display = 'flex';

        // Reset zoom & pan
        currentZoom = 2;
        viewOffset = { x: 0, y: 0 };
        redrawFullCanvas();
    });

    // Single pixel updates
    socket.on('pixelUpdated', ({ x, y, color, nickname }) => {
        const coordKey = `${x},${y}`;
        if (color.toUpperCase() === '#FFFFFF') {
            delete clientCanvasState[coordKey];
        } else {
            clientCanvasState[coordKey] = color;
        }

        // Redraw only this cell
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(viewOffset.x, viewOffset.y);
        ctx.scale(currentZoom, currentZoom);

        // Clear & draw
        ctx.fillStyle = color.toUpperCase() === '#FFFFFF' ? '#000000' : color;
        ctx.fillRect(
            x * PIXEL_SIZE,
            y * PIXEL_SIZE,
            GRID_INTERVAL * PIXEL_SIZE,
            GRID_INTERVAL * PIXEL_SIZE
        );

        // Redraw grid cell if needed
        if (x % GRID_INTERVAL === 0 || y % GRID_INTERVAL === 0) {
            ctx.strokeStyle = GRID_LINE_COLOR;
            ctx.lineWidth = Math.max(0.3, 1 / currentZoom);
            ctx.strokeRect(
                x * PIXEL_SIZE,
                y * PIXEL_SIZE,
                PIXEL_SIZE,
                PIXEL_SIZE
            );
        }

        ctx.restore();

        // Update activity feed
        const li = document.createElement('li');
        const chip = document.createElement('span');
        chip.className = 'pixel-color-chip';
        chip.style.backgroundColor = color;
        li.appendChild(chip);

        const nickSpan = document.createElement('span');
        nickSpan.className = 'nickname';
        nickSpan.textContent = nickname || 'Someone';

        const actionSpan = document.createElement('span');
        actionSpan.className = 'action-placed';
        actionSpan.textContent = ` placed at (${x},${y})`;

        li.appendChild(nickSpan);
        li.append(' ');
        li.appendChild(actionSpan);

        feedListUl.prepend(li);
        if (feedListUl.children.length > MAX_FEED_ITEMS) {
            feedListUl.removeChild(feedListUl.lastChild);
        }
    });

    // Other socket events
    socket.on('userCount', count => {
        userCountSpan.textContent = count;
    });

    socket.on('cooldown', timeLeft => {
        actionErrorP.textContent = '';
        if (timeLeft > 0) {
            cooldownTimerP.textContent = `Cooldown: ${timeLeft}s`;
            let interval = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    cooldownTimerP.textContent = `Cooldown: ${timeLeft}s`;
                } else {
                    cooldownTimerP.textContent = 'Cooldown: Ready';
                    clearInterval(interval);
                }
            }, 1000);
        } else {
            cooldownTimerP.textContent = 'Cooldown: Ready';
        }
    });

    socket.on('actionError', message => {
        actionErrorP.textContent = message;
        setTimeout(() => actionErrorP.textContent = '', 3000);
    });

    socket.on('connect_error', err => {
        console.error('Connection Error:', err.message);
        joinErrorP.textContent = `Connection failed: ${err.message}. Server might be down.`;
        appContainer.style.display = 'none';
        nicknameModal.style.display = 'flex';
    });

    socket.on('disconnect', reason => {
        console.log('Disconnected:', reason);
        joinErrorP.textContent = `Disconnected: ${reason}. Attempting to reconnect...`;
        appContainer.style.display = 'none';
        nicknameModal.style.display = 'flex';
    });

    // --- Drawing Helpers ---
    function drawPixelOnCanvas(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(
            x * PIXEL_SIZE,
            y * PIXEL_SIZE,
            GRID_INTERVAL * PIXEL_SIZE,
            GRID_INTERVAL * PIXEL_SIZE
        );
    }

    function drawGrid() {
        ctx.beginPath();
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = Math.max(0.1, 0.5 / currentZoom) * PIXEL_SIZE;

        for (let x = 0; x <= CANVAS_WIDTH; x += GRID_INTERVAL) {
            ctx.moveTo(x * PIXEL_SIZE, 0);
            ctx.lineTo(x * PIXEL_SIZE, CANVAS_HEIGHT * PIXEL_SIZE);
        }
        for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_INTERVAL) {
            ctx.moveTo(0, y * PIXEL_SIZE);
            ctx.lineTo(CANVAS_WIDTH * PIXEL_SIZE, y * PIXEL_SIZE);
        }
        ctx.stroke();
    }

    function redrawFullCanvas() {
        canvas.width = CANVAS_WIDTH * PIXEL_SIZE * currentZoom;
        canvas.height = CANVAS_HEIGHT * PIXEL_SIZE * currentZoom;
        ctx.imageSmoothingEnabled = false;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(viewOffset.x, viewOffset.y);
        ctx.scale(currentZoom, currentZoom);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, CANVAS_WIDTH * PIXEL_SIZE, CANVAS_HEIGHT * PIXEL_SIZE);

        for (const coord in clientCanvasState) {
            const [x, y] = coord.split(',').map(Number);
            drawPixelOnCanvas(x, y, clientCanvasState[coord]);
        }
        drawGrid();
    }

    // --- Interaction ---
    // Disable default context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Click to place pixel (accounts for pan & zoom)
    canvas.addEventListener('click', event => {
        if (!currentNickname || isPanning) return;

        const rect = canvas.getBoundingClientRect();
        const elementX = event.clientX - rect.left;
        const elementY = event.clientY - rect.top;

        const logicalX = (elementX - viewOffset.x) / currentZoom;
        const logicalY = (elementY - viewOffset.y) / currentZoom;

        const cellSize = PIXEL_SIZE * GRID_INTERVAL;
        const gridX = Math.floor(logicalX / cellSize) * GRID_INTERVAL;
        const gridY = Math.floor(logicalY / cellSize) * GRID_INTERVAL;

        if (
            gridX >= 0 && gridX < CANVAS_WIDTH &&
            gridY >= 0 && gridY < CANVAS_HEIGHT
        ) {
            socket.emit('placePixel', { x: gridX, y: gridY, color: selectedColor });
            actionErrorP.textContent = '';
        }
    });

    // Pan via right-click, middle-click, or Ctrl+left-click
    canvas.addEventListener('mousedown', event => {
        if (
            event.button === 2 ||
            event.button === 1 ||
            (event.ctrlKey && event.button === 0)
        ) {
            isPanning = true;
            lastPanPosition = { x: event.clientX, y: event.clientY };
            canvas.style.cursor = 'grabbing';
            event.preventDefault();
        }
    });

    canvas.addEventListener('mousemove', event => {
        if (!isPanning) return;
        const dx = event.clientX - lastPanPosition.x;
        const dy = event.clientY - lastPanPosition.y;
        lastPanPosition = { x: event.clientX, y: event.clientY };

        viewOffset.x += dx;
        viewOffset.y += dy;
        redrawFullCanvas();
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'crosshair';
        }
    });

    // --- Zoom Controls ---
    function doZoom(factor, centerX, centerY) {
        const prevZoom = currentZoom;
        currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * factor));
        if (prevZoom === currentZoom) return;

        viewOffset.x = centerX - (centerX - viewOffset.x) * (currentZoom / prevZoom);
        viewOffset.y = centerY - (centerY - viewOffset.y) * (currentZoom / prevZoom);
        redrawFullCanvas();
    }

    zoomInButton.addEventListener('click', () => doZoom(ZOOM_STEP, canvas.width / 2, canvas.height / 2));
    zoomOutButton.addEventListener('click', () => doZoom(1 / ZOOM_STEP, canvas.width / 2, canvas.height / 2));
    zoomResetButton.addEventListener('click', () => {
        currentZoom = 1;
        viewOffset = { x: 0, y: 0 };
        redrawFullCanvas();
    });

    canvas.addEventListener('wheel', event => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        doZoom(delta, mouseX, mouseY);
    }, { passive: false });

    // --- Color Palette Logic ---
    function updateSelectedButton(newSelectedButton) {
        const currentSelected = colorPaletteDiv.querySelector('.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        if (newSelectedButton) newSelectedButton.classList.add('selected');
    }

    colorPaletteDiv.addEventListener('click', event => {
        if (event.target.classList.contains('color-button')) {
            selectedColor = event.target.dataset.color;
            updateSelectedButton(event.target);
        }
    });

    selectCustomColorButton.addEventListener('click', () => {
        selectedColor = customColorPicker.value;
        updateSelectedButton(null);
    });

    const firstColorButton = colorPaletteDiv.querySelector('.color-button');
    if (firstColorButton) {
        selectedColor = firstColorButton.dataset.color;
        firstColorButton.classList.add('selected');
    } else {
        customColorPicker.value = selectedColor;
    }
});
