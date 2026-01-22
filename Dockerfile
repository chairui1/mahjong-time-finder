FROM python:3.11-slim

WORKDIR /app

# 复制 requirements.txt 并安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE $PORT

# 启动应用（从根目录运行，使用模块路径）
CMD gunicorn backend.app:app --bind 0.0.0.0:$PORT
