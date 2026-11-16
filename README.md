# 故事时间线

本机运行的故事、人物身体数据、时间线与时间流管理工具。Vue 3、TypeScript 和 Vite 提供界面，Node 服务将档案保存到本机设置指定的目录。

源码按职责拆分在 `src/features/`（故事、事件、时间线、时间流、人物、图鉴）和 `src/shared/`（类型、API、解析、通用 UI）中。应用入口是 `src/main.ts`，旧版单 HTML 只作为本机遗留文件保留，不参与构建。

Markdown 导入格式见 [`docs/story-format.md`](docs/story-format.md) 与 [`docs/branch-format.md`](docs/branch-format.md)。

## 开发

```powershell
npm install
npm run dev
```

打开 Vite 显示的本机地址。API 服务只监听 `127.0.0.1`。

Windows 桌面快捷方式会启动生产服务并自动打开 `http://127.0.0.1:4174`。快捷方式调用 `scripts/start-timeline.ps1`；也可以直接运行 `npm start`。

在应用的“本机设置”中可以修改默认档案目录。服务会把现有档案复制到新目录，之后按 `故事名_存档时间.json` 保存；在应用中按 `Ctrl+S` 可立即保存当前故事。

## 构建与运行

```powershell
npm run build
npm start
```

生产服务会在 `http://127.0.0.1:4174` 提供前端和本机档案 API。可通过 `PORT` 更改监听端口，通过 `TIMELINE_DATA_DIR` 指定本机档案目录。

## 本机数据

运行 `npm run migrate:data` 可将旧版 `data/*.json` 故事和物品图鉴迁入 `data/stories/` 与 `data/compendium.json`。迁移会跳过已有同 ID 档案且不会删除旧文件。`data/` 不会被提交到 Git。

迁移脚本也可以直接指定来源与目标目录，便于验证或备份：

```powershell
npm run migrate:data
```

可从界面导入旧版故事 JSON 或 Markdown。命令行 Markdown 导入示例：

```powershell
npm run import:md -- .\事件记录.md --story <故事ID>
```

未传 `--story` 时，CLI 会选择 `savedAt` 最新的本机档案；传入不存在的 ID 会直接报错，不会新建或覆盖故事。

## 检查

```powershell
npm test
npm run build
npm run test:e2e
```
