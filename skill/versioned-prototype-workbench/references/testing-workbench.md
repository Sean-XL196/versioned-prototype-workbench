# 工作台人工测试指南

本清单用于检查任意由本 Skill 生成的项目，不依赖仓库内示例。

## 1. 校验与构建

将 `<skill-dir>` 替换为已安装 Skill 目录，将 `<project-root>` 替换为项目的原型根目录：

```bash
node <skill-dir>/scripts/protoctl.mjs validate --root <project-root>
node <skill-dir>/scripts/protoctl.mjs build all --root <project-root>
```

预期结果：校验无错误；生成 `<project-root>/dist/index.html` 和各页面的独立 HTML。

## 2. 工作台检查

1. 直接打开 `<project-root>/dist/index.html`，确认不依赖本地服务或网络请求。
2. 在左侧切换模块页面，确认主内容、版本号和状态随页面变化。
3. 分别打开“概览”“开发规格”“测试规格”“追溯矩阵”。
4. 确认规格版本使用 `v1.0`、`v1.1` 形式，不使用日期作为版本号。
5. 在“开发规格”中确认默认选中 `current.released` 和“本版变更”。
6. 切换“完整规格”，确认正文、下载按钮文案、文件名和内容同步更新。
7. 保持当前文档视图切换历史版本，确认视图选择不丢失且内容属于所选版本。
8. 确认每个版本显示自己的基线提交、实现提交和 MR/PR；缺失信息必须明确显示未关联。
9. 当基线与实现提交都存在时，确认“查看本版 Diff”使用两个完整提交 SHA 的固定范围。
10. 在追溯矩阵检查 `SRC-*`、`ASIS-*`、`CHG-*`、`REQ-*`、`INT-*`、`RULE-*`、`TST-*` 的关联关系。

## 3. 页面交互检查

按当前版本的 `snapshot-test.md` 逐条执行，并至少确认：

- 主路径、失败路径和硬性拦截均可演示。
- 控件文案、焦点顺序和键盘操作与规格一致。
- 原型不产生规格之外的真实网络请求。
- 业务页没有差异标注、开发文档入口或工作台说明控件。

## 4. 响应式检查

在浏览器开发者工具中至少使用约 `1280px` 和 `390px` 宽度检查：

- 工作台导航、摘要、页签、版本控件和正文不重叠。
- 移动端导航可打开和关闭，长文本不造成页面级横向滚动。
- 页面中的表单、表格、工具栏和主操作仍可使用。

## 5. Git 与 MR/PR 关联检查

在真实 Git 项目中使用实际提交 ID：

```bash
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role baseline --commit <commit-id>
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role implementation --commit <commit-id>
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role mr-head --commit <commit-id> --mr-kind mr --mr-id <mr-id> --mr-url <mr-url>
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> --role merge --commit <merge-commit-id>
node <skill-dir>/scripts/protoctl.mjs validate --root <project-root>
node <skill-dir>/scripts/protoctl.mjs build all --root <project-root>
```

重新打开工作台后，确认交付追踪中的提交、MR/PR 和 Diff 范围属于当前选择的版本。
