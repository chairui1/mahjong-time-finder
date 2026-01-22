# Railway 部署指南

## 部署步骤

### 1. 准备工作

确保你已经：
- 创建了 Railway 账号
- 安装了 Railway CLI（可选，也可以使用网页界面）

### 2. 部署到 Railway

#### 方法一：使用 Railway 网页界面

1. 登录 [Railway](https://railway.app/)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"（如果代码在 GitHub）或 "Empty Project"
4. 如果选择 GitHub：
   - 连接你的 GitHub 账号
   - 选择这个仓库
5. 如果选择 Empty Project：
   - 点击 "Add Service" -> "GitHub Repo"
   - 选择你的仓库

#### 方法二：使用 Railway CLI

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

### 3. 配置环境变量（可选）

Railway 会自动处理大部分配置，但你可以设置：

- `FLASK_DEBUG`: 设置为 `false`（生产环境）
- `PORT`: Railway 会自动设置，无需手动配置

### 4. 部署后的访问

部署完成后，Railway 会提供一个公共 URL，例如：
- `https://your-project-name.railway.app`

直接访问这个 URL 即可使用应用。

## 项目结构说明

- `Procfile`: Railway 使用此文件来启动应用
- `runtime.txt`: 指定 Python 版本
- `railway.json`: Railway 配置文件（可选）
- `.gitignore`: 忽略不需要提交的文件（如数据库文件）

## 注意事项

1. **数据库持久化**: SQLite 数据库文件会保存在 Railway 的临时文件系统中。如果需要持久化，建议：
   - 使用 Railway 的 PostgreSQL 插件
   - 或使用外部数据库服务

2. **静态文件**: 前端文件通过 Flask 的静态文件服务提供，无需额外配置

3. **CORS**: 已配置允许跨域请求，适合前后端分离部署

4. **端口**: Railway 会自动通过 `PORT` 环境变量提供端口号，代码已自动处理

## 故障排查

如果部署后无法访问：

1. 检查 Railway 的部署日志
2. 确认 `Procfile` 中的命令正确
3. 检查 `requirements.txt` 中的依赖是否正确
4. 确认 Python 版本在 `runtime.txt` 中指定

## 更新部署

每次推送到 GitHub 后，Railway 会自动重新部署。你也可以：

```bash
railway up
```

手动触发部署。
