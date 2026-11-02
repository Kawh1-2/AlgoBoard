# AlgoBoard

基于 [tldraw](https://tldraw.dev) 改造的**算法刷题画板**。纯前端、单机运行，数据只存在你自己的浏览器里。

刷题时手推链表、数组、指针关系，用通用白板工具总是差点意思：节点要一个个画、指针要一根根连、改个下标还得重新摆位置。这个项目就是为了把这些重复劳动省掉。

## 功能

**已实现**

- **一题一板** —— 顶部标签条，每道题一张独立画布，双击改名、悬停点 × 关闭
- **数组格子** —— 整行一体的数组形状，下标可开可关，双击编辑单元格，`Tab` 跳格
- **三种创建方式** —— 工具点画布放置、粘贴 `[10,2,5,?,3]` 自动解析、默认 5 格空数组
- **插删格子** —— 右键菜单前插 / 后插 / 删除，格数与总宽度同步重算
- **单格独立着色** —— 右键格子分别设置该格文字颜色和整个数组的边框颜色
- **原生样式面板** —— 选中数组后右侧可调颜色、字号、字体、对齐
- **箭头吸附格子** —— 箭头端点吸附到具体格子的边中点，而不是整个数组
- **方向键控制箭头** —— 选中箭头后 `←` / `→` 换格，`Shift + ←/→` 跳两端，`↑` / `↓` 翻到另一侧
- **界面裁剪** —— 去掉便笺、媒体、评论、激光笔；图片上传的三条路径（按钮 / 粘贴 / 拖拽）全部禁用
- **本地持久化** —— 自动存浏览器 IndexedDB，刷新不丢

**计划中**

- 弹窗按长度 / 内容创建数组
- 画板导出 `.tldr` 备份

## 技术栈

| 项 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript + Vite 8 |
| 画布 | tldraw **5.6.0**（版本锁定，不用 `^`） |
| 存储 | tldraw `persistenceKey` → IndexedDB |

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:1001

日常使用（构建 + 起本地静态服务 + 自动开浏览器）：

```
start.bat
```

> 首次运行 `start.bat` 会自动执行一次 `npm run build`。

## 为什么端口固定 1001

浏览器本地存储（IndexedDB）是按 **origin（协议 + 主机 + 端口）** 隔离的。换端口等于换了个新仓库，旧画板会读不到。

所以 `vite.config.ts` 里设了 `strictPort: true` —— 端口被占用时直接报错退出，而不是静默漂移到 1002 造成"数据消失"的错觉。

> 也别改成 1024 以下的端口：其中一部分在 Chromium 的受限端口黑名单里（例如 1 号端口会直接报 `ERR_UNSAFE_PORT`，页面打不开）。

## 数据安全

- 数据只存在**当前浏览器**里，不跟随项目文件夹
- 清浏览器缓存、换浏览器、换电脑都会丢
- 无痕/隐私窗口关闭即清空
- 建议定期从左上角菜单导出，或备份 `.tldr` 文件

## 对 tldraw 的改动

这个项目不只是给 tldraw 套个壳，而是在它的扩展点上做了一批针对性改造。

### 自定义 shape

`algo-array` —— 整行一体的数组格子，props 包含 `cells` / `cellColors` / `showIndex` / `indexStart` / `color` / `size` / `font` / `align` / `strokeColor`。

- 继承 `BaseBoxShapeUtil`，实现 `component` 与 `getIndicatorPath`（v5 已废弃 `indicator()`，改为返回 `Path2D`）
- 通过声明合并注册进 `TLGlobalShapePropsMap`。v5 的 `TLBaseBoxShape` 是从内置 shape 联合里按 props 筛出来的，不注册就过不了泛型约束

### 自定义工具

`algo-array` 工具用 `StateNode` 实现：点画布放置数组，激活期间在 window 捕获阶段挂粘贴监听，拦截数组文本并解析成格子。

### UI 覆盖

| 组件 | 改动 |
|---|---|
| `Toolbar` | 不用 `DefaultToolbarContent`（它平铺 20 种几何图形），改按 `config/toolbar.ts` 渲染 |
| `ContextMenu` | 在数组格子上禁用官方菜单，让位给自绘的取色菜单；其他位置保持原样 |
| `SharePanel` / `PageMenu` | 置空（协作入口和页面菜单由自己的标签条替代） |
| 语言列表 | 收窄 `LANGUAGES` 到简体中文 + 英文 |
| 工具列表 | 移除 `asset` / `note` / `comment` / `laser` / `highlight` |

### 外部内容拦截

把 `files` / `svg-text` / `embed` 三类外部内容处理器注册为 `null`。只删工具栏按钮不够——粘贴图片、拖文件进画布是另外两条独立路径。

### 箭头绑定改造

没有新增 binding 类型，而是复用原生 `arrow` binding 的 `normalizedAnchor`（目标包围盒内的 0~1 相对坐标）：

- **格子级吸附** —— 把 `normalizedAnchor` 修正到目标格子的边中点，箭头就精确指向该格。因为绑的还是数组 shape 本身，数组移动/缩放时端点由 tldraw 自动重算
- **绑定即垂直** —— 自由端 x 对齐格子中点。但只在「刚绑定 / 换格 / 格数变化」时校准一次（靠 `index:count` 签名判断），之后不干预手动调整
- **平移跟随** —— 数组移动时 `nudgeShapes` 整条箭头，绑定端被 binding 拉回、自由端跟着位移，视觉上是整体平移而不是被拧角度
- **方向键控制** —— 改 `normalizedAnchor` 切换格子，或翻转上下侧

> 键盘监听必须挂在 `window` 的 capture 阶段：tldraw 的 `SelectTool` 在冒泡阶段处理方向键（微移选中形状），document 级监听抢不过它。

### 样式系统接入

shape 声明 `DefaultColorStyle` / `DefaultSizeStyle` / `DefaultFontStyle` / `DefaultHorizontalAlignStyle` 之后，右侧样式面板会自动出现对应控件 —— 它扫描 props 里的 `StyleProp`，不用自己写 UI。

色值、字号、字体都按 tldraw 的算法计算，保证和内置形状观感一致：

- 颜色 `getColorValue(theme.colors[colorMode], color, 'solid')`
- 字号 `theme.fontSize * LABEL_FONT_SIZES[size]`
- 字体 `var(--tl-font-draw)` 等 CSS 变量

> `getShapePropKeysByStyle` 规定同一个 `StyleProp` 在一个 shape 里只能出现一次，重复会直接抛错。所以边框颜色只能用普通字符串字段，走独立的右键菜单设置。

### 数据兼容

自定义 props 加了 v1 / v2 迁移序列，旧数据加载时补齐新增字段的默认值 —— 否则 props 校验会把整个 shape 判为非法，画板上的数组会直接消失。

## 目录结构

```
src/
├─ App.tsx                          壳层：标签条 + Tldraw + UI 裁剪
├─ config/toolbar.ts                工具栏配置（想加回几何图形改这里）
├─ i18n/restrictLanguages.ts        语言收窄为简体中文 + 英文
├─ tools/
│  └─ ArrayTool.tsx                 数组工具（点画布放置 + 粘贴解析）
├─ shapes/array/
│  ├─ ArrayShapeUtil.tsx            数组形状的定义、渲染与编辑
│  ├─ createArray.ts                创建逻辑
│  ├─ parseArrayText.ts             数组文本解析
│  ├─ arrowSnap.ts                  箭头吸附 / 垂直校准 / 平移跟随
│  ├─ arrowKeySwitch.ts             方向键控制箭头指向
│  └─ CellColorMenu.tsx             右键取色 + 插删格菜单
└─ ui/
   ├─ BoardBar.tsx                  顶部画板标签条
   ├─ AlgoToolbar.tsx               自定义工具栏
   └─ AlgoContextMenu.tsx           右键菜单策略（只在格子上让位给取色菜单）
```

## 许可

内置的 tldraw SDK 遵循其自身许可协议 —— 开发环境免费，生产环境需要 license key。
