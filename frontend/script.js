// 自动检测 API 地址：部署时使用当前域名，本地开发时使用 localhost
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `${window.location.origin}/api`;

// 使用固定的房间号
const DEFAULT_ROOM_CODE = 'MAJIANG';

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 直接加载已提交的时间（不再需要初始化房间）
    loadTimes();
    // 自动刷新（每5秒）
    setInterval(() => {
        loadTimes();
        loadCommonTimes();
    }, 5000);
});

// 提交时间表单
document.getElementById('timeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nickname = document.getElementById('nickname').value.trim();
    const date = document.getElementById('date').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!nickname || !date || !startTime || !endTime) {
        alert('请填写完整信息');
        return;
    }
    
    if (startTime >= endTime) {
        alert('结束时间必须晚于开始时间');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/submit-time`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room_code: DEFAULT_ROOM_CODE,
                nickname: nickname,
                date: date,
                start_time: startTime,
                end_time: endTime
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('时间提交成功！');
            document.getElementById('timeForm').reset();
            loadTimes();
            loadCommonTimes();
        } else {
            alert('提交失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('提交时间失败:', error);
        alert('提交失败，请检查后端服务是否运行');
    }
});

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

// 显示已提交的时间
function displayTimes(times) {
    const timesList = document.getElementById('timesList');
    
    if (times.length === 0) {
        timesList.innerHTML = '<p>暂无提交的时间</p>';
        return;
    }
    
    timesList.innerHTML = times.map(time => `
        <div class="time-item">
            <strong>${time.nickname}</strong> - ${time.date} ${time.start_time} ~ ${time.end_time}
        </div>
    `).join('');
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
    
    if (commonTimes.length === 0) {
        commonTimesList.innerHTML = '<p>暂无共同空闲时间</p>';
        return;
    }
    
    commonTimesList.innerHTML = commonTimes.map(time => `
        <div class="common-time-item">
            ${time.date} ${time.start_time} ~ ${time.end_time}
        </div>
    `).join('');
}
