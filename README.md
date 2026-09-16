# Versioned Prototype Workbench

本仓库用于开发和验证 `versioned-prototype-workbench` Codex Skill。

## 可安装的 Skill

只有下面这个子目录属于对外分发的 Skill：

```text
skill/versioned-prototype-workbench/
```

在 Codex 中可以直接提出以下请求：

```text
请使用 skill-installer 安装：
仓库：Sean-XL196/versioned-prototype-workbench
路径：skill/versioned-prototype-workbench
版本：<release-tag>
名称：versioned-prototype-workbench
```

也可以运行安装器：

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo Sean-XL196/versioned-prototype-workbench \
  --path skill/versioned-prototype-workbench \
  --ref <release-tag>
```

仓库根目录的 `examples/` 和 `tests/` 仅用于开发验证。安装 Skill 子目录时不会复制这些内容。

## 仓库验证

```bash
npm test
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skill/versioned-prototype-workbench
```

根目录的 `scripts/protoctl.mjs` 只用于兼容仓库现有样例。新项目应调用已安装 Skill 内的 CLI。

## 面向使用者的介绍

直接打开 [`docs/skill-introduction.html`](docs/skill-introduction.html)，可查看 Skill 能力、版本流程、DEV 衔接方式和其他项目的使用方法。
