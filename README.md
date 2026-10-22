# save-prompt · 提示词武器库

按「场景」分门别类管理提示词。**本地可写、线上只读**——只有你能改。核心概念：

- **场景**：组织单位（如「做游戏网站」），分两种类型
  - **流程型**：条目配套使用、有先后顺序（01 → 02 → 03），支持拖拽排序
  - **集合型**：一堆同类好提示词，无顺序概念
- 每条提示词带**简介**（可点「✨ AI 生成」自动写）、正文（支持 `{{变量}}` 占位符）、来源
- 所有数据存在 `public/prompts.json` 一个文件里：git 管版本、AI Agent 直接读、线上静态托管直接发布

## 启动

```bash
npm start          # 或 node server.js
```

浏览器打开 `http://localhost:5988`（端口在 config.json 里改）。

要求 Node ≥ 18，无任何 npm 依赖。

## 配置 AI（生成简介用）

复制模板并填入你的 key：

```bash
cp config.example.json config.json
```

```json
{
  "port": 5988,
  "llm": {
    "protocol": "anthropic",
    "base_url": "https://api.minimaxi.com/anthropic",
    "api_key": "你的 key",
    "model": "MiniMax-M3"
  }
}
```

- `protocol` 支持 `anthropic`（`{base_url}/v1/messages`）和 `openai`（`{base_url}/chat/completions`）两种协议，GLM / DeepSeek / OpenAI / 本地 Ollama 都能用
- ⚠️ **`config.json` 已被 .gitignore 排除，api_key 永远不会进 git 历史。仓库里只有脱敏的 `config.example.json`**

## 让 ZCode / AI Agent 使用这套库

数据是纯 JSON，在任何项目里对 Agent 说：

> 读 /Users/xingchen/GitHub/save-prompt/public/prompts.json，找到「做游戏网站」场景，按顺序把它的提示词调出来，从第 1 步开始陪我执行。

界面管理和 Agent 取用共用同一份库。

## 线上只读版

线上部署在 Vercel，是**纯静态托管**——只发布 `public/` 目录，`server.js` 根本不参与线上。
公网上不存在任何能写入的代码，所以「只有我能改」不是靠鉴权，而是靠没有那个接口。

两种模式由前端自己探测决定：

| 环境 | 探测 `/api/meta.json` | 结果 |
|---|---|---|
| 本地 | `server.js` 返回 `{"writable":true}` | 可写，显示全部编辑入口 |
| 线上 | 静态站无此端点 → 回退读 `meta.json`（`false`） | 只读，编辑入口不渲染 |

**探测失败一律按只读处理**，任何异常路径都倒向安全的那一侧。

### 改数据的方式

线上改不了，这是设计意图。流程是：

1. 本地 `npm start` → 在界面里改 → 自动保存
2. `git commit` + `push`
3. Vercel 自动重新部署，线上跟着更新（几十秒到几分钟）

### 部署

在 Vercel 导入本仓库即可，**不需要配置任何环境变量**。`vercel.json` 已声明 `outputDirectory: "public"`，
部署产物就是 `index.html` + `prompts.json` + `meta.json` 三个文件——没有 `server.js`，
也没有 `config.json`，因此线上不存在密钥。

## 数据安全

- 保存采用「写临时文件 + 原子替换」，断电不会写坏数据
- 每次增删改自动保存（页头显示「已保存 ✓」）
- 建议偶尔 `git add public/prompts.json && git commit` 留存版本
- **线上站无写入能力**：部署产物里没有任何能改数据的代码，陌生人无法覆盖你的库
- `config.json` 被 .gitignore 排除，且不在 `public/` 内，密钥既不进 git 也不上线
