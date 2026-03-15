# 后端重启指南

## 方法一：开发模式（推荐，自动热重载）

### Windows PowerShell 或 CMD

1. **打开终端**，进入后端目录：
   ```powershell
   cd C:\DATA\0-Programmmmm\NanTang\mycoseed-backend
   ```

2. **停止当前运行的后端**（如果正在运行）：
   - 在运行后端的终端窗口按 `Ctrl + C`
   - 或者关闭终端窗口

3. **启动后端（开发模式）**：
   ```powershell
   npm run dev
   ```
   或者使用 yarn：
   ```powershell
   yarn dev
   ```

4. **验证后端是否启动成功**：
   - 看到以下输出表示成功：
     ```
     🚀 Server is running on http://localhost:3001
     📝 API endpoints available at http://localhost:3001/api
     ```
   - 在浏览器访问 `http://localhost:3001/api/health`，应该返回 `{"status":"ok",...}`

### 说明
- **开发模式** (`npm run dev`) 使用 `tsx watch`，会自动监听文件变化并重启
- 修改代码后，后端会自动重新编译和重启
- 适合开发时使用

---

## 方法二：生产模式（需要手动编译）

### Windows PowerShell 或 CMD

1. **停止当前运行的后端**（如果正在运行）：
   - 在运行后端的终端窗口按 `Ctrl + C`

2. **编译 TypeScript 代码**：
   ```powershell
   npm run build
   ```
   或者：
   ```powershell
   yarn build
   ```

3. **启动后端（生产模式）**：
   ```powershell
   npm start
   ```
   或者：
   ```powershell
   yarn start
   ```

4. **验证后端是否启动成功**：
   - 看到以下输出表示成功：
     ```
     🚀 Server is running on http://localhost:3001
     📝 API endpoints available at http://localhost:3001/api
     ```

### 说明
- **生产模式**需要先编译，然后运行编译后的 JavaScript
- 修改代码后需要重新执行 `npm run build` 和 `npm start`
- 适合生产环境部署

---

## 快速重启（开发模式）

如果后端已经在运行，最简单的方法是：

1. **在运行后端的终端窗口按 `Ctrl + C`** 停止服务
2. **再次运行 `npm run dev`** 启动服务

或者，如果使用 `tsx watch`，修改代码后会自动重启，无需手动操作。

---

## 常见问题

### Q: 端口 3001 已被占用怎么办？

**A:** 可以修改端口：
1. 在 `mycoseed-backend/.env` 文件中设置：
   ```
   PORT=3002
   ```
2. 或者直接修改 `src/index.ts` 中的 `PORT` 变量

### Q: 如何查看后端日志？

**A:** 所有 `console.log` 和 `console.error` 的输出都会显示在运行后端的终端窗口中。

### Q: 如何确认后端代码已更新？

**A:** 
1. 查看终端输出，确认服务器已重启
2. 检查日志中是否有你添加的 `console.log` 输出
3. 测试 API 端点，看行为是否符合预期

---

## 检查清单

重启后端后，请确认：

- [ ] 终端显示 "Server is running on http://localhost:3001"
- [ ] 访问 `http://localhost:3001/api/health` 返回成功响应
- [ ] 前端可以正常调用后端 API
- [ ] 终端中可以看到你添加的调试日志（如 `[REJECT API]` 等）
