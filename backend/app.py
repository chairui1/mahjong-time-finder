from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import sqlite3
import os
import random
import string

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # 允许跨域请求

# 数据库文件路径
# 在云部署时，使用绝对路径确保数据库文件在正确位置
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mahjong_time.db')

DEFAULT_ROOM_CODE = "MAJIANG"
SEGMENTS = ["morning", "noon", "afternoon", "evening"]
PLAYER_LABELS = ["玩家 1", "玩家 2", "玩家 3", "玩家 4"]

def init_db():
    """初始化数据库"""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # 旧版：时间段表（保留，兼容老接口）
    c.execute('''
        CREATE TABLE IF NOT EXISTS time_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT NOT NULL,
            nickname TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 新版：按“日期 + 时间段（上午/中午/下午/晚上）”记录可用性
    # 约定：available=1 表示有空；available=0 表示没空（一般我们只会写 0/1）
    c.execute('''
        CREATE TABLE IF NOT EXISTS availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT NOT NULL,
            nickname TEXT NOT NULL,
            date TEXT NOT NULL,
            segment TEXT NOT NULL,
            available INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(room_code, nickname, date, segment)
        )
    ''')
    
    conn.commit()
    conn.close()

# 在应用启动时初始化数据库（确保在使用 gunicorn 时也能初始化）
init_db()

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def generate_room_code():
    """生成6位房间号"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/api/create-room', methods=['POST'])
def create_room():
    """创建房间（已废弃，不再需要房间，但保留 API 以兼容）"""
    try:
        data = request.json or {}
        room_code = data.get('room_code', 'MAJIANG')
        # 不再实际创建房间，直接返回成功
        return jsonify({'success': True, 'room_code': room_code}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/check-room/<room_code>', methods=['GET'])
def check_room(room_code):
    """检查房间是否存在（已废弃，不再需要房间，但保留 API 以兼容）"""
    try:
        # 不再检查房间，直接返回存在
        return jsonify({'success': True, 'exists': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/submit-time', methods=['POST'])
def submit_time():
    """提交时间"""
    try:
        data = request.json
        room_code = data.get('room_code', DEFAULT_ROOM_CODE)  # 默认使用 MAJIANG，但不再检查房间
        nickname = data.get('nickname')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # 验证数据
        if not all([nickname, date, start_time, end_time]):
            return jsonify({'success': False, 'error': '缺少必要参数'}), 400
        
        # 直接插入时间数据（不再检查房间）
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            INSERT INTO time_slots (room_code, nickname, date, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (room_code, nickname, date, start_time, end_time))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/availability/month', methods=['GET'])
def get_month_availability():
    """
    获取某年某月的可用性网格数据（所有玩家）。
    Query:
      - year: 2026
      - month: 1..12
      - room_code: optional, default MAJIANG
    """
    try:
        year = int(request.args.get('year'))
        month = int(request.args.get('month'))
        room_code = request.args.get('room_code', DEFAULT_ROOM_CODE)

        if month < 1 or month > 12:
            return jsonify({'success': False, 'error': 'month 必须在 1~12'}), 400

        start_date = datetime(year, month, 1).date()
        if month == 12:
            next_month = datetime(year + 1, 1, 1).date()
        else:
            next_month = datetime(year, month + 1, 1).date()

        conn = get_db_connection()
        c = conn.cursor()

        # 参与者：这个月在 availability 里出现过的玩家（至少有一条记录）
        c.execute(
            '''
            SELECT DISTINCT nickname
            FROM availability
            WHERE room_code = ?
              AND date >= ?
              AND date < ?
            ''',
            (room_code, start_date.isoformat(), next_month.isoformat())
        )
        active_players = [r["nickname"] for r in c.fetchall()]

        c.execute(
            '''
            SELECT nickname, date, segment, available
            FROM availability
            WHERE room_code = ?
              AND date >= ?
              AND date < ?
            ''',
            (room_code, start_date.isoformat(), next_month.isoformat())
        )
        rows = c.fetchall()
        conn.close()

        entries = []
        for r in rows:
            entries.append({
                "nickname": r["nickname"],
                "date": r["date"],
                "segment": r["segment"],
                "available": int(r["available"]),
            })

        # 共同空闲：同一 date+segment 下，当月“参与者”都 available=1
        # 参与者=本月提交/修改过格子的玩家（解决“只有两人选了但共同空闲不显示”的问题）
        common = []
        # build map (date, segment) -> set of nicknames available
        avail_map = {}
        for e in entries:
            if e["available"] != 1:
                continue
            key = (e["date"], e["segment"])
            s = avail_map.get(key)
            if s is None:
                s = set()
                avail_map[key] = s
            s.add(e["nickname"])

        # 如果本月还没有任何参与者，就不返回共同空闲
        if active_players:
            for (d, seg), s in avail_map.items():
                if all(p in s for p in active_players):
                    common.append({"date": d, "segment": seg})

        return jsonify({'success': True, 'entries': entries, 'common': common}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/availability/batch', methods=['POST'])
def set_availability_batch():
    """
    批量设置某玩家在多个格子的可用性。
    Body:
      {
        "room_code": "MAJIANG",
        "nickname": "玩家 1",
        "changes": [
          {"date": "2026-01-24", "segment": "evening", "available": 1},
          {"date": "2026-01-25", "segment": "morning", "available": 0}
        ]
      }
    """
    try:
        data = request.json or {}
        room_code = data.get("room_code", DEFAULT_ROOM_CODE)
        nickname = data.get("nickname")
        changes = data.get("changes", [])

        if not nickname:
            return jsonify({'success': False, 'error': 'nickname 必填'}), 400
        if nickname not in PLAYER_LABELS:
            return jsonify({'success': False, 'error': 'nickname 必须是 玩家 1~4'}), 400
        if not isinstance(changes, list) or len(changes) == 0:
            return jsonify({'success': False, 'error': 'changes 必须是非空数组'}), 400

        conn = get_db_connection()
        c = conn.cursor()

        for ch in changes:
            d = ch.get("date")
            seg = ch.get("segment")
            avail = int(ch.get("available", 0))

            if not d or not seg:
                continue
            if seg not in SEGMENTS:
                continue
            if avail not in (0, 1):
                avail = 0

            c.execute(
                '''
                INSERT INTO availability (room_code, nickname, date, segment, available, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(room_code, nickname, date, segment)
                DO UPDATE SET available=excluded.available, updated_at=CURRENT_TIMESTAMP
                ''',
                (room_code, nickname, d, seg, avail)
            )

        conn.commit()
        conn.close()

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get-times/<room_code>', methods=['GET'])
def get_times(room_code):
    """获取房间内所有时间数据"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            SELECT nickname, date, start_time, end_time
            FROM time_slots
            WHERE room_code = ?
            ORDER BY date, start_time
        ''', (room_code,))
        
        rows = c.fetchall()
        conn.close()
        
        times = []
        for row in rows:
            times.append({
                'nickname': row['nickname'],
                'date': row['date'],
                'start_time': row['start_time'],
                'end_time': row['end_time']
            })
        
        return jsonify({'success': True, 'times': times}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get-common-times/<room_code>', methods=['GET'])
def get_common_times(room_code):
    """计算共同空闲时间"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            SELECT nickname, date, start_time, end_time
            FROM time_slots
            WHERE room_code = ?
            ORDER BY date, start_time
        ''', (room_code,))
        
        rows = c.fetchall()
        conn.close()
        
        if not rows:
            return jsonify({'success': True, 'common_times': []}), 200
        
        # 按日期分组
        date_groups = {}
        for row in rows:
            date = row['date']
            if date not in date_groups:
                date_groups[date] = []
            date_groups[date].append({
                'nickname': row['nickname'],
                'start_time': row['start_time'],
                'end_time': row['end_time']
            })
        
        # 计算每个日期的共同空闲时间
        common_times = []
        for date, slots in date_groups.items():
            # 获取所有用户
            users = list(set([s['nickname'] for s in slots]))
            
            # 为每个用户构建时间区间列表
            user_intervals = {}
            for user in users:
                user_intervals[user] = []
                for slot in slots:
                    if slot['nickname'] == user:
                        user_intervals[user].append({
                            'start': slot['start_time'],
                            'end': slot['end_time']
                        })
            
            # 计算所有用户的交集
            if len(users) > 0:
                # 从第一个用户的时间开始
                common = user_intervals[users[0]].copy()
                
                # 与每个其他用户求交集
                for user in users[1:]:
                    new_common = []
                    for c_interval in common:
                        for u_interval in user_intervals[user]:
                            # 计算交集
                            start = max(c_interval['start'], u_interval['start'])
                            end = min(c_interval['end'], u_interval['end'])
                            if start < end:
                                new_common.append({'start': start, 'end': end})
                    common = new_common
                
                # 合并重叠的时间段
                if common:
                    common.sort(key=lambda x: x['start'])
                    merged = [common[0]]
                    for current in common[1:]:
                        last = merged[-1]
                        if current['start'] <= last['end']:
                            merged[-1] = {'start': last['start'], 'end': max(last['end'], current['end'])}
                        else:
                            merged.append(current)
                    
                    for interval in merged:
                        common_times.append({
                            'date': date,
                            'start_time': interval['start'],
                            'end_time': interval['end']
                        })
        
        return jsonify({'success': True, 'common_times': common_times}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/')
def index():
    """提供前端页面"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """提供前端静态文件（CSS、JS等）"""
    return send_from_directory('../frontend', path)

# 数据库已在模块加载时初始化（第38行），无需再次初始化

if __name__ == '__main__':
    # 数据库已在应用启动时初始化，这里不需要再次初始化
    
    print("=" * 50)
    print("麻将时间协调系统 - 后端服务")
    print("=" * 50)
    print("前端页面: http://localhost:5000")
    print("服务地址: http://localhost:5000")
    print("API 文档:")
    print("  POST /api/submit-time - 提交时间")
    print("  GET  /api/get-times/<room_code> - 获取时间列表")
    print("  GET  /api/get-common-times/<room_code> - 获取共同空闲时间")
    print("  GET  /api/availability/month?year=YYYY&month=M - 获取整月网格数据")
    print("  POST /api/availability/batch - 批量保存网格")
    print("=" * 50)
    print("默认房间号: MAJIANG（仅用于数据分组，无需创建房间）")
    print("=" * 50)
    print("请在浏览器中访问: http://localhost:5000")
    print("=" * 50)
    
    # 运行应用
    # 从环境变量获取端口，如果没有则使用 5000（本地开发）
    port = int(os.environ.get('PORT', 5000))
    # 生产环境不使用 debug 模式
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=port)
