# save-prompt · 提示词武器库

按「场景」分门别类管理提示词的本地 Web 应用。核心概念：

- **场景**：组织单位（如「做游戏网站」），分两种类型
  - **流程型**：条目配套使用、有先后顺序（01 → 02 → 03），支持拖拽排序
  - **集合型**：一堆同类好提示词，无顺序概念
- 每条提示词带**简介**（可点「✨ AI 生成」自动写）、正文（支持 `{{变量}}` 占位符）、来源
- 所有数据存在 `data/prompts.json` 一个文件里：git 管版本、AI Agent 直接读

## 启动

```bash
npm start          # 或 node server.js
```

浏览器打开 `http://localhost:4321`（端口在 config.json 里改）。

要求 Node ≥ 18，无任何 npm 依赖。

## 配置 AI（生成简介用）

复制模板并填入你的 key：

```bash
cp config.example.json config.json
```

```json
{
  "port": 4321,
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

> 读 /Users/xingchen/GitHub/save-prompt/data/prompts.json，找到「做游戏网站」场景，按顺序把它的提示词调出来，从第 1 步开始陪我执行。

界面管理和 Agent 取用共用同一份库。

## 数据安全

- 保存采用「写临时文件 + 原子替换」，断电不会写坏数据
- 每次增删改自动保存（页头显示「已保存 ✓」）
- 建议偶尔 `git add data/prompts.json && git commit` 留存版本
