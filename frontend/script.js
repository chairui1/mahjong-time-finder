// 自动检测 API 地址：部署时使用当前域名，本地开发时使用 localhost
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `${window.location.origin}/api`;

// 使用固定的房间号（仅用于数据分组）
const DEFAULT_ROOM_CODE = 'MAJIANG';

// 预设 4 个固定玩家
const PLAYER_CONFIG = [
    { id: 'player1', label: '玩家 1', colorClass: 'player-1' },
    { id: 'player2', label: '玩家 2', colorClass: 'player-2' },
    { id: 'player3', label: '玩家 3', colorClass: 'player-3' },
    { id: 'player4', label: '玩家 4', colorClass: 'player-4' },
];

// 时间段（固定四段；晚上按你的需求：20:00-24:00，仅用于展示/列表）
const SEGMENTS = [
    { key: 'morning', label: '上午', start: '08:00', end: '12:00' },
    { key: 'noon', label: '中午', start: '12:00', end: '14:00' },
    { key: 'afternoon', label: '下午', start: '14:00', end: '18:00' },
    { key: 'evening', label: '晚上', start: '20:00', end: '24:00' },
];

let currentNickname = null;
let currentPlayerId = null;

// 当前显示的月份（本地时区）
let currentYear = null;
let currentMonth = null; // 1-12

// 本月数据缓存：availability[nickname][date][segment] = 0/1
let monthAvailability = {};
// 共同空闲集合：key = date|segment
let monthCommon = new Set();

// 拖拽涂色状态
let isPainting = false;
let paintValue = 1; // 1=设为可用，0=设为不可用

// 批量保存缓冲
let pendingChanges = new Map(); // key = date|segment -> available
let flushTimer = null;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    const identityButtons = document.querySelectorAll('.identity-button');
    const timeSection = document.getElementById('timeSection');
    const currentNicknameDisplay = document.getElementById('currentNicknameDisplay');
    const monthTitle = document.getElementById('monthTitle');
    const monthGrid = document.getElementById('monthGrid');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    // 恢复本地已选择的身份
    try {
        const savedId = localStorage.getItem('mahjong_player_id');
        if (savedId) {
            const player = PLAYER_CONFIG.find(p => p.id === savedId);
            if (player) {
                setCurrentPlayer(player, identityButtons, timeSection, currentNicknameDisplay);
            }
        }
    } catch (e) {
        console.warn('无法读取本地身份信息:', e);
    }

    // 身份按钮点击事件
    identityButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-player-id');
            const player = PLAYER_CONFIG.find(p => p.id === id);
            if (!player) return;
            setCurrentPlayer(player, identityButtons, timeSection, currentNicknameDisplay);
            try {
                localStorage.setItem('mahjong_player_id', id);
            } catch (e) {
                console.warn('无法保存本地身份信息:', e);
            }
        });
    });

    // 初始化当前月份为“本月”
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth() + 1;

    // 月份切换
    prevMonthBtn.addEventListener('click', () => {
        shiftMonth(-1);
        renderMonthHeader(monthTitle);
        fetchAndRenderMonth(monthGrid, monthTitle);
    });
    nextMonthBtn.addEventListener('click', () => {
        shiftMonth(1);
        renderMonthHeader(monthTitle);
        fetchAndRenderMonth(monthGrid, monthTitle);
    });

    renderMonthHeader(monthTitle);
    renderEmptyGrid(monthGrid); // 先渲染骨架，避免白屏

    // 如果已经选了身份（localStorage 恢复），则立即拉取本月数据
    if (currentNickname) {
        timeSection.style.display = 'block';
        fetchAndRenderMonth(monthGrid, monthTitle);
    }
});

function setCurrentPlayer(player, buttons, timeSection, displayEl) {
    currentNickname = player.label;
    currentPlayerId = player.id;
    // 更新按钮样式
    buttons.forEach(b => b.classList.remove('selected'));
    const activeBtn = Array.from(buttons).find(b => b.getAttribute('data-player-id') === player.id);
    if (activeBtn) activeBtn.classList.add('selected');
    // 显示身份
    displayEl.textContent = player.label;
    // 显示时间表单区域
    timeSection.style.display = 'block';

    // 切换身份后立刻刷新本月数据（用于显示别人的点、共同空闲等）
    const monthTitle = document.getElementById('monthTitle');
    const monthGrid = document.getElementById('monthGrid');
    renderMonthHeader(monthTitle);
    fetchAndRenderMonth(monthGrid, monthTitle);
}

function shiftMonth(delta) {
    let y = currentYear;
    let m = currentMonth + delta;
    if (m < 1) {
        m = 12;
        y -= 1;
    } else if (m > 12) {
        m = 1;
        y += 1;
    }
    currentYear = y;
    currentMonth = m;
}

function renderMonthHeader(monthTitleEl) {
    if (!monthTitleEl) return;
    monthTitleEl.textContent = `${currentYear} 年 ${String(currentMonth).padStart(2, '0')} 月`;
}

function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate(); // month: 1-12
}

function formatDate(year, month, day) {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function getPlayerColorClassById(playerId) {
    const p = PLAYER_CONFIG.find(x => x.id === playerId);
    return p ? p.colorClass : '';
}

function getPlayerColorClassByLabel(label) {
    const p = PLAYER_CONFIG.find(x => x.label === label);
    return p ? p.colorClass : '';
}

function ensureAvailMap() {
    monthAvailability = {};
    PLAYER_CONFIG.forEach(p => {
        monthAvailability[p.label] = {};
    });
}

function renderEmptyGrid(container) {
    if (!container) return;
    const header = `
      <div class="grid-row grid-header">
        <div class="grid-cell day-cell">日期</div>
        ${SEGMENTS.map(s => `<div class="grid-cell">${s.label}</div>`).join('')}
      </div>
    `;
    container.innerHTML = header + `<div class="grid-row"><div class="grid-cell" style="grid-column: 1 / span 5; color:#777;">加载中…</div></div>`;
}

async function fetchAndRenderMonth(monthGridEl, monthTitleEl) {
    if (!currentNickname) {
        // 未选择身份时不加载
        return;
    }
    renderMonthHeader(monthTitleEl);
    renderEmptyGrid(monthGridEl);

    try {
        const url = `${API_BASE_URL}/availability/month?year=${currentYear}&month=${currentMonth}&room_code=${encodeURIComponent(DEFAULT_ROOM_CODE)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.success) {
            throw new Error(data.error || '加载失败');
        }

        ensureAvailMap();
        monthCommon = new Set();

        // entries: [{nickname,date,segment,available}]
        for (const e of (data.entries || [])) {
            if (!monthAvailability[e.nickname]) {
                monthAvailability[e.nickname] = {};
            }
            if (!monthAvailability[e.nickname][e.date]) {
                monthAvailability[e.nickname][e.date] = {};
            }
            monthAvailability[e.nickname][e.date][e.segment] = e.available;
        }

        for (const c of (data.common || [])) {
            monthCommon.add(`${c.date}|${c.segment}`);
        }

        renderMonthGrid(monthGridEl);
        renderCommonList();
    } catch (e) {
        console.error(e);
        if (monthGridEl) {
            monthGridEl.innerHTML = `<div class="grid-row"><div class="grid-cell" style="grid-column: 1 / span 5; color:#d32f2f;">加载失败：${escapeHtml(String(e.message || e))}</div></div>`;
        }
    }
}

function renderMonthGrid(container) {
    if (!container) return;
    const dim = daysInMonth(currentYear, currentMonth);
    const myColorClass = getPlayerColorClassByLabel(currentNickname);

    const header = `
      <div class="grid-row grid-header">
        <div class="grid-cell day-cell">日期</div>
        ${SEGMENTS.map(s => `<div class="grid-cell">${s.label}</div>`).join('')}
      </div>
    `;

    let rowsHtml = '';
    for (let day = 1; day <= dim; day++) {
        const dateStr = formatDate(currentYear, currentMonth, day);
        rowsHtml += `<div class="grid-row" data-date="${dateStr}">
          <div class="grid-cell day-cell">${String(day).padStart(2, '0')}</div>
          ${SEGMENTS.map(seg => renderSlotCell(dateStr, seg.key, myColorClass)).join('')}
        </div>`;
    }

    container.innerHTML = header + rowsHtml;

    // 绑定指针事件（拖拽涂色）
    container.querySelectorAll('.slot-cell').forEach(cell => {
        cell.addEventListener('pointerdown', onCellPointerDown);
        cell.addEventListener('pointerenter', onCellPointerEnter);
        cell.addEventListener('pointerup', onCellPointerUp);
        cell.addEventListener('pointercancel', onCellPointerUp);
    });

    // 全局抬起，结束拖拽（避免指针跑出容器）
    window.addEventListener('pointerup', stopPainting, { once: true });
}

function renderSlotCell(dateStr, segmentKey, myColorClass) {
    const myAvail = (monthAvailability[currentNickname]?.[dateStr]?.[segmentKey] === 1);
    const isCommon = monthCommon.has(`${dateStr}|${segmentKey}`);

    // 其他人可用点
    const dots = [];
    for (const p of PLAYER_CONFIG) {
        const avail = (monthAvailability[p.label]?.[dateStr]?.[segmentKey] === 1);
        if (!avail) continue;
        dots.push(`<span class="dot ${p.colorClass}" title="${p.label}"></span>`);
    }

    const cls = [
        'grid-cell',
        'slot-cell',
        myAvail ? 'mine' : '',
        myAvail ? myColorClass : '',
        isCommon ? 'common' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${cls}"
           data-date="${dateStr}"
           data-segment="${segmentKey}">
        <div class="dots">${dots.join('')}</div>
      </div>
    `;
}

function onCellPointerDown(e) {
    if (!currentNickname) return;
    const cell = e.currentTarget;
    if (!(cell instanceof HTMLElement)) return;
    e.preventDefault();
    cell.setPointerCapture?.(e.pointerId);

    const dateStr = cell.getAttribute('data-date');
    const segmentKey = cell.getAttribute('data-segment');
    if (!dateStr || !segmentKey) return;

    const current = (monthAvailability[currentNickname]?.[dateStr]?.[segmentKey] === 1);
    paintValue = current ? 0 : 1;
    isPainting = true;

    applyCellChange(dateStr, segmentKey, paintValue);
}

function onCellPointerEnter(e) {
    if (!isPainting || !currentNickname) return;
    const cell = e.currentTarget;
    if (!(cell instanceof HTMLElement)) return;
    const dateStr = cell.getAttribute('data-date');
    const segmentKey = cell.getAttribute('data-segment');
    if (!dateStr || !segmentKey) return;
    applyCellChange(dateStr, segmentKey, paintValue);
}

function onCellPointerUp() {
    stopPainting();
}

function stopPainting() {
    isPainting = false;
}

function applyCellChange(dateStr, segmentKey, available) {
    // 更新本地缓存
    if (!monthAvailability[currentNickname]) monthAvailability[currentNickname] = {};
    if (!monthAvailability[currentNickname][dateStr]) monthAvailability[currentNickname][dateStr] = {};
    monthAvailability[currentNickname][dateStr][segmentKey] = available;

    // 写入 pendingChanges（批量保存）
    pendingChanges.set(`${dateStr}|${segmentKey}`, available);
    scheduleFlush();

    // 立即更新 UI（只更新这个 cell 的 class，不整表重绘）
    const myColorClass = getPlayerColorClassByLabel(currentNickname);
    const cell = document.querySelector(`.slot-cell[data-date="${cssEscape(dateStr)}"][data-segment="${cssEscape(segmentKey)}"]`);
    if (cell) {
        cell.classList.toggle('mine', available === 1);
        // 清掉所有 player-* 再加当前
        PLAYER_CONFIG.forEach(p => cell.classList.remove(p.colorClass));
        if (available === 1) cell.classList.add(myColorClass);
    }
}

function scheduleFlush() {
    if (flushTimer) {
        clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(() => {
        flushPendingChanges();
    }, 400);
}

async function flushPendingChanges() {
    flushTimer = null;
    if (!currentNickname) return;
    if (pendingChanges.size === 0) return;

    const changes = [];
    for (const [key, available] of pendingChanges.entries()) {
        const [dateStr, segmentKey] = key.split('|');
        changes.push({ date: dateStr, segment: segmentKey, available });
    }
    pendingChanges.clear();

    try {
        const resp = await fetch(`${API_BASE_URL}/availability/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_code: DEFAULT_ROOM_CODE,
                nickname: currentNickname,
                changes,
            }),
        });
        const data = await resp.json();
        if (!data.success) {
            throw new Error(data.error || '保存失败');
        }

        // 保存成功后，刷新本月数据（更新共同空闲与他人点）
        const monthTitle = document.getElementById('monthTitle');
        const monthGrid = document.getElementById('monthGrid');
        await fetchAndRenderMonth(monthGrid, monthTitle);
    } catch (e) {
        console.error(e);
        alert(`保存失败：${e.message || e}`);
    }
}

function renderCommonList() {
    const commonEl = document.getElementById('commonTimesList');
    if (!commonEl) return;
    if (!monthCommon || monthCommon.size === 0) {
        commonEl.innerHTML = '<p>本月暂无共同空闲格子</p>';
        return;
    }

    // 生成可读列表：按日期分组
    const byDate = new Map(); // date -> segments[]
    for (const key of monthCommon.values()) {
        const [d, seg] = key.split('|');
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d).push(seg);
    }

    const segLabel = (k) => (SEGMENTS.find(s => s.key === k)?.label || k);
    const segTime = (k) => {
        const s = SEGMENTS.find(x => x.key === k);
        if (!s) return '';
        return `${s.start}~${s.end}`;
    };

    const dates = Array.from(byDate.keys()).sort();
    const html = dates.map(d => {
        const segs = byDate.get(d);
        segs.sort((a, b) => SEGMENTS.findIndex(s => s.key === a) - SEGMENTS.findIndex(s => s.key === b));
        return `
          <div class="common-time-item">
            <strong>${d}</strong>
            <div style="margin-top:6px;">
              ${segs.map(s => `<span style="display:inline-block;margin-right:10px;">${segLabel(s)}（${segTime(s)}）</span>`).join('')}
            </div>
          </div>
        `;
    }).join('');

    commonEl.innerHTML = html;
}

// --- utils ---
function escapeHtml(str) {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function cssEscape(str) {
    // 极简 escape：够用（date/segment 都是安全字符）
    return str.replaceAll('"', '\\"');
}
