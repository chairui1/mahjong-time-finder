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

// 时间段与具体时间的映射
const SEGMENT_TIME_MAP = {
    morning:  { start: '08:00', end: '12:00' }, // 上午
    noon:     { start: '12:00', end: '14:00' }, // 中午
    afternoon:{ start: '14:00', end: '18:00' }, // 下午
    evening:  { start: '18:00', end: '23:00' }, // 晚上
};

let currentNickname = null;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    const identityButtons = document.querySelectorAll('.identity-button');
    const timeSection = document.getElementById('timeSection');
    const currentNicknameDisplay = document.getElementById('currentNicknameDisplay');

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

    // 时间段方块点击事件
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            slot.classList.toggle('selected');
        });
    });

    // 提交时间表单（放到 DOMContentLoaded 里，避免拿到 null）
    const timeForm = document.getElementById('timeForm');
    if (timeForm) {
        timeForm.addEventListener('submit', onSubmitTimeForm);
    } else {
        console.error('找不到 timeForm，无法绑定提交事件');
    }

    // 直接加载已提交的时间
    loadTimes();
    // 自动刷新（每5秒）
    setInterval(() => {
        loadTimes();
        loadCommonTimes();
    }, 5000);
});

function setCurrentPlayer(player, buttons, timeSection, displayEl) {
    currentNickname = player.label;
    // 更新按钮样式
    buttons.forEach(b => b.classList.remove('selected'));
    const activeBtn = Array.from(buttons).find(b => b.getAttribute('data-player-id') === player.id);
    if (activeBtn) activeBtn.classList.add('selected');
    // 显示身份
    displayEl.textContent = player.label;
    // 显示时间表单区域
    timeSection.style.display = 'block';
}

// 提交时间表单
async function onSubmitTimeForm(e) {
    e.preventDefault();
    
    if (!currentNickname) {
        alert('请先在上面选择你的身份（玩家 1~4）。');
        return;
    }

    const date = document.getElementById('date').value;
    const selectedSegments = Array.from(document.querySelectorAll('.time-slot.selected'))
        .map(el => el.getAttribute('data-segment'));
    
    if (!date) {
        alert('请选择日期');
        return;
    }

    if (selectedSegments.length === 0) {
        alert('请至少选择一个时间段（上午 / 中午 / 下午 / 晚上）');
        return;
    }
    
    try {
        // 依次提交每个时间段
        for (const segment of selectedSegments) {
            const mapping = SEGMENT_TIME_MAP[segment];
            if (!mapping) continue;

            const response = await fetch(`${API_BASE_URL}/submit-time`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_code: DEFAULT_ROOM_CODE,
                    nickname: currentNickname,
                    date: date,
                    start_time: mapping.start,
                    end_time: mapping.end
                })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || '提交失败');
            }
        }

        alert('时间提交成功！');
        // 清除选中状态，但保留日期和身份
        document.querySelectorAll('.time-slot.selected').forEach(el => el.classList.remove('selected'));
        loadTimes();
        loadCommonTimes();
    } catch (error) {
        console.error('提交时间失败:', error);
        alert('提交失败，请检查后端服务是否运行');
    }
}

// 加载已提交的时间
async function loadTimes() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-times/${DEFAULT_ROOM_CODE}`);
        const data = await response.json();
        
        if (data.success) {
            displayTimes(data.times);
            // 同时加载共同空闲时间
            loadCommonTimes();
        }
    } catch (error) {
        console.error('加载时间失败:', error);
        document.getElementById('timesList').innerHTML = '<p class="error">无法连接到服务器，请确保后端服务正在运行</p>';
    }
}

// 根据昵称获取颜色 class
function getPlayerColorClass(nickname) {
    const player = PLAYER_CONFIG.find(p => p.label === nickname);
    return player ? player.colorClass : '';
}

// 显示已提交的时间
function displayTimes(times) {
    const timesList = document.getElementById('timesList');
    
    if (!times || times.length === 0) {
        timesList.innerHTML = '<p>暂无提交的时间</p>';
        return;
    }
    
    timesList.innerHTML = times.map(time => {
        const colorClass = getPlayerColorClass(time.nickname);
        return `
        <div class="time-item ${colorClass}">
            <strong>${time.nickname}</strong> - ${time.date} ${time.start_time} ~ ${time.end_time}
        </div>
    `;
    }).join('');
}

// 刷新按钮
document.getElementById('refreshBtn').addEventListener('click', () => {
    loadTimes();
    loadCommonTimes();
});

// 加载共同空闲时间
async function loadCommonTimes() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-common-times/${DEFAULT_ROOM_CODE}`);
        const data = await response.json();
        
        if (data.success) {
            displayCommonTimes(data.common_times);
        }
    } catch (error) {
        console.error('计算共同空闲时间失败:', error);
    }
}

// 显示共同空闲时间
function displayCommonTimes(commonTimes) {
    const commonTimesList = document.getElementById('commonTimesList');
    
    if (!commonTimes || commonTimes.length === 0) {
        commonTimesList.innerHTML = '<p>暂无共同空闲时间</p>';
        return;
    }
    
    commonTimesList.innerHTML = commonTimes.map(time => `
        <div class="common-time-item">
            ${time.date} ${time.start_time} ~ ${time.end_time}
        </div>
    `).join('');
}
