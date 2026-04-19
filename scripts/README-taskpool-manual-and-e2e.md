## TaskPool（普通任务=单子任务池）本地手测 & 半自动 E2E

### 你明天手测要点

- 目标：按 `mycoseed-frontend/docs/TASKPOOL_MANUAL_TEST_CHECKLIST_V1.md` 从 Step1 跑到 Step7
- Semi 交易需要你手动点确认；其余状态回写/验链/落库尽量自动完成

---

## 一键启动三个服务（推荐）

在 workspace 根目录执行：

```bash
./bai/scripts/taskpool-dev-up.sh
```

它会启动：
- Semi App：`http://127.0.0.1:3000`
- MycoSeed Backend：`http://127.0.0.1:3001`
- MycoSeed Frontend：`http://127.0.0.1:3003`

用端口确认：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:3003 -sTCP:LISTEN
```

---

## 半自动 E2E（用系统 Chrome，不下载 Playwright 浏览器）

### 前置

- `AUTH_TOKEN_PUBLISHER`、`AUTH_TOKEN_CANDIDATE` 写在 `bai/mycoseed-backend/.env`
- Semi App 必须能访问（3000）

### 运行

```bash
./bai/scripts/taskpool-e2e-semi-assisted.sh
```

运行过程中会打开系统 Chrome，并在每个 Semi 页面停住等待你点确认。

---

## Semi App 依赖安装常见坑（记录）

若 `semi-new/semi-app` 安装依赖遇到 npm cache 权限（`EACCES ~/.npm`），可用项目本地 cache 避免：

```bash
cd semi-new/semi-app
npm install --legacy-peer-deps --no-audit --no-fund --cache ./.npm-cache
```

