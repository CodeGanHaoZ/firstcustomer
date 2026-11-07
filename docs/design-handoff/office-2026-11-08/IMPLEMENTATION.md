# 前端对接与素材

完整可运行工程在 [原仓库](https://github.com/kongleiwork-art/firstcustomer)，Next.js 应用目录为 `firstcustomer/`。本包 `source/` 仅含 18 份源码摘录，不是可以单独 `npm install` 的应用。对应版本和文件校验值见 [source-manifest.json](source-manifest.json)。

## 模块入口

下列路径均相对仓库根目录，点击文件可查看交接基准的源代码。

| 模块 | 源码 | 对接点 |
| --- | --- | --- |
| 首页场景控制 | [office-showcase.tsx](source/src/components/office-showcase.tsx) | locale；片段、阶段、暂停、可见性、镜头 |
| 角色动作/文件 | [office-showcase-canvas.ts](source/src/components/office-showcase-canvas.ts) | scenePoses / drawOfficeActors；不修改业务 |
| 双角色交接 | [office-relay.tsx](source/src/components/office-relay.tsx) | scene、scenes、sceneIndex、phase、locale、progress、onChoose |
| 统一角色插画 | [office-portrait.tsx](source/src/components/office-portrait.tsx) | person、locale；复用插画图集 |
| Free / Pro 路线 | [service-journey.tsx](source/src/components/service-journey.tsx) | steps、locale；文案由 HOME_COPY 传入 |
| 客户/经营台地图 | [office-map.tsx](source/src/components/office-map.tsx) | stations、cooWorking、customerView；服务端安全的共用坐标 |
| 真实交接舞台 | [office-stage.tsx](source/src/components/office-stage.tsx) | transfer、guidance、stations、focusRoom、guideHrefPrefix |
| 当前/下一步引导 | [office-work-guide.tsx](source/src/components/office-work-guide.tsx) | guide、locale、onFocus、hrefPrefix |
| 真实状态说明 | [office-guide.ts](source/src/domain/office-guide.ts) | officeGuidance / customerOfficeStations |
| 新视觉样式 | [office-relay.css](source/src/app/office-relay.css) | 交接面板、六幕、职责工具条、服务路线 |
| 原场景与角色卡 | [office-showcase.css](source/src/app/office-showcase.css) | 地图层、角色卡、姓名悬停下划线 |
| 经营台/客户地图样式 | [office.css](source/src/app/admin/office.css) | 真实任务牌、工作动作、暂停/减少动态 |

角色名、场景、对白、阶段说明和服务路线分别由 `brand.ts`、`office-showcase.ts`、`office-story.ts`、`home-copy.ts` 管理。`content.zh-en.json` 是上述来源的版本快照；后续开发应修改源配置后重新导出，不维护第三份独立文案。

## 组件边界

- `OfficeShowcase`、`OfficeStage` 和 `OfficeWorkGuide` 是客户端交互边界。
- `OfficeRelay` 在首页客户端树中使用，保持纯展示，不自行请求业务接口。
- `OfficePortrait`、`ServiceJourney` 可在服务端渲染。不要为了一个名字或图集 helper 把整个地图模块改为 `use client`。
- 不将数据库对象、凭证、客户敏感记录或完整项目对象传给演示组件。
- 首页场景不得调用 Agent、创建订单、推进审批或产生模型成本。

## 原素材

| 文件 | 规格/用途 | 原仓库路径 |
| --- | --- | --- |
| [floor-map.webp](assets/floor-map.webp) | 1681 x 936，无人物木质办公室背景 | `firstcustomer/public/office/floor-map.webp` |
| [map-staff.webp](assets/map-staff.webp) | 896 x 272，8 列 x 2 行，每格 112 x 136；上排桌前、下排行走 | `firstcustomer/public/office/map-staff.webp` |
| [staff.webp](assets/staff.webp) | 4 列 x 2 行，独立 IP 插画；完整尺寸见 manifest | `firstcustomer/public/office/staff.webp` |

地图动作图集列顺序：Lumi、Nori、Fino、Milo、Kito、Pogo、Toby、Yuki。

独立角色插画图集的核心角色坐标（从 0 开始）：

| 角色 | 列 | 行 |
| --- | --- | --- |
| Lumi | 0 | 0 |
| Nori | 1 | 0 |
| Fino | 2 | 0 |
| Milo | 1 | 1 |
| Kito | 3 | 0 |
| Pogo | 0 | 1 |

不要混用两个图集的索引。插画 CSS 使用 `background-size:400% 200%`；地图使用 `800% 200%`。Pogo 插画右缘使用 8% 裁切规避原图相邻单元的残边。工位坐标、标签位置、出口、电脑与 sprite 索引在 `tokens.json.spriteAtlas.desks` 和原始 `office-map.tsx` 中。

## 本机查看

离线交接页：解压 ZIP，直接打开 `index.html`。页面、截图、原素材和 JSON 都随包提供，不依赖 CDN 或接口。

运行原工程：

```bash
git clone https://github.com/kongleiwork-art/firstcustomer.git
cd firstcustomer
git checkout d2c09c9258e3ebb7fb5465745a9df371e63a6e61
cd firstcustomer
npm ci
```

环境和本机数据库依照原仓库 `firstcustomer/README.md` 配置，使用自己的 `.env.local`；交付包不提供真实密钥。首页演示本身不调用模型，但站点初始化和账户功能仍依赖工程环境。

## 改动记录

- `b437d46`：工作状态引导、动作与阶段跳转。
- `fe432a3`：去掉脚底/桌面光圈，工作条、双角色交接、动物连线导航与 Free / Pro 路线。
- `d3e1684`：同事追加的角色姓名悬停/当前角色下划线，已纳入本快照。
- `d2c09c9`：本包锁定的 main 基准，包含后续顶栏、姓名悬停与交接列宽改动；本包未截取账户私人内容。

交接区列宽已纳入 `d2c09c9` 的自适应三列与两侧留白均衡；使用源码快照中的 CSS，不按早期截图估算固定列宽。
