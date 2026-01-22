FROM python:3.11-slim

WORKDIR /app

# 复制 requirements.txt 并安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 设置工作目录到 backend
WORKDIR /app/backend

# 暴露端口
EXPOSE $PORT

# 启动应用
CMD gunicorn app:app --bind 0.0.0.0:$PORT
