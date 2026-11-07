# 维护这套交付资料

这些脚本用于维护版本化资料，不访问业务数据库或客户接口。

1. **更新内容与源码快照**：在原工程 `firstcustomer/` 目录执行：

   ```bash
   npx tsx --tsconfig tsconfig.json ../docs/design-handoff/office-2026-11-08/tools/export-content.mts
   ```

   它从当前检出提交导出双语文案、令牌、合成状态和 18 份源码。刷新后必须同步修改交付基准说明，并重新采集对应版本的截图，不能只换提交号。

2. **生成 HTML 与 PDF**：需要 Python、`reportlab`、`Pillow`。在交付目录执行：

   ```bash
   python3 tools/build_review.py
   ```

   生成 `index.html` 和评审 PDF。在原仓库运行时，PDF 先写入 `firstcustomer/output/pdf/`；解压包单独使用时写入包内 `output/pdf/`，并同步到交付目录。优先嵌入本机 STHeiti 字体，其他系统回退 STSong CID 字体；更新后应重新渲染检查中文字符与分页。

3. **重新打包**：

   ```bash
   python3 tools/package_handoff.py
   ```

   生成校验清单，并将 ZIP 与 SHA-256 文件写到交付目录的上一级。排除环境变量、隐藏目录、运行产物和缓存。

4. **验证**：PDF 六页逐页检查；离线 HTML 的中英文/六幕选择可用；截图无私人信息；所有本地链接、文案和源码校验值一致。验证记录见 `ACCEPTANCE.md`。
