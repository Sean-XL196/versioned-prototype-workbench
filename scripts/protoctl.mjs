#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '2.2.0';
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EVIDENCE_ID_RE = /^(SRC|ASIS|CHG|REQ|INT|RULE|TST|ALN)-[0-9]{3,}$/;
const SPEC_FILES = ['change-dev.md', 'change-test.md', 'snapshot-dev.md', 'snapshot-test.md'];
const VERSION_FILES = [...SPEC_FILES, 'evidence.json', 'trace.json'];
const IMMUTABLE_FILES = [...SPEC_FILES, 'evidence.json'];
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_ROOT = path.join(SKILL_ROOT, 'assets');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq > 2) {
      options[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) options[key] = argv[++i];
    else options[key] = true;
  }
  return { positional, options };
}

function assertId(id, label = 'id') {
  if (!ID_RE.test(String(id || ''))) fail(`${label} must match ${ID_RE}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read JSON ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeNew(file, content) {
  if (fs.existsSync(file)) fail(`refusing to overwrite ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function writeAtomicJson(file, value) {
  const temp = `${file}.tmp-${process.pid}`;
  writeJson(temp, value);
  fs.renameSync(temp, file);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function readAsset(...parts) {
  return fs.readFileSync(path.join(ASSET_ROOT, ...parts), 'utf8');
}

function renderAsset(parts, replacements = {}) {
  let body = readAsset(...parts);
  for (const [key, value] of Object.entries(replacements)) body = body.replaceAll(`{{${key}}}`, String(value));
  return body;
}

function git(repo, args, { required = true } = {}) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    if (!required) return null;
    fail(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function discoverRepository(start) {
  let candidate = path.resolve(start);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return null;
    candidate = parent;
  }
  return git(candidate, ['rev-parse', '--show-toplevel'], { required: false });
}

function repositoryRoot(root, project = ensureProject(root)) {
  if (!project.repository) return null;
  return path.resolve(root, project.repository.root);
}

function resolveCommit(root, value) {
  const project = ensureProject(root);
  const repo = repositoryRoot(root, project);
  if (!repo) fail('project has no configured Git repository');
  if (!fs.existsSync(repo)) fail(`configured repository does not exist: ${repo}`);
  const commit = git(repo, ['rev-parse', `${value || 'HEAD'}^{commit}`]);
  if (!/^[a-f0-9]{40}$/i.test(commit)) fail(`cannot resolve commit: ${value}`);
  return commit.toLowerCase();
}

function parseVersion(id) {
  const match = VERSION_RE.exec(String(id || ''));
  if (!match) fail(`invalid version id: ${id}; expected v<major>.<minor>`);
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  return a.major === b.major ? a.minor - b.minor : a.major - b.major;
}

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'prototype-project';
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeResolve(root, ...parts) {
  const candidate = path.resolve(root, ...parts);
  if (!within(path.resolve(root), candidate)) fail(`path escapes project root: ${candidate}`);
  return candidate;
}

function safeResolveFrom(projectRoot, base, relative) {
  const candidate = path.resolve(base, relative);
  if (!within(path.resolve(projectRoot), candidate)) fail(`path escapes project root: ${candidate}`);
  return candidate;
}

function resolveRoot(optionRoot) {
  let current = path.resolve(optionRoot || process.cwd());
  if (fs.existsSync(current) && fs.statSync(current).isFile()) current = path.dirname(current);
  while (true) {
    if (fs.existsSync(path.join(current, 'prototype.project.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fail(`prototype.project.json not found from ${path.resolve(optionRoot || process.cwd())}`);
}

function projectFile(root) { return path.join(root, 'prototype.project.json'); }
function moduleDir(root, moduleId) { return safeResolve(root, 'modules', moduleId); }
function moduleFile(root, moduleId) { return path.join(moduleDir(root, moduleId), 'module.json'); }
function pageDir(root, moduleId, pageId) { return safeResolve(root, 'modules', moduleId, 'pages', pageId); }
function pageFile(root, moduleId, pageId) { return path.join(pageDir(root, moduleId, pageId), 'page.json'); }
function currentFile(root, moduleId, pageId) { return path.join(pageDir(root, moduleId, pageId), 'current.json'); }
function versionDir(root, moduleId, pageId, versionId) {
  if (!VERSION_RE.test(String(versionId || ''))) fail(`invalid version id: ${versionId}`);
  return path.join(pageDir(root, moduleId, pageId), 'versions', versionId);
}

function parseTarget(target) {
  const [moduleId, pageId, extra] = String(target || '').split('/');
  if (!moduleId || !pageId || extra) fail('target must be <module>/<page>');
  assertId(moduleId, 'module id');
  assertId(pageId, 'page id');
  return { moduleId, pageId };
}

function ensureProject(root) {
  const project = readJson(projectFile(root));
  if (project.schemaVersion !== 2) fail('unsupported project schemaVersion; run the v2 migration before continuing');
  return project;
}

function ensureModule(root, moduleId) {
  const file = moduleFile(root, moduleId);
  if (!fs.existsSync(file)) fail(`module not found: ${moduleId}`);
  return readJson(file);
}

function ensurePage(root, moduleId, pageId) {
  const file = pageFile(root, moduleId, pageId);
  if (!fs.existsSync(file)) fail(`page not found: ${moduleId}/${pageId}`);
  return readJson(file);
}

function nextVersionId(root, moduleId, pageId, bump = 'minor') {
  const currentPath = currentFile(root, moduleId, pageId);
  if (!fs.existsSync(currentPath)) return 'v1.0';
  const current = readJson(currentPath);
  const base = current.released || current.draft;
  if (!base) return 'v1.0';
  const parsed = parseVersion(base);
  if (bump === 'major') return `v${parsed.major + 1}.0`;
  if (bump !== 'minor') fail('bump must be major or minor');
  return `v${parsed.major}.${parsed.minor + 1}`;
}

function contextTemplate(scope, title) {
  return `# ${title} - 当前上下文\n\n目标：TODO(VPW)\n硬性约束：TODO(VPW)\n已确认决策：TODO(VPW)\n依赖：暂未声明。\n实现锚点：TODO(VPW)\n验证方式：TODO(VPW)\n当前阻塞：无。\n下一步：TODO(VPW)\n\n此文件只保留简洁的当前状态，不追加版本历史。\n`;
}

function baselineDev(title, id) {
  return `# ${title} - 开发规格\n\n> 当前完整有效规格。版本：${id}\n\n## 1. 目标与范围\n\nTODO(VPW)\n\n## 2. 当前基线与证据\n\n描述当前实现或需求来源，并引用 SRC-001。\n\n## 3. 需求\n\n| ID | 需求 | 证据 | 影响范围 |\n| --- | --- | --- | --- |\n| REQ-001 | TODO(VPW) | SRC-001 | 界面 / 数据 / 集成 |\n\n## 4. 交互与规则\n\n| ID | 类型 | 规则 | 失败行为 |\n| --- | --- | --- | --- |\n| INT-001 | 交互 | TODO(VPW) | TODO(VPW) |\n| RULE-001 | 规则 | TODO(VPW) | TODO(VPW) |\n\n## 5. 当前有效用户流程\n\n1. TODO(VPW)\n\n## 6. 依赖与契约\n\nTODO(VPW)\n\n## 7. 验收标准\n\n- [ ] REQ-001 已实现，且 TST-001 通过。\n`;
}

function baselineTest(title, id) {
  return `# ${title} - 测试规格\n\n> 当前完整有效测试规格。版本：${id}\n\n## 1. 前置条件\n\nTODO(VPW)\n\n## 2. 正向流程\n\n| ID | 操作步骤 | 预期结果 | 关联需求 |\n| --- | --- | --- | --- |\n| TST-001 | TODO(VPW) | TODO(VPW) | REQ-001 / INT-001 |\n\n## 3. 拒绝与边界场景\n\n| ID | 场景 | 预期结果 | 关联需求 |\n| --- | --- | --- | --- |\n| TST-002 | TODO(VPW) | TODO(VPW) | RULE-001 |\n\n## 4. 回归验证\n\n- [ ] TST-001 与 TST-002 均在独立原型中通过。\n`;
}

function baselineChange(kind, title) {
  const kindLabel = kind === 'Development' ? '开发' : '测试';
  return `# ${title} - ${kindLabel}基线\n\n来源：初始基线\n\n本基线建立首份完整${kindLabel}快照，当前有效规格以配套快照为准。\n`;
}

function changeDev(title, id, parent, source, ids) {
  return `# ${title} - 开发变更 ${id}\n\n父版本：${parent}\n来源：${source}\n\n## 1. 来源条目\n\n| ID | 来源原文 | 分类 |\n| --- | --- | --- |\n| ${ids.source} | TODO(VPW) | 需求 / 交互 / 规则 / 移除 / 证据缺失 |\n\n## 2. 生效变更\n\n| ID | 父版本行为 | 新行为 | 关联需求 | 证据 |\n| --- | --- | --- | --- | --- |\n| ${ids.change} | TODO(VPW) | TODO(VPW) | ${ids.requirement} | ${ids.asIs} |\n\n## 3. 流程影响\n\nTODO(VPW)\n\n## 4. 增量验收\n\n- [ ] ${ids.test} 能证明 ${ids.change} 与 ${ids.requirement}。\n\n未提及的父版本需求继续生效，当前完整事实以 snapshot-dev.md 为准。\n`;
}

function changeTest(title, id, parent, ids) {
  return `# ${title} - 测试变更 ${id}\n\n父版本：${parent}\n\n## 1. 新增或变更用例\n\n| ID | 场景 | 预期结果 | 关联需求 / 变更 |\n| --- | --- | --- | --- |\n| ${ids.test} | TODO(VPW) | TODO(VPW) | ${ids.requirement} / ${ids.change} |\n\n## 2. 父版本回归\n\n- [ ] 父版本中未变更的预期仍然通过。\n- [ ] 已被替代的预期只按本版本的新结果测试。\n\n当前完整事实以 snapshot-test.md 为准。\n`;
}

function versionManifest(id, parent, kind, mode, source) {
  return {
    schemaVersion: 2,
    id,
    parent,
    kind,
    mode,
    status: 'draft',
    source,
    createdAt: nowIso(),
    publishedAt: null,
    files: {
      changeDev: 'change-dev.md',
      changeTest: 'change-test.md',
      snapshotDev: 'snapshot-dev.md',
      snapshotTest: 'snapshot-test.md',
      evidence: 'evidence.json',
      trace: 'trace.json'
    },
    hashes: {}
  };
}

function nextEvidenceId(entries, prefix) {
  const values = Object.keys(entries).map((id) => new RegExp(`^${prefix}-(\\d+)$`).exec(id)).filter(Boolean).map((match) => Number(match[1]));
  return `${prefix}-${String(values.length ? Math.max(...values) + 1 : 1).padStart(3, '0')}`;
}

function evidenceManifest(id, kind, parent = null) {
  if (kind === 'baseline') return { manifest: { schemaVersion: 2, version: id, entries: {
    'SRC-001': { kind: 'source', summary: 'TODO(VPW)：标明需求简述或权威来源。' },
    'REQ-001': { kind: 'requirement', summary: 'TODO(VPW)', sourceIds: ['SRC-001'], prototypeTargets: ['#rows'], testIds: ['TST-001'] },
    'INT-001': { kind: 'interaction', summary: 'TODO(VPW)', requirementIds: ['REQ-001'], prototypeTargets: ['#primary-action'], testIds: ['TST-001'] },
    'RULE-001': { kind: 'rule', summary: 'TODO(VPW)', requirementIds: ['REQ-001'], testIds: ['TST-002'] },
    'TST-001': { kind: 'test', summary: 'TODO(VPW)', requirementIds: ['REQ-001', 'INT-001'] },
    'TST-002': { kind: 'test', summary: 'TODO(VPW)', requirementIds: ['RULE-001'] }
  } }, ids: { source: 'SRC-001', requirement: 'REQ-001', test: 'TST-001' } };
  const entries = { ...(parent?.entries || {}) };
  const ids = {
    source: nextEvidenceId(entries, 'SRC'),
    asIs: nextEvidenceId(entries, 'ASIS'),
    change: nextEvidenceId(entries, 'CHG'),
    requirement: nextEvidenceId(entries, 'REQ'),
    test: nextEvidenceId(entries, 'TST')
  };
  entries[ids.source] = { kind: 'source', summary: 'TODO(VPW)：保留变更来源。' };
  entries[ids.asIs] = { kind: 'as-is', summary: 'TODO(VPW)：描述当前行为。', path: null, symbol: null };
  entries[ids.change] = { kind: 'change', summary: 'TODO(VPW)', sourceIds: [ids.source], evidenceIds: [ids.asIs], requirementIds: [ids.requirement] };
  entries[ids.requirement] = { kind: 'requirement', summary: 'TODO(VPW)', sourceIds: [ids.source], evidenceIds: [ids.asIs], prototypeTargets: [], testIds: [ids.test] };
  entries[ids.test] = { kind: 'test', summary: 'TODO(VPW)', requirementIds: [ids.requirement, ids.change] };
  return { manifest: { schemaVersion: 2, version: id, entries }, ids };
}

function traceManifest(root, id, options = {}) {
  const project = ensureProject(root);
  const baselineCommit = project.repository ? resolveCommit(root, options['baseline-commit'] || 'HEAD') : null;
  return {
    schemaVersion: 2,
    version: id,
    repository: project.repository ? { baselineCommit, implementationCommit: null } : null,
    changeRequest: { kind: null, id: null, url: null, headCommit: null, mergeCommit: null },
    updatedAt: nowIso()
  };
}

function replaceSnapshotVersion(file, id) {
  let body = fs.readFileSync(file, 'utf8');
  if (/(?:Version:\s*|版本：)v\d+\.\d+/.test(body)) body = body.replace(/(?:Version:\s*|版本：)v\d+\.\d+/, `版本：${id}`);
  else body = `> 当前完整有效规格。版本：${id}\n\n${body}`;
  fs.writeFileSync(file, body, 'utf8');
}

function cmdInit(args, options) {
  const target = path.resolve(args[0] || process.cwd());
  if (fs.existsSync(path.join(target, 'prototype.project.json'))) fail(`project already initialized: ${target}`);
  const name = String(options.name || path.basename(target));
  const id = String(options.id || slug(name));
  assertId(id, 'project id');
  fs.mkdirSync(target, { recursive: true });
  const repoInput = options.repo === 'none' ? null : options.repo || discoverRepository(target);
  const discovered = repoInput ? path.resolve(String(repoInput)) : null;
  const repository = discovered && fs.existsSync(discovered)
    ? { root: path.relative(target, discovered) || '.', remote: git(discovered, ['remote', 'get-url', 'origin'], { required: false }) }
    : null;
  writeNew(path.join(target, 'prototype.project.json'), `${JSON.stringify({
    schemaVersion: 2,
    id,
    name,
    repository,
    design: { standard: 'operational-ui-v1', tokenFile: 'shared/design-system.css' },
    modules: []
  }, null, 2)}\n`);
  writeNew(path.join(target, 'shared', 'design-system.css'), readAsset('project-template', 'shared', 'design-system.css'));
  writeNew(path.join(target, 'shared', 'shell.css'), readAsset('project-template', 'shared', 'shell.css'));
  writeNew(path.join(target, 'shared', 'shell.js'), readAsset('project-template', 'shared', 'shell.js'));
  writeNew(path.join(target, 'shared', 'state-contracts', '.gitkeep'), '');
  fs.mkdirSync(path.join(target, 'modules'), { recursive: true });
  fs.mkdirSync(path.join(target, 'dist'), { recursive: true });
  console.log(`Initialized ${name} at ${target}`);
}

function cmdAddModule(args, options) {
  const moduleId = args[0];
  assertId(moduleId, 'module id');
  const root = resolveRoot(options.root);
  const project = ensureProject(root);
  if (project.modules.includes(moduleId) || fs.existsSync(moduleFile(root, moduleId))) fail(`module already exists: ${moduleId}`);
  const title = String(options.title || moduleId);
  const dir = moduleDir(root, moduleId);
  fs.mkdirSync(path.join(dir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'releases'), { recursive: true });
  writeJson(path.join(dir, 'module.json'), { schemaVersion: 2, id: moduleId, title, currentRelease: null, pages: [] });
  writeNew(path.join(dir, 'context.md'), contextTemplate('module', title));
  project.modules.push(moduleId);
  writeAtomicJson(projectFile(root), project);
  console.log(`Added module ${moduleId}`);
}

function cmdAddPage(args, options) {
  const [moduleId, pageId] = args;
  assertId(moduleId, 'module id');
  assertId(pageId, 'page id');
  const root = resolveRoot(options.root);
  const mod = ensureModule(root, moduleId);
  if (mod.pages.includes(pageId) || fs.existsSync(pageFile(root, moduleId, pageId))) fail(`page already exists: ${moduleId}/${pageId}`);
  const title = String(options.title || pageId);
  const dir = pageDir(root, moduleId, pageId);
  fs.mkdirSync(path.join(dir, 'prototype', 'revisions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'versions'), { recursive: true });
  writeJson(path.join(dir, 'page.json'), {
    schemaVersion: 2,
    id: pageId,
    module: moduleId,
    title,
    prototype: { entry: 'prototype/index.html', revision: 0, alignedToSpec: null, status: 'draft', lastAlignedAt: null, note: '' },
    dependencies: { pages: [], contracts: [] }
  });
  writeNew(path.join(dir, 'context.md'), contextTemplate('page', title));
  const replacements = { PAGE_TITLE: title, PAGE_ID: pageId };
  for (const file of ['index.html', 'page.css', 'fixtures.js', 'page.js']) {
    writeNew(path.join(dir, 'prototype', file), renderAsset(['project-template', 'page', file], replacements));
  }
  const id = nextVersionId(root, moduleId, pageId);
  const vdir = versionDir(root, moduleId, pageId, id);
  fs.mkdirSync(vdir, { recursive: true });
  writeJson(path.join(vdir, 'version.json'), versionManifest(id, null, 'baseline', 'baseline', 'Initial baseline'));
  writeNew(path.join(vdir, 'change-dev.md'), baselineChange('Development', title));
  writeNew(path.join(vdir, 'change-test.md'), baselineChange('Test', title));
  writeNew(path.join(vdir, 'snapshot-dev.md'), baselineDev(title, id));
  writeNew(path.join(vdir, 'snapshot-test.md'), baselineTest(title, id));
  writeJson(path.join(vdir, 'evidence.json'), evidenceManifest(id, 'baseline').manifest);
  writeJson(path.join(vdir, 'trace.json'), traceManifest(root, id, options));
  writeJson(path.join(dir, 'current.json'), { schemaVersion: 2, released: null, draft: id });
  mod.pages.push(pageId);
  writeAtomicJson(moduleFile(root, moduleId), mod);
  console.log(`Added page ${moduleId}/${pageId}; baseline draft ${id}`);
}

function cmdChange(args, options) {
  const { moduleId, pageId } = parseTarget(args[0]);
  const root = resolveRoot(options.root);
  const page = ensurePage(root, moduleId, pageId);
  const currentPath = currentFile(root, moduleId, pageId);
  const current = readJson(currentPath);
  if (current.draft) fail(`draft already exists: ${current.draft}`);
  if (!current.released) fail('publish the baseline before creating a change');
  const bump = String(options.bump || 'minor');
  const id = String(options.id || nextVersionId(root, moduleId, pageId, bump));
  if (!VERSION_RE.test(id)) fail(`invalid version id: ${id}`);
  if (compareVersions(id, current.released) <= 0) fail(`new version ${id} must be greater than ${current.released}`);
  const source = String(options.source || 'User request');
  const mode = options['docs-only'] ? 'docs-only' : 'spec-and-prototype';
  const vdir = versionDir(root, moduleId, pageId, id);
  fs.mkdirSync(vdir, { recursive: false });
  const parentDir = versionDir(root, moduleId, pageId, current.released);
  const evidence = evidenceManifest(id, 'change', readJson(path.join(parentDir, 'evidence.json')));
  writeJson(path.join(vdir, 'version.json'), versionManifest(id, current.released, 'change', mode, source));
  writeNew(path.join(vdir, 'change-dev.md'), changeDev(page.title, id, current.released, source, evidence.ids));
  writeNew(path.join(vdir, 'change-test.md'), changeTest(page.title, id, current.released, evidence.ids));
  fs.copyFileSync(path.join(parentDir, 'snapshot-dev.md'), path.join(vdir, 'snapshot-dev.md'));
  fs.copyFileSync(path.join(parentDir, 'snapshot-test.md'), path.join(vdir, 'snapshot-test.md'));
  replaceSnapshotVersion(path.join(vdir, 'snapshot-dev.md'), id);
  replaceSnapshotVersion(path.join(vdir, 'snapshot-test.md'), id);
  writeJson(path.join(vdir, 'evidence.json'), evidence.manifest);
  writeJson(path.join(vdir, 'trace.json'), traceManifest(root, id, options));
  current.draft = id;
  writeAtomicJson(currentPath, current);
  console.log(`Created ${mode} draft ${id} for ${moduleId}/${pageId}`);
}

function unresolvedMarkers(file) {
  return fs.readFileSync(file, 'utf8').includes('TODO(VPW)');
}

function documentEvidenceIds(file) {
  const body = fs.readFileSync(file, 'utf8');
  return [...new Set([...body.matchAll(/\b(?:SRC|ASIS|CHG|REQ|INT|RULE|TST|ALN)-[0-9]{3,}\b/g)].map((match) => match[0]))];
}

function hasVersionHeader(body, id) {
  return body.includes(`Version: ${id}`) || body.includes(`版本：${id}`);
}

function evidenceErrors(file, expectedVersion) {
  const errors = [];
  const evidence = readJson(file);
  if (evidence.schemaVersion !== 2) errors.push('evidence schemaVersion must be 2');
  if (evidence.version !== expectedVersion) errors.push(`evidence version must be ${expectedVersion}`);
  if (!evidence.entries || Array.isArray(evidence.entries) || typeof evidence.entries !== 'object') return [...errors, 'evidence entries must be an object'];
  for (const [id, entry] of Object.entries(evidence.entries)) {
    if (!EVIDENCE_ID_RE.test(id)) errors.push(`invalid evidence id ${id}`);
    if (!entry || typeof entry !== 'object' || typeof entry.summary !== 'string' || !entry.summary.trim()) errors.push(`${id} needs a summary`);
    for (const [field, value] of Object.entries(entry || {})) {
      if (!field.endsWith('Ids')) continue;
      if (!Array.isArray(value)) errors.push(`${id}.${field} must be an array`);
      else for (const referenced of value) if (!evidence.entries[referenced]) errors.push(`${id}.${field} references missing ${referenced}`);
    }
  }
  return errors;
}

function assertVersionDocuments(root, vdir, id) {
  const evidencePath = path.join(vdir, 'evidence.json');
  const evidence = readJson(evidencePath);
  const errors = evidenceErrors(evidencePath, id);
  if (ensureProject(root).repository) {
    for (const [evidenceId, entry] of Object.entries(evidence.entries || {})) {
      if (entry.kind === 'as-is' && (!entry.path || typeof entry.path !== 'string')) errors.push(`${evidenceId} needs a source path in a Git-backed project`);
    }
    const trace = readJson(path.join(vdir, 'trace.json'));
    if (!trace.repository?.baselineCommit) errors.push('Git-backed versions require a baseline commit');
  }
  for (const file of SPEC_FILES) {
    for (const referenced of documentEvidenceIds(path.join(vdir, file))) {
      if (!evidence.entries?.[referenced]) errors.push(`${file} references missing ${referenced}`);
    }
  }
  for (const file of ['snapshot-dev.md', 'snapshot-test.md']) {
    const header = fs.readFileSync(path.join(vdir, file), 'utf8').slice(0, 500);
    if (!hasVersionHeader(header, id)) errors.push(`${file} header does not identify ${id}`);
  }
  if (errors.length) fail(`${id} document contract failed:\n${errors.join('\n')}`);
}

function cmdPublish(args, options) {
  const { moduleId, pageId } = parseTarget(args[0]);
  const root = resolveRoot(options.root);
  const page = ensurePage(root, moduleId, pageId);
  const currentPath = currentFile(root, moduleId, pageId);
  const current = readJson(currentPath);
  const id = String(options.id || current.draft || '');
  if (!id || current.draft !== id) fail(`publish target must equal current draft (${current.draft || 'none'})`);
  const vdir = versionDir(root, moduleId, pageId, id);
  const manifestPath = path.join(vdir, 'version.json');
  const manifest = readJson(manifestPath);
  if (manifest.status !== 'draft') fail(`${id} is not a draft`);
  if (manifest.parent !== current.released) fail(`draft parent ${manifest.parent} does not match released ${current.released}`);
  for (const file of VERSION_FILES) {
    const full = path.join(vdir, file);
    if (!fs.existsSync(full)) fail(`missing ${file}`);
    if (IMMUTABLE_FILES.includes(file) && unresolvedMarkers(full)) fail(`unresolved TODO(VPW) in ${full}`);
    if (fs.statSync(full).size < 40) fail(`document is too small: ${full}`);
  }
  assertVersionDocuments(root, vdir, id);
  manifest.status = 'released';
  manifest.publishedAt = nowIso();
  manifest.hashes = Object.fromEntries(IMMUTABLE_FILES.map((file) => [file, sha256(path.join(vdir, file))]));
  writeJson(manifestPath, manifest);
  current.released = id;
  current.draft = null;
  writeAtomicJson(currentPath, current);
  page.prototype.status = page.prototype.alignedToSpec === id ? 'aligned' : 'docs-ahead';
  writeJson(pageFile(root, moduleId, pageId), page);
  console.log(`Published ${moduleId}/${pageId} spec ${id}; prototype status=${page.prototype.status}`);
}

function listPrototypeSources(root, page) {
  const pdir = path.dirname(pageFile(root, page.module, page.id));
  const prototypeRoot = path.join(pdir, 'prototype');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'revisions') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(prototypeRoot);
  return files.sort();
}

function listBundleSources(root, page) {
  const pdir = path.dirname(pageFile(root, page.module, page.id));
  const entry = safeResolve(pdir, page.prototype.entry);
  const base = path.dirname(entry);
  const html = fs.readFileSync(entry, 'utf8');
  const files = [];
  const patterns = [
    /<link\s+data-proto-bundle="style"\s+href="([^"]+)"\s*>/g,
    /<script\s+data-proto-bundle\s+src="([^"]+)"\s*><\/script>/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      const file = safeResolveFrom(root, base, match[1]);
      if (!files.includes(file)) files.push(file);
    }
  }
  return files.sort();
}

function sourceHashes(root, page) {
  const files = [...new Set([...listPrototypeSources(root, page), ...listBundleSources(root, page)])].sort();
  return Object.fromEntries(files.map((file) => [path.relative(root, file), sha256(file)]));
}

function cmdAlign(args, options) {
  const { moduleId, pageId } = parseTarget(args[0]);
  const root = resolveRoot(options.root);
  const page = ensurePage(root, moduleId, pageId);
  const current = readJson(currentFile(root, moduleId, pageId));
  if (!current.released) fail('no released specification to align');
  if (current.draft) fail(`publish or remove draft ${current.draft} before alignment`);
  if (page.prototype.alignedToSpec === current.released && page.prototype.revision > 0) fail(`prototype already aligns to ${current.released}; create a new specification version before another prototype revision`);
  const entry = safeResolve(pageDir(root, moduleId, pageId), page.prototype.entry);
  if (!fs.existsSync(entry)) fail(`prototype entry missing: ${entry}`);
  const evidence = readJson(path.join(versionDir(root, moduleId, pageId, current.released), 'evidence.json'));
  const evidenceIds = String(options.evidence || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!evidenceIds.length) fail('align requires --evidence <ID[,ID]>');
  for (const id of evidenceIds) if (!evidence.entries?.[id]) fail(`alignment references missing evidence id: ${id}`);
  const trace = readJson(path.join(versionDir(root, moduleId, pageId, current.released), 'trace.json'));
  if (ensureProject(root).repository && !trace.repository?.implementationCommit) {
    fail(`link the implementation commit before alignment: link-commit ${moduleId}/${pageId} --role implementation --commit <sha>`);
  }
  page.prototype.revision += 1;
  page.prototype.alignedToSpec = current.released;
  page.prototype.status = 'aligned';
  page.prototype.lastAlignedAt = nowIso();
  page.prototype.note = String(options.note || `Aligned to ${current.released}`);
  const record = {
    schemaVersion: 2,
    revision: page.prototype.revision,
    alignedToSpec: current.released,
    evidenceIds,
    implementationCommit: trace.repository?.implementationCommit || null,
    createdAt: page.prototype.lastAlignedAt,
    note: page.prototype.note,
    hashes: sourceHashes(root, page)
  };
  writeJson(path.join(pageDir(root, moduleId, pageId), 'prototype', 'revisions', `p${page.prototype.revision}.json`), record);
  writeJson(pageFile(root, moduleId, pageId), page);
  console.log(`Aligned ${moduleId}/${pageId} prototype p${page.prototype.revision} to ${current.released}`);
}

function cmdLinkCommit(args, options) {
  const { moduleId, pageId } = parseTarget(args[0]);
  const root = resolveRoot(options.root);
  const current = readJson(currentFile(root, moduleId, pageId));
  const id = String(options.version || current.draft || current.released || '');
  if (!id) fail('no version available to link');
  const role = String(options.role || 'implementation');
  if (!['baseline', 'implementation', 'mr-head', 'merge'].includes(role)) fail('role must be baseline, implementation, mr-head, or merge');
  const commit = resolveCommit(root, options.commit || 'HEAD');
  const tracePath = path.join(versionDir(root, moduleId, pageId, id), 'trace.json');
  const trace = readJson(tracePath);
  if (!trace.repository) trace.repository = { baselineCommit: null, implementationCommit: null };
  if (role === 'baseline') trace.repository.baselineCommit = commit;
  if (role === 'implementation') trace.repository.implementationCommit = commit;
  if (role === 'mr-head') trace.changeRequest.headCommit = commit;
  if (role === 'merge') trace.changeRequest.mergeCommit = commit;
  if (options['mr-id']) trace.changeRequest.id = String(options['mr-id']);
  if (options['mr-url']) trace.changeRequest.url = String(options['mr-url']);
  if (options['mr-kind']) {
    if (!['mr', 'pr'].includes(String(options['mr-kind']))) fail('mr-kind must be mr or pr');
    trace.changeRequest.kind = String(options['mr-kind']);
  }
  trace.updatedAt = nowIso();
  writeAtomicJson(tracePath, trace);
  console.log(`Linked ${role} commit ${commit.slice(0, 12)} to ${moduleId}/${pageId} ${id}`);
}

function currentChain(root, moduleId, pageId, current) {
  const chain = [];
  const seen = new Set();
  let id = current.released;
  while (id) {
    if (seen.has(id)) fail(`version cycle at ${moduleId}/${pageId}/${id}`);
    seen.add(id);
    const manifest = readJson(path.join(versionDir(root, moduleId, pageId, id), 'version.json'));
    chain.unshift(manifest);
    id = manifest.parent;
  }
  return chain;
}

function addIfExists(files, file) {
  if (fs.existsSync(file) && !files.includes(file)) files.push(file);
}

function cmdContext(args, options) {
  const { moduleId, pageId } = parseTarget(args[0]);
  const root = resolveRoot(options.root);
  const page = ensurePage(root, moduleId, pageId);
  const current = readJson(currentFile(root, moduleId, pageId));
  const intent = String(options.intent || 'docs');
  if (!['docs', 'html', 'history'].includes(intent)) fail('intent must be docs, html, or history');
  const files = [];
  [projectFile(root), moduleFile(root, moduleId), path.join(moduleDir(root, moduleId), 'context.md'), pageFile(root, moduleId, pageId), path.join(pageDir(root, moduleId, pageId), 'context.md'), currentFile(root, moduleId, pageId)].forEach((file) => addIfExists(files, file));
  if (current.released) {
    const releasedDir = versionDir(root, moduleId, pageId, current.released);
    addIfExists(files, path.join(releasedDir, 'snapshot-dev.md'));
    addIfExists(files, path.join(releasedDir, 'snapshot-test.md'));
    addIfExists(files, path.join(releasedDir, 'evidence.json'));
    addIfExists(files, path.join(releasedDir, 'trace.json'));
  }
  if (intent === 'docs' && current.draft) {
    const draftDir = versionDir(root, moduleId, pageId, current.draft);
    ['version.json', ...SPEC_FILES].forEach((file) => addIfExists(files, path.join(draftDir, file)));
  }
  if (intent === 'html') {
    listPrototypeSources(root, page).forEach((file) => addIfExists(files, file));
    listBundleSources(root, page).forEach((file) => addIfExists(files, file));
    for (const contract of page.dependencies.contracts || []) addIfExists(files, safeResolve(root, contract));
  }
  if (intent === 'history' && current.released) {
    for (const manifest of currentChain(root, moduleId, pageId, current)) {
      const dir = versionDir(root, moduleId, pageId, manifest.id);
      addIfExists(files, path.join(dir, 'version.json'));
      addIfExists(files, path.join(dir, 'change-dev.md'));
      addIfExists(files, path.join(dir, 'change-test.md'));
      addIfExists(files, path.join(dir, 'evidence.json'));
      addIfExists(files, path.join(dir, 'trace.json'));
    }
  }
  const result = {
    target: `${moduleId}/${pageId}`,
    intent,
    released: current.released,
    draft: current.draft,
    prototype: page.prototype,
    files: files.map((file) => path.relative(root, file)),
    totalBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0)
  };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Context ${result.target} [${intent}]`);
    console.log(`Released: ${result.released || '-'} | Draft: ${result.draft || '-'} | Prototype: p${page.prototype.revision} ${page.prototype.status}`);
    result.files.forEach((file) => console.log(`- ${file}`));
    console.log(`Total bytes: ${result.totalBytes}`);
  }
}

function bundleHtml(root, page) {
  const pdir = path.dirname(pageFile(root, page.module, page.id));
  const entry = safeResolve(pdir, page.prototype.entry);
  let html = fs.readFileSync(entry, 'utf8');
  const base = path.dirname(entry);
  html = html.replace(/<link\s+data-proto-bundle="style"\s+href="([^"]+)"\s*>/g, (_, href) => {
    const file = safeResolveFrom(root, base, href);
    return `<style data-source="${href}">\n${fs.readFileSync(file, 'utf8')}\n</style>`;
  });
  html = html.replace(/<script\s+data-proto-bundle\s+src="([^"]+)"\s*><\/script>/g, (_, src) => {
    const file = safeResolveFrom(root, base, src);
    const body = fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script data-source="${src}">\n${body}\n</script>`;
  });
  if (html.includes('data-proto-bundle')) fail(`unresolved bundle marker in ${entry}`);
  return html;
}

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortCommit(value) {
  return value ? String(value).slice(0, 12) : '未关联';
}

function repositoryWebUrl(remote) {
  const value = String(remote || '').trim().replace(/\.git$/, '');
  let match = /^git@([^:]+):(.+)$/.exec(value);
  if (match) return `https://${match[1]}/${match[2]}`;
  match = /^ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+)$/.exec(value);
  if (match) return `https://${match[1]}/${match[2]}`;
  if (/^https?:\/\//.test(value)) return value;
  return null;
}

function versionDiffUrl(project, trace) {
  const webUrl = repositoryWebUrl(project.repository?.remote);
  const base = trace.repository?.baselineCommit;
  const head = trace.repository?.implementationCommit;
  return webUrl && base && head ? `${webUrl}/compare/${base}...${head}` : null;
}

function statusLabel(status) {
  return ({ aligned: '已对齐', 'docs-ahead': '文档领先', draft: '草稿' })[status] || status;
}

function kindLabel(kind) {
  return ({ baseline: '基线', change: '变更', source: '来源', 'as-is': '现网', requirement: '需求', interaction: '交互', rule: '规则', test: '测试', alignment: '对齐' })[kind] || kind;
}

function sourceLabel(source) {
  return ({
    'Initial baseline': '初始基线',
    'Operational UI design standard template': '运营界面设计标准模板',
    'Example customer feedback: show request priority': '示例客户反馈：显示请求优先级'
  })[source] || source;
}

function entryReferences(entry) {
  const ids = Object.entries(entry || {}).filter(([key, value]) => key.endsWith('Ids') && Array.isArray(value)).flatMap(([, value]) => value);
  return [...new Set(ids)].join(', ') || '-';
}

function renderTraceRows(evidence) {
  const rows = Object.entries(evidence?.entries || {}).map(([id, entry]) => {
    const target = Array.isArray(entry.prototypeTargets) && entry.prototypeTargets.length ? entry.prototypeTargets.join(', ') : '-';
    return `<tr><td><span class="wb-id">${esc(id)}</span></td><td class="wb-kind">${esc(kindLabel(entry.kind))}</td><td>${esc(entry.summary)}</td><td>${esc(entryReferences(entry))}</td><td><code>${esc(target)}</code></td></tr>`;
  }).join('');
  return rows || '<tr><td colspan="5"><div class="wb-empty">暂无可追溯条目。</div></td></tr>';
}

function renderPageWorkspace(root, moduleId, pageId, first) {
  const project = ensureProject(root);
  const page = ensurePage(root, moduleId, pageId);
  const current = readJson(currentFile(root, moduleId, pageId));
  const key = `${moduleId}/${pageId}`;
  const releasedDir = current.released ? versionDir(root, moduleId, pageId, current.released) : null;
  const test = releasedDir ? fs.readFileSync(path.join(releasedDir, 'snapshot-test.md'), 'utf8') : '暂无已发布的测试规格。';
  const evidence = releasedDir ? readJson(path.join(releasedDir, 'evidence.json')) : { entries: {} };
  const trace = releasedDir ? readJson(path.join(releasedDir, 'trace.json')) : { repository: null, changeRequest: {} };
  const chain = current.released ? currentChain(root, moduleId, pageId, current).reverse() : [];
  const timeline = chain.map((version) => `<li><strong>${esc(version.id)}</strong> <span>${esc(kindLabel(version.kind))} · ${esc(sourceLabel(version.source))}</span></li>`).join('') || '<li><span>暂无已发布版本</span></li>';
  const statusClass = page.prototype.status === 'aligned' ? 'wb-badge--aligned' : 'wb-badge--ahead';
  const traceCount = Object.keys(evidence.entries || {}).length;
  const safeKey = key.replace(/[^a-z0-9]+/gi, '-');
  const versionOptions = chain.map((version) => `<option value="${esc(version.id)}"${version.id === current.released ? ' selected' : ''}>${esc(version.id)} · ${esc(kindLabel(version.kind))}</option>`).join('');
  const versionViews = chain.map((version) => {
    const dir = versionDir(root, moduleId, pageId, version.id);
    const versionChange = fs.readFileSync(path.join(dir, 'change-dev.md'), 'utf8');
    const versionSnapshot = fs.readFileSync(path.join(dir, 'snapshot-dev.md'), 'utf8');
    const versionTrace = readJson(path.join(dir, 'trace.json'));
    const versionKey = version.id.replace(/[^a-z0-9]+/gi, '-');
    const changeDocId = `${safeKey}-dev-${versionKey}-change`;
    const snapshotDocId = `${safeKey}-dev-${versionKey}-snapshot`;
    const mrUrl = versionTrace.changeRequest?.url;
    const diffUrl = versionDiffUrl(project, versionTrace);
    const mr = mrUrl
      ? `<a class="wb-version-link" href="${esc(mrUrl)}" target="_blank" rel="noopener">查看 ${esc((versionTrace.changeRequest.kind || 'MR').toUpperCase())} ${esc(versionTrace.changeRequest.id || '')}</a>`
      : '<span class="wb-version-empty">未关联 MR</span>';
    const diff = diffUrl
      ? `<a class="wb-version-link wb-version-diff" href="${esc(diffUrl)}" target="_blank" rel="noopener">查看本版 Diff</a>`
      : '<span class="wb-version-empty">待关联实现提交后生成 Diff</span>';
    return `<section class="wb-version-view" data-version="${esc(version.id)}"${version.id === current.released ? '' : ' hidden'}>
      <div class="wb-version-trace" aria-label="${esc(version.id)} 版本追溯">
        <div><span>基线提交</span><code>${esc(shortCommit(versionTrace.repository?.baselineCommit))}</code></div>
        <div><span>实现提交</span><code>${esc(shortCommit(versionTrace.repository?.implementationCommit))}</code></div>
        <div><span>MR / PR</span>${mr}</div>
        <div><span>版本差异</span>${diff}</div>
      </div>
      <pre class="wb-doc wb-document" id="${esc(changeDocId)}" data-document-mode="change" data-filename="${esc(pageId)}-${esc(version.id)}-change-dev.md" data-download-label="下载本版变更">${esc(versionChange)}</pre>
      <pre class="wb-doc wb-document" id="${esc(snapshotDocId)}" data-document-mode="snapshot" data-filename="${esc(pageId)}-${esc(version.id)}-snapshot-dev.md" data-download-label="下载完整规格" hidden>${esc(versionSnapshot)}</pre>
    </section>`;
  }).join('');
  return `<section class="wb-page${first ? ' is-active' : ''}" data-page-key="${esc(key)}">
    <header class="wb-page__head">
      <div><h2>${esc(page.title)}</h2><div class="wb-page__path">${esc(key)}</div></div>
      <div class="wb-actions"><a class="wb-button wb-button--primary" href="./${esc(moduleId)}/${esc(pageId)}.html">打开交互原型</a></div>
    </header>
    <div class="wb-status-strip">
      <div class="wb-status-item"><div class="wb-status-item__label">规格版本</div><div class="wb-status-item__value">${esc(current.released || '仅有草稿')}</div></div>
      <div class="wb-status-item"><div class="wb-status-item__label">原型修订</div><div class="wb-status-item__value">p${page.prototype.revision}</div></div>
      <div class="wb-status-item"><div class="wb-status-item__label">对齐状态</div><div class="wb-status-item__value"><span class="wb-badge ${statusClass}">${esc(statusLabel(page.prototype.status))}</span></div></div>
      <div class="wb-status-item"><div class="wb-status-item__label">证据索引</div><div class="wb-status-item__value">${traceCount} 个稳定 ID</div></div>
    </div>
    <div class="wb-tabs" role="tablist" aria-label="${esc(page.title)}视图">
      <button class="wb-tab" type="button" role="tab" aria-selected="true" data-tab="overview">概览</button>
      <button class="wb-tab" type="button" role="tab" aria-selected="false" data-tab="development">开发规格</button>
      <button class="wb-tab" type="button" role="tab" aria-selected="false" data-tab="testing">测试规格</button>
      <button class="wb-tab" type="button" role="tab" aria-selected="false" data-tab="traceability">追溯矩阵</button>
    </div>
    <div class="wb-tab-panel is-active" data-panel="overview">
      <div class="wb-overview-grid">
        <section class="wb-section"><header class="wb-section__head"><h3>版本历史</h3><span class="wb-badge">已发布 ${chain.length} 个版本</span></header><div class="wb-section__body"><ol class="wb-timeline">${timeline}</ol></div></section>
        <section class="wb-section"><header class="wb-section__head"><h3>交付追踪</h3></header><div class="wb-section__body"><dl class="wb-trace-summary"><div><dt>基线提交</dt><dd>${esc(shortCommit(trace.repository?.baselineCommit))}</dd></div><div><dt>实现提交</dt><dd>${esc(shortCommit(trace.repository?.implementationCommit))}</dd></div><div><dt>MR / PR</dt><dd>${esc(trace.changeRequest?.id || '未关联')}</dd></div><div><dt>合并提交</dt><dd>${esc(shortCommit(trace.changeRequest?.mergeCommit))}</dd></div></dl></div></section>
      </div>
    </div>
    <div class="wb-tab-panel" data-panel="development">
      <div class="wb-doc-toolbar">
        <div class="wb-doc-controls">
          <label class="wb-version-field"><span>开发文档版本</span><select class="wb-version-select" aria-label="${esc(page.title)}开发文档版本">${versionOptions}</select></label>
          <div class="wb-document-mode" role="group" aria-label="${esc(page.title)}开发文档视图">
            <button class="wb-document-mode-button" type="button" aria-pressed="true" data-document-mode="change">本版变更</button>
            <button class="wb-document-mode-button" type="button" aria-pressed="false" data-document-mode="snapshot">完整规格</button>
          </div>
        </div>
        <button class="wb-button" type="button" data-download="${safeKey}-dev-${String(current.released || '').replace(/[^a-z0-9]+/gi, '-')}-change" data-download-selected data-filename="${esc(pageId)}-${esc(current.released || 'draft')}-change-dev.md">下载本版变更</button>
      </div>
      ${versionViews || '<div class="wb-empty">暂无已发布的开发规格。</div>'}
    </div>
    <div class="wb-tab-panel" data-panel="testing"><div class="wb-actions" style="margin-bottom:12px"><button class="wb-button" type="button" data-download="${safeKey}-test" data-filename="${esc(pageId)}-${esc(current.released || 'draft')}-test.md">下载测试规格</button></div><pre class="wb-doc" id="${safeKey}-test">${esc(test)}</pre></div>
    <div class="wb-tab-panel" data-panel="traceability"><div class="wb-trace-table-wrap"><table class="wb-trace-table"><thead><tr><th style="width:14%">ID</th><th style="width:12%">类型</th><th style="width:30%">摘要</th><th style="width:24%">关联 ID</th><th style="width:20%">原型定位</th></tr></thead><tbody>${renderTraceRows(evidence)}</tbody></table></div></div>
  </section>`;
}

function buildHub(root) {
  const project = ensureProject(root);
  const sidebar = [];
  const workspaces = [];
  let pageCount = 0;
  let alignedCount = 0;
  let evidenceCount = 0;
  for (const moduleId of project.modules) {
    const mod = ensureModule(root, moduleId);
    const buttons = mod.pages.map((pageId) => {
      const page = ensurePage(root, moduleId, pageId);
      const current = readJson(currentFile(root, moduleId, pageId));
      const first = pageCount === 0;
      pageCount += 1;
      if (page.prototype.status === 'aligned') alignedCount += 1;
      if (current.released) evidenceCount += Object.keys(readJson(path.join(versionDir(root, moduleId, pageId, current.released), 'evidence.json')).entries || {}).length;
      workspaces.push(renderPageWorkspace(root, moduleId, pageId, first));
      return `<button class="wb-page-button" type="button" data-page-key="${esc(moduleId)}/${esc(pageId)}"${first ? ' aria-current="page"' : ''}><span class="wb-page-button__name">${esc(page.title)}</span><span class="wb-page-button__version">${esc(current.released || '-')}</span><span class="wb-page-button__state"><span class="wb-state-dot${page.prototype.status === 'aligned' ? ' wb-state-dot--aligned' : ''}"></span>${esc(statusLabel(page.prototype.status))} · p${page.prototype.revision}</span></button>`;
    }).join('\n');
    sidebar.push(`<section class="wb-module"><h2 class="wb-module__title">${esc(mod.title)}</h2>${buttons}</section>`);
  }
  const css = readAsset('workbench', 'workbench.css');
  const js = readAsset('workbench', 'workbench.js').replace(/<\/script/gi, '<\\/script');
  const releaseCount = project.modules.filter((moduleId) => ensureModule(root, moduleId).currentRelease).length;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.name)} · 版本化原型工作台</title><style>${css}</style></head><body><div class="wb-shell"><header class="wb-topbar"><div class="wb-brand"><button class="wb-menu-button" type="button" aria-label="打开导航" title="打开导航" aria-expanded="false">&#9776;</button><span class="wb-brand__mark" aria-hidden="true">VP</span><div class="wb-brand__copy"><span class="wb-brand__name">${esc(project.name)}</span><span class="wb-brand__meta">版本化原型工作台</span></div></div><div class="wb-topbar__right"><span class="wb-overall">${pageCount} 个页面中 ${alignedCount} 个已对齐</span><span class="wb-badge ${alignedCount === pageCount && pageCount ? 'wb-badge--aligned' : 'wb-badge--ahead'}">${alignedCount === pageCount && pageCount ? '可进入评审' : '需要处理'}</span></div></header><div class="wb-body"><aside class="wb-sidebar" aria-label="模块与页面"><div class="wb-sidebar__heading"><span>原型页面</span><span class="wb-sidebar__count">${pageCount}</span></div>${sidebar.join('\n')}</aside><main class="wb-main"><section class="wb-summary"><div class="wb-summary__head"><div><p class="wb-eyebrow">规格控制</p><h1>评审工作台</h1><p class="wb-summary__description">查看当前发布组成、原型对齐状态与证据链。</p></div><div class="wb-summary__release"><span>模块发布</span><strong>${project.modules.length} 个模块中 ${releaseCount} 个已发布</strong></div></div><div class="wb-stats"><div class="wb-stat"><div class="wb-stat__label">模块</div><div class="wb-stat__value">${project.modules.length}</div></div><div class="wb-stat"><div class="wb-stat__label">页面</div><div class="wb-stat__value">${pageCount}</div></div><div class="wb-stat"><div class="wb-stat__label">已对齐</div><div class="wb-stat__value">${alignedCount}</div></div><div class="wb-stat"><div class="wb-stat__label">证据 ID</div><div class="wb-stat__value">${evidenceCount}</div></div></div></section><div class="wb-content">${workspaces.join('\n') || '<div class="wb-empty">请先添加模块与页面。</div>'}</div></main></div></div><script>${js}</script></body></html>`;
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'index.html'), html, 'utf8');
}

function buildOne(root, moduleId, pageId) {
  const page = ensurePage(root, moduleId, pageId);
  const out = path.join(root, 'dist', moduleId, `${pageId}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bundleHtml(root, page), 'utf8');
  console.log(`Built ${path.relative(root, out)}`);
}

function cmdBuild(args, options) {
  const root = resolveRoot(options.root);
  const target = args[0] || 'all';
  if (target === 'all') {
    const project = ensureProject(root);
    for (const moduleId of project.modules) {
      const mod = ensureModule(root, moduleId);
      for (const pageId of mod.pages) buildOne(root, moduleId, pageId);
    }
  } else {
    const { moduleId, pageId } = parseTarget(target);
    buildOne(root, moduleId, pageId);
  }
  buildHub(root);
  console.log(`Built ${path.relative(root, path.join(root, 'dist', 'index.html'))}`);
}

function validateVersion(root, moduleId, pageId, id, errors) {
  let manifest;
  const dir = versionDir(root, moduleId, pageId, id);
  try { manifest = readJson(path.join(dir, 'version.json')); } catch { return null; }
  if (manifest.id !== id) errors.push(`${moduleId}/${pageId}/${id}: manifest id mismatch`);
  if (manifest.schemaVersion !== 2) errors.push(`${moduleId}/${pageId}/${id}: schemaVersion must be 2`);
  if (!VERSION_RE.test(id)) errors.push(`${moduleId}/${pageId}/${id}: invalid version id`);
  if (!['baseline', 'change'].includes(manifest.kind)) errors.push(`${moduleId}/${pageId}/${id}: invalid kind`);
  if (!['draft', 'released'].includes(manifest.status)) errors.push(`${moduleId}/${pageId}/${id}: invalid status`);
  for (const file of VERSION_FILES) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) errors.push(`${moduleId}/${pageId}/${id}: missing ${file}`);
    else if (manifest.status === 'released' && IMMUTABLE_FILES.includes(file)) {
      if (!manifest.hashes?.[file]) errors.push(`${moduleId}/${pageId}/${id}: missing hash for ${file}`);
      else if (manifest.hashes[file] !== sha256(full)) errors.push(`${moduleId}/${pageId}/${id}: released file changed ${file}`);
    }
  }
  const evidencePath = path.join(dir, 'evidence.json');
  if (fs.existsSync(evidencePath)) {
    const evidence = readJson(evidencePath);
    evidenceErrors(evidencePath, id).forEach((error) => errors.push(`${moduleId}/${pageId}/${id}: ${error}`));
    if (ensureProject(root).repository) {
      for (const [evidenceId, entry] of Object.entries(evidence.entries || {})) {
        if (entry.kind === 'as-is' && (!entry.path || typeof entry.path !== 'string')) errors.push(`${moduleId}/${pageId}/${id}: ${evidenceId} needs a source path`);
      }
    }
    for (const file of SPEC_FILES) {
      const full = path.join(dir, file);
      if (!fs.existsSync(full)) continue;
      for (const referenced of documentEvidenceIds(full)) if (!evidence.entries?.[referenced]) errors.push(`${moduleId}/${pageId}/${id}: ${file} references missing ${referenced}`);
    }
  }
  for (const file of ['snapshot-dev.md', 'snapshot-test.md']) {
    const full = path.join(dir, file);
    if (fs.existsSync(full) && !hasVersionHeader(fs.readFileSync(full, 'utf8').slice(0, 500), id)) errors.push(`${moduleId}/${pageId}/${id}: ${file} header version mismatch`);
  }
  const tracePath = path.join(dir, 'trace.json');
  if (fs.existsSync(tracePath)) {
    const trace = readJson(tracePath);
    if (trace.schemaVersion !== 2 || trace.version !== id) errors.push(`${moduleId}/${pageId}/${id}: trace identity mismatch`);
    const repo = repositoryRoot(root);
    if (repo && !trace.repository?.baselineCommit) errors.push(`${moduleId}/${pageId}/${id}: missing baseline commit`);
    for (const commit of [trace.repository?.baselineCommit, trace.repository?.implementationCommit, trace.changeRequest?.headCommit, trace.changeRequest?.mergeCommit].filter(Boolean)) {
      if (!/^[a-f0-9]{40}$/.test(commit)) errors.push(`${moduleId}/${pageId}/${id}: trace contains invalid commit ${commit}`);
      else if (repo && git(repo, ['cat-file', '-e', `${commit}^{commit}`], { required: false }) === null) errors.push(`${moduleId}/${pageId}/${id}: trace commit is not available ${commit}`);
    }
  }
  return manifest;
}

function validatePage(root, moduleId, pageId, errors) {
  let page;
  try { page = ensurePage(root, moduleId, pageId); } catch { errors.push(`${moduleId}/${pageId}: unreadable page`); return; }
  if (page.id !== pageId || page.module !== moduleId) errors.push(`${moduleId}/${pageId}: identity mismatch`);
  if (!['draft', 'aligned', 'docs-ahead'].includes(page.prototype?.status)) errors.push(`${moduleId}/${pageId}: invalid prototype status`);
  const entry = safeResolve(pageDir(root, moduleId, pageId), page.prototype?.entry || '');
  if (!fs.existsSync(entry)) errors.push(`${moduleId}/${pageId}: prototype entry missing`);
  const currentPath = currentFile(root, moduleId, pageId);
  if (!fs.existsSync(currentPath)) { errors.push(`${moduleId}/${pageId}: current.json missing`); return; }
  const current = readJson(currentPath);
  const versionsRoot = path.join(pageDir(root, moduleId, pageId), 'versions');
  const ids = fs.existsSync(versionsRoot) ? fs.readdirSync(versionsRoot).filter((name) => VERSION_RE.test(name)) : [];
  const manifests = new Map();
  for (const id of ids) {
    const manifest = validateVersion(root, moduleId, pageId, id, errors);
    if (manifest) manifests.set(id, manifest);
  }
  if (!current.released && !current.draft) errors.push(`${moduleId}/${pageId}: no released or draft version`);
  if (current.released && !manifests.has(current.released)) errors.push(`${moduleId}/${pageId}: released pointer missing target`);
  if (current.draft && !manifests.has(current.draft)) errors.push(`${moduleId}/${pageId}: draft pointer missing target`);
  if (current.draft && manifests.get(current.draft)?.status !== 'draft') errors.push(`${moduleId}/${pageId}: draft pointer is not draft`);
  const chain = new Set();
  let id = current.released;
  while (id) {
    if (chain.has(id)) { errors.push(`${moduleId}/${pageId}: version cycle at ${id}`); break; }
    chain.add(id);
    const manifest = manifests.get(id);
    if (!manifest) break;
    if (manifest.status !== 'released') errors.push(`${moduleId}/${pageId}/${id}: released chain contains draft`);
    id = manifest.parent;
  }
  for (const [versionId, manifest] of manifests) {
    if (manifest.status === 'released' && !chain.has(versionId)) errors.push(`${moduleId}/${pageId}/${versionId}: released version outside current chain`);
    if (manifest.kind === 'baseline' && manifest.parent !== null) errors.push(`${moduleId}/${pageId}/${versionId}: baseline has parent`);
    if (manifest.kind === 'change' && !manifests.has(manifest.parent)) errors.push(`${moduleId}/${pageId}/${versionId}: change parent missing`);
  }
  if (current.draft) {
    const draft = manifests.get(current.draft);
    if (draft?.parent !== current.released) errors.push(`${moduleId}/${pageId}/${current.draft}: draft parent differs from released`);
  }
  if (page.prototype?.alignedToSpec && !chain.has(page.prototype.alignedToSpec)) errors.push(`${moduleId}/${pageId}: alignedToSpec is not on released chain`);
  if (page.prototype?.status === 'aligned' && page.prototype.alignedToSpec !== current.released) errors.push(`${moduleId}/${pageId}: aligned status does not match released spec`);
  if (page.prototype?.revision > 0) {
    const recordPath = path.join(pageDir(root, moduleId, pageId), 'prototype', 'revisions', `p${page.prototype.revision}.json`);
    if (!fs.existsSync(recordPath)) errors.push(`${moduleId}/${pageId}: prototype revision record missing`);
    else if (page.prototype.status === 'aligned') {
      const record = readJson(recordPath);
      const actual = sourceHashes(root, page);
      if (JSON.stringify(record.hashes) !== JSON.stringify(actual)) errors.push(`${moduleId}/${pageId}: prototype changed after alignment p${page.prototype.revision}`);
      if (!Array.isArray(record.evidenceIds) || !record.evidenceIds.length) errors.push(`${moduleId}/${pageId}: aligned prototype revision has no evidence ids`);
      else {
        const evidencePath = path.join(versionDir(root, moduleId, pageId, current.released), 'evidence.json');
        if (fs.existsSync(evidencePath)) {
          const entries = readJson(evidencePath).entries || {};
          for (const evidenceId of record.evidenceIds) if (!entries[evidenceId]) errors.push(`${moduleId}/${pageId}: prototype revision references missing ${evidenceId}`);
        }
      }
    }
  }
}

function collectErrors(root) {
  const errors = [];
  let project;
  try { project = ensureProject(root); } catch { return ['project manifest unreadable']; }
  if (!ID_RE.test(project.id || '')) errors.push('project id invalid');
  if (project.schemaVersion !== 2) errors.push('project schemaVersion must be 2');
  if (project.repository) {
    const repo = repositoryRoot(root, project);
    if (!fs.existsSync(repo)) errors.push(`configured repository missing: ${repo}`);
    else if (!git(repo, ['rev-parse', '--is-inside-work-tree'], { required: false })) errors.push(`configured repository is not a Git worktree: ${repo}`);
  }
  if (!Array.isArray(project.modules)) errors.push('project modules must be an array');
  if (new Set(project.modules).size !== project.modules.length) errors.push('project modules contain duplicates');
  for (const moduleId of project.modules || []) {
    if (!ID_RE.test(moduleId)) { errors.push(`invalid module id: ${moduleId}`); continue; }
    if (!fs.existsSync(moduleFile(root, moduleId))) { errors.push(`module missing: ${moduleId}`); continue; }
    const mod = readJson(moduleFile(root, moduleId));
    if (mod.id !== moduleId) errors.push(`${moduleId}: module identity mismatch`);
    if (!Array.isArray(mod.pages)) { errors.push(`${moduleId}: pages must be an array`); continue; }
    if (new Set(mod.pages).size !== mod.pages.length) errors.push(`${moduleId}: pages contain duplicates`);
    for (const pageId of mod.pages) validatePage(root, moduleId, pageId, errors);
    if (mod.currentRelease) {
      const releasePath = path.join(moduleDir(root, moduleId), 'releases', `${mod.currentRelease}.json`);
      if (!fs.existsSync(releasePath)) errors.push(`${moduleId}: current release missing ${mod.currentRelease}`);
    }
  }
  return errors;
}

function cmdValidate(args, options) {
  const root = resolveRoot(options.root);
  const errors = collectErrors(root);
  if (errors.length) {
    errors.forEach((error) => console.error(`FAIL ${error}`));
    fail(`${errors.length} validation error(s)`);
  }
  console.log(`VALID ${root}`);
}

function cmdRelease(args, options) {
  const moduleId = args[0];
  assertId(moduleId, 'module id');
  const root = resolveRoot(options.root);
  const errors = collectErrors(root);
  if (errors.length) fail(`project validation failed before release:\n${errors.join('\n')}`);
  const mod = ensureModule(root, moduleId);
  const pages = {};
  for (const pageId of mod.pages) {
    const page = ensurePage(root, moduleId, pageId);
    const current = readJson(currentFile(root, moduleId, pageId));
    if (current.draft) fail(`${moduleId}/${pageId} has draft ${current.draft}`);
    if (!current.released) fail(`${moduleId}/${pageId} has no released spec`);
    if (page.prototype.status !== 'aligned' && !options['allow-docs-ahead']) fail(`${moduleId}/${pageId} is ${page.prototype.status}; align it or use --allow-docs-ahead`);
    const trace = readJson(path.join(versionDir(root, moduleId, pageId, current.released), 'trace.json'));
    pages[pageId] = {
      spec: current.released,
      prototypeRevision: page.prototype.revision,
      alignedToSpec: page.prototype.alignedToSpec,
      status: page.prototype.status,
      baselineCommit: trace.repository?.baselineCommit || null,
      implementationCommit: trace.repository?.implementationCommit || null,
      changeRequest: trace.changeRequest
    };
  }
  const releasesDir = path.join(moduleDir(root, moduleId), 'releases');
  const existing = fs.readdirSync(releasesDir).map((name) => new RegExp(`^${moduleId}-r(\\d+)\\.json$`).exec(name)).filter(Boolean).map((match) => Number(match[1]));
  const id = String(options.id || `${moduleId}-r${existing.length ? Math.max(...existing) + 1 : 1}`);
  if (!new RegExp(`^${moduleId}-r[1-9][0-9]*$`).test(id)) fail(`invalid release id: ${id}`);
  writeNew(path.join(releasesDir, `${id}.json`), `${JSON.stringify({ schemaVersion: 2, id, module: moduleId, createdAt: nowIso(), allowDocsAhead: !!options['allow-docs-ahead'], pages }, null, 2)}\n`);
  mod.currentRelease = id;
  writeAtomicJson(moduleFile(root, moduleId), mod);
  console.log(`Released module ${id} with ${Object.keys(pages).length} page(s)`);
}

function help() {
  console.log(`protoctl ${VERSION}\n\nCommands:\n  init [root] --name <name> [--id <id>] [--repo <path>|none]\n  add-module <module> --root <root> [--title <title>]\n  add-page <module> <page> --root <root> [--title <title>] [--baseline-commit <ref>]\n  change <module>/<page> --root <root> [--docs-only] [--source <source>] [--bump minor|major] [--id v1.1] [--baseline-commit <ref>]\n  publish <module>/<page> --root <root> [--id <version>]\n  link-commit <module>/<page> --root <root> --role baseline|implementation|mr-head|merge --commit <ref> [--version v1.1] [--mr-kind mr|pr] [--mr-id <id>] [--mr-url <url>]\n  align <module>/<page> --root <root> --evidence <ID[,ID]> [--note <note>]\n  context <module>/<page> --root <root> [--intent docs|html|history] [--json]\n  validate --root <root>\n  build [<module>/<page>|all] --root <root>\n  release <module> --root <root> [--id <id>] [--allow-docs-ahead]\n`);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const command = positional.shift();
  if (!command && options.version === true) { console.log(VERSION); return; }
  if (!command || command === 'help' || options.help) { help(); return; }
  if (command === 'version') { console.log(VERSION); return; }
  const commands = {
    init: cmdInit,
    'add-module': cmdAddModule,
    'add-page': cmdAddPage,
    change: cmdChange,
    publish: cmdPublish,
    'link-commit': cmdLinkCommit,
    align: cmdAlign,
    context: cmdContext,
    validate: cmdValidate,
    build: cmdBuild,
    release: cmdRelease
  };
  if (!commands[command]) fail(`unknown command: ${command}`);
  commands[command](positional, options);
}

main().catch((error) => {
  if (!process.exitCode) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
});
