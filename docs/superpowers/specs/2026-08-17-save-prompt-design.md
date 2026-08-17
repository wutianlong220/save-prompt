# save-prompt · 提示词武器库 — 设计文档

日期：2026-08-17
状态：已与用户确认定稿

## 一句话定位

一个本地 Web 应用，按「场景」分门别类管理提示词：场景内提示词有序排列、带简介，支持完整管理（新建/编辑/删除/拖拽排序），并可一键复制；配套 AI 自动生成简介；底层数据是纯 JSON 文件，可被 git 管理、可被 ZCode 等 AI Agent 直接读取。

## 核心概念

- **场景（scenario）**：组织单位，对应一类使用场景（如「做游戏网站」）
- **场景类型**：
  - `flow` 流程型：条目有先后顺序，显示 1/2/3/4 编号，右栏显示「第 N 步 / 共 M 步」
  - `set` 集合型：条目无顺序概念，按名称/加入时间排列
  - 新建时选择，随时可切换
- **提示词条目（item）**：标题 + 简介（AI 可生成）+ 正文（支持 `{{变量}}` 占位符）+ 来源（可选）

## 界面（已通过可交互 Demo 验证）

- 双栏布局：左栏场景树（手风琴展开，展开后显示条目列表）；右栏选中条目的完整详情
- 条目行结构：**序号钉死在最左**（刻度），拖拽把手 ⠿ 在序号右边，标题最后
- 拖拽排序：同场景内重排（流程型编号实时重算），支持跨场景拖拽
- 操作：复制（写剪贴板）、编辑、删除（confirm）；场景可编辑（改名/改类型）、可删除
- 添加/编辑提示词的模态框中，简介带「✨ AI 生成」按钮：调后端 LLM 生成草稿填入输入框，用户可修改后再保存（一票否决权）

## 目录结构

```
save-prompt/
├── server.js             # 零依赖 Node 后端（node:http + 全局 fetch）
├── public/index.html     # 原生 HTML/JS 前端
├── data/prompts.json     # 单文件数据库
├── config.json           # 端口 + LLM 配置（含 api_key）→ .gitignore
├── config.example.json   # 脱敏模板（进 git）
└── README.md
```

## 数据格式（data/prompts.json）

```json
{
  "version": 1,
  "scenarios": [
    {
      "id": "sc_…",
      "name": "🎮 做游戏网站",
      "type": "flow",
      "createdAt": "ISO 时间",
      "items": [
        { "id": "p_…", "title": "需求梳理", "desc": "…", "body": "提示词正文", "source": "https://…", "createdAt": "…", "updatedAt": "…" }
      ]
    }
  ]
}
```

- 数组顺序即显示顺序，拖拽 = 改数组顺序，无 order 字段
- `expanded` 等纯 UI 状态不入库（前端保存前剥离）
- 选 JSON 而非 Markdown：有完整编辑界面，无需手改文件；Agent 读 JSON 无障碍；程序写回可靠

## 后端 API（零依赖，Node ≥ 18）

| 接口 | 作用 |
|---|---|
| `GET /` | 托管 public/ 静态文件（防路径穿越） |
| `GET /api/data` | 读全量数据；文件不存在时初始化空库 |
| `PUT /api/data` | 全量保存；校验 scenarios 数组；写临时文件后原子 rename，防写坏 |
| `POST /api/ai/summarize` | `{ body }` → `{ desc }`：转发给 LLM 生成一句话简介 |

- 保存时机：前端每次变更后防抖自动 PUT，页头显示「已保存 ✓」
- AI 失败只提示，不阻塞手动编辑与保存

## LLM 配置（安全红线）

`config.json`（被 .gitignore 排除，绝不进 git 历史）：

```json
{
  "port": 4321,
  "llm": {
    "protocol": "anthropic",
    "base_url": "https://api.minimaxi.com/anthropic",
    "api_key": "<用户私发，仅落在本地文件>",
    "model": "MiniMax-M3"
  }
}
```

- `protocol` 支持两种：`anthropic`（POST {base_url}/v1/messages，x-api-key 头）与 `openai`（POST {base_url}/chat/completions，Bearer 头）
- 当前用户配置：MiniMax-M3，Anthropic 协议
- 仓库只提交 config.example.json 模板

## ZCode / Agent 联动

数据为纯 JSON，任何 Agent 可直接读：让 ZCode「读 /Users/xingchen/GitHub/save-prompt/data/prompts.json，用『做游戏网站』那套流程按步骤陪我执行」即可。界面管理与 Agent 取用共用同一份库。

## 明确不做（YAGNI）

- 多级子分类（场景 → 提示词两层，够用；某场景爆满再议）
- AI 生成标题、存入时建议场景（同一接口换指令即可，留待以后）
- Web 界面的搜索框、标签系统（库小，树形导航足够）
- 部署到公网（本地工具）
