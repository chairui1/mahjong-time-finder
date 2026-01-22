FROM python:3.11-slim

WORKDIR /app

# 复制 requirements.txt 并安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口（Railway 会自动设置 PORT 环境变量，这里使用默认值）
EXPOSE 5000

# 启动应用（从根目录运行，使用模块路径）
# 使用 shell 形式确保环境变量被正确展开
CMD ["sh", "-c", "gunicorn backend.app:app --bind 0.0.0.0:${PORT:-5000}"]
