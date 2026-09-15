# 工作台测试指南

## 1. 打开示例

双击或直接在浏览器打开：

`examples/two-page-demo/dist/index.html`

桌面上的完整路径：

`/Users/xunguo/Desktop/versioned-prototype-workbench/examples/two-page-demo/dist/index.html`

该示例为独立 HTML，无需启动服务。

## 2. 重新校验与构建

在 Skill 根目录执行：

```bash
cd /Users/xunguo/Desktop/versioned-prototype-workbench
npm test
node scripts/protoctl.mjs validate --root examples/two-page-demo
node scripts/protoctl.mjs build all --root examples/two-page-demo
```

预期结果：自动化测试通过；校验无错误；生成 `dist/index.html`、`dist/operations/requests.html` 和 `dist/operations/approvals.html`。

## 3. 工作台检查

1. 在左侧切换“服务请求”和“审批管理”，确认主内容随之切换。
2. 分别打开“概览”“开发规格”“测试规格”“追溯矩阵”四个页签。
3. 确认版本号为 `v1.0`、`v1.1`、`v1.2` 形式，没有以日期作为版本号。
4. 在“开发规格”中确认默认选中当前版本和“本版变更”，正文来自该版本的 `change-dev.md`。
5. 切换“完整规格”，确认正文来自同版本 `snapshot-dev.md`，下载按钮文案、文件名和内容同步更新。
6. 保持“完整规格”并切换本页已发布版本，确认视图选择保持，预览和下载仍对应所选版本；切回“本版变更”重复检查。
7. 确认所选版本显示自身的基线提交、实现提交和 MR/PR；信息不完整时明确显示未关联，不生成虚假链接。
8. 当基线与实现提交均存在时，确认“查看本版 Diff”指向完整 SHA 组成的固定比较范围。
9. 在追溯矩阵中检查 `REQ-*`、`CHG-*`、`INT-*`、`RULE-*`、`TST-*` 等稳定 ID 及关联关系。

## 4. 原型交互检查

1. 点击“打开交互原型”。
2. 输入完整或部分记录编号，确认表格实时筛选。
3. 切换“可处理”和“已阻塞”，确认状态显示为中文且结果正确。
4. 输入不存在的编号，确认出现中文空状态；点击“重置”恢复三行数据。
5. 点击“导出 CSV”，确认文件名与表头为中文，内容只包含当前筛选结果。
6. 保留已阻塞记录并点击“执行操作”，确认出现阻塞提示；仅筛选“可处理”后再次执行，确认出现成功提示。

## 5. 响应式检查

在浏览器开发者工具中分别使用约 `1280px` 和 `390px` 宽度检查：

- 工作台桌面端左侧导航、摘要区和内容区无重叠。
- 移动端可用菜单按钮打开导航，页签、按钮和长文本不溢出。
- 两个原型页的指标、筛选区和表格在窄屏下仍可操作。

## 6. Git 与 MR/PR 关联检查

在真实 Git 项目中，将 `--root` 替换为项目的原型根目录，并使用实际提交 ID：

```bash
node scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role baseline --commit <commit-id>
node scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role implementation --commit <commit-id>
node scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role mr-head --commit <commit-id> --mr-kind mr --mr-id <mr-id> --mr-url <mr-url>
node scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role merge --commit <merge-commit-id>
node scripts/protoctl.mjs validate --root <project-root>
node scripts/protoctl.mjs build all --root <project-root>
```

重新打开工作台后，应能在“交付追踪”中看到对应的短提交 ID 与 MR/PR 编号。
