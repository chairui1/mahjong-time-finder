# 麻将时间协调系统

一个简单的多人时间协调网页，用于和朋友约时间打麻将。

## 技术栈

- 后端：Python Flask
- 数据库：SQLite
- 前端：HTML + CSS + 原生 JavaScript
- 前后端分离架构

## 功能

1. 直接提交个人空闲时间（昵称、日期、开始时间、结束时间）
2. 实时查看所有已提交的时间（自动刷新）
3. 自动计算并显示所有人的共同空闲时间
4. 使用固定的默认房间，无需创建或加入房间

## 项目结构

```
.
├── backend/
│   ├── app.py              # Flask 后端应用
│   ├── requirements.txt    # Python 依赖
│   └── mahjong_time.db    # SQLite 数据库（运行后自动生成）
├── frontend/
│   ├── index.html         # 前端页面
│   ├── style.css          # 样式文件
│   └── script.js          # 前端逻辑
└── README.md              # 项目说明
```

## 安装和运行

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
cd backend
python app.py
```

后端服务将在 `http://localhost:5000` 启动。

### 3. 打开前端页面

直接在浏览器中打开 `frontend/index.html` 文件，或者使用本地服务器：

```bash
# 使用 Python 启动简单 HTTP 服务器
cd frontend
python -m http.server 8000
```

然后在浏览器中访问 `http://localhost:8000`

## API 接口

### 创建房间
- **POST** `/api/create-room`
- 返回：`{success: true, room_code: "ABC123"}`

### 检查房间是否存在
- **GET** `/api/check-room/<room_code>`
- 返回：`{success: true, exists: true/false}`

### 提交时间
- **POST** `/api/submit-time`
- 请求体：
```json
{
  "room_code": "ABC123",
  "nickname": "张三",
  "date": "2024-01-15",
  "start_time": "14:00",
  "end_time": "18:00"
}
```

### 获取房间内所有时间
- **GET** `/api/get-times/<room_code>`
- 返回：`{success: true, times: [...]}`

### 获取共同空闲时间
- **GET** `/api/get-common-times/<room_code>`
- 返回：`{success: true, common_times: [...]}`

## 使用说明

1. **启动后端**：运行 `backend/app.py`，服务会在 `http://localhost:5000` 启动
2. **打开前端**：在浏览器中打开 `frontend/index.html` 或通过 HTTP 服务器访问
3. **提交时间**：直接填写昵称、日期和时间段，点击"提交时间"
4. **查看时间**：页面会自动显示所有已提交的时间（每5秒自动刷新）
5. **共同时间**：页面会自动计算并显示所有人的共同空闲时间

## 注意事项

- 确保后端服务运行在 `http://localhost:5000`
- 如果修改了后端端口，需要同步修改 `frontend/script.js` 中的 `API_BASE_URL`
- 数据库文件会在首次运行时自动创建
