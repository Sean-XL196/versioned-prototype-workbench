import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/protoctl.mjs');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'vpw-test-'));
const repo = path.join(sandbox, 'repo');
const project = path.join(repo, 'prototypes');

function spawn(command, args, cwd = repo, expected = 0) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, expected, `command failed: ${command} ${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function run(args, expected = 0) {
  return spawn(process.execPath, [cli, ...args], repo, expected);
}

function git(args, expected = 0) {
  return spawn('git', args, repo, expected).stdout.trim();
}

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function write(file, body) {
  fs.writeFileSync(file, body, 'utf8');
}

function completeEvidence(file) {
  const evidence = json(file);
  for (const [id, entry] of Object.entries(evidence.entries)) {
    if (entry.summary.includes('TODO(VPW)')) entry.summary = `${id} verified behavior`;
    if (entry.kind === 'as-is' && !entry.path) entry.path = 'src/orders-page.js';
  }
  write(file, `${JSON.stringify(evidence, null, 2)}\n`);
}

function commit(message) {
  git(['add', '.']);
  git(['commit', '-m', message]);
  return git(['rev-parse', 'HEAD']);
}

try {
  fs.mkdirSync(repo, { recursive: true });
  git(['init']);
  git(['config', 'user.email', 'vpw@example.test']);
  git(['config', 'user.name', 'VPW Test']);
  git(['remote', 'add', 'origin', 'git@github.com:example/vpw-test.git']);
  write(path.join(repo, 'README.md'), '# Test repository\n');
  const seedCommit = commit('chore: seed repository');

  run(['init', project, '--name', 'Demo Project', '--id', 'demo-project', '--repo', repo]);
  run(['add-module', 'sales', '--root', project, '--title', 'Sales']);
  run(['add-page', 'sales', 'orders', '--root', project, '--title', 'Orders']);
  run(['add-page', 'sales', 'returns', '--root', project, '--title', 'Returns']);

  for (const pageId of ['orders', 'returns']) {
    const pageRoot = path.join(project, 'modules', 'sales', 'pages', pageId);
    const current = json(path.join(pageRoot, 'current.json'));
    assert.equal(current.draft, 'v1.0');
    const versionRoot = path.join(pageRoot, 'versions', current.draft);
    write(path.join(pageRoot, 'context.md'), `# ${pageId} context\n\nObjective: Review ${pageId}.\nHard constraints: One page only.\nDecisions: Baseline accepted.\nDependencies: None.\nImplementation anchors: prototype/.\nVerification: build and browser.\nCurrent blocker: None.\nNext step: publish.\n`);
    write(path.join(versionRoot, 'snapshot-dev.md'), `# ${pageId} development spec\n\n> Complete effective specification. Version: v1.0\n\n## Requirements\n- REQ-001: Show records.\n- INT-001: Run the action.\n- RULE-001: Block invalid records.\n\n## Acceptance\n- TST-001 and TST-002 pass.\n`);
    write(path.join(versionRoot, 'snapshot-test.md'), `# ${pageId} test spec\n\n> Complete effective test specification. Version: v1.0\n\n- TST-001: Records render for REQ-001 and INT-001.\n- TST-002: Invalid record is blocked by RULE-001.\n`);
    completeEvidence(path.join(versionRoot, 'evidence.json'));
    run(['publish', `sales/${pageId}`, '--root', project]);
    assert.equal(json(path.join(versionRoot, 'trace.json')).repository.baselineCommit, seedCommit);
  }

  const baselineImplementation = commit('feat: add baseline prototypes and specifications');
  for (const pageId of ['orders', 'returns']) {
    run(['link-commit', `sales/${pageId}`, '--root', project, '--role', 'implementation', '--commit', baselineImplementation]);
    run(['align', `sales/${pageId}`, '--root', project, '--evidence', 'REQ-001,INT-001,RULE-001', '--note', 'Initial browser behavior verified']);
  }

  run(['validate', '--root', project]);
  run(['build', 'all', '--root', project]);
  assert.ok(fs.existsSync(path.join(project, 'dist', 'sales', 'orders.html')));
  assert.ok(fs.readFileSync(path.join(project, 'dist', 'sales', 'orders.html'), 'utf8').includes('window.PAGE_FIXTURES'));
  assert.ok(fs.readFileSync(path.join(project, 'dist', 'index.html'), 'utf8').includes('追溯矩阵'));
  run(['align', 'sales/orders', '--root', project, '--evidence', 'REQ-001'], 1);

  const ordersRoot = path.join(project, 'modules', 'sales', 'pages', 'orders');
  const beforePrototype = fs.readFileSync(path.join(ordersRoot, 'prototype', 'index.html'), 'utf8');
  run(['change', 'sales/orders', '--root', project, '--docs-only', '--source', 'Customer review']);
  const draft = json(path.join(ordersRoot, 'current.json')).draft;
  assert.equal(draft, 'v1.1');
  const draftRoot = path.join(ordersRoot, 'versions', draft);
  write(path.join(draftRoot, 'change-dev.md'), '# Orders change v1.1\n\nSource SRC-002 records the review. CHG-001 changes current behavior in ASIS-001 and introduces REQ-002.\n');
  write(path.join(draftRoot, 'change-test.md'), '# Orders test change v1.1\n\nTST-003 verifies REQ-002 and CHG-001. Parent regression remains green.\n');
  write(path.join(draftRoot, 'snapshot-dev.md'), '# Orders development spec\n\n> Complete effective specification. Version: v1.1\n\n- REQ-001: Show records.\n- REQ-002: Show priority.\n- INT-001: Run the action.\n- RULE-001: Block invalid records.\n');
  write(path.join(draftRoot, 'snapshot-test.md'), '# Orders test spec\n\n> Complete effective test specification. Version: v1.1\n\n- TST-001: Records render.\n- TST-002: Invalid record is blocked.\n- TST-003: Priority is visible for REQ-002.\n');
  completeEvidence(path.join(draftRoot, 'evidence.json'));
  run(['publish', 'sales/orders', '--root', project]);
  assert.equal(json(path.join(ordersRoot, 'page.json')).prototype.status, 'docs-ahead');
  assert.equal(fs.readFileSync(path.join(ordersRoot, 'prototype', 'index.html'), 'utf8'), beforePrototype);
  assert.match(fs.readFileSync(path.join(draftRoot, 'snapshot-dev.md'), 'utf8'), /(?:Version: |版本：)v1\.1/);

  const docsContext = JSON.parse(run(['context', 'sales/orders', '--root', project, '--intent', 'docs', '--json']).stdout);
  const historyContext = JSON.parse(run(['context', 'sales/orders', '--root', project, '--intent', 'history', '--json']).stdout);
  assert.ok(docsContext.files.length < historyContext.files.length);
  assert.ok(docsContext.files.some((file) => file.endsWith('evidence.json')));
  assert.ok(docsContext.files.some((file) => file.endsWith('trace.json')));

  run(['release', 'sales', '--root', project], 1);
  run(['release', 'sales', '--root', project, '--allow-docs-ahead']);
  fs.appendFileSync(path.join(ordersRoot, 'prototype', 'page.css'), '\n.priority { color: var(--vpw-color-info); }\n');
  const implementationCommit = commit('feat: show order priority');
  run(['link-commit', 'sales/orders', '--root', project, '--role', 'implementation', '--commit', implementationCommit]);
  run(['link-commit', 'sales/orders', '--root', project, '--role', 'mr-head', '--commit', implementationCommit, '--mr-kind', 'mr', '--mr-id', '123', '--mr-url', 'https://git.example.test/mr/123']);
  run(['align', 'sales/orders', '--root', project, '--evidence', 'CHG-001,REQ-002', '--note', 'Priority interaction verified']);
  const trace = json(path.join(draftRoot, 'trace.json'));
  assert.equal(trace.repository.implementationCommit, implementationCommit);
  assert.equal(trace.changeRequest.id, '123');
  run(['release', 'sales', '--root', project]);
  run(['build', 'all', '--root', project]);
  const workbench = fs.readFileSync(path.join(project, 'dist', 'index.html'), 'utf8');
  assert.match(workbench, /class="wb-version-select"/);
  assert.match(workbench, /data-version="v1\.0"/);
  assert.match(workbench, /data-version="v1\.1"/);
  assert.match(workbench, /Show priority/);
  assert.ok(workbench.includes(`https://github.com/example/vpw-test/compare/${baselineImplementation}...${implementationCommit}`));
  assert.ok(workbench.includes('https://git.example.test/mr/123'));

  const sharedCss = path.join(project, 'shared', 'shell.css');
  const originalSharedCss = fs.readFileSync(sharedCss, 'utf8');
  fs.appendFileSync(sharedCss, '\n.untracked-change{}\n');
  run(['validate', '--root', project], 1);
  write(sharedCss, originalSharedCss);
  run(['validate', '--root', project]);

  const releasedSnapshot = path.join(draftRoot, 'snapshot-dev.md');
  fs.appendFileSync(releasedSnapshot, '\nunauthorized rewrite\n');
  run(['validate', '--root', project], 1);
  run(['change', 'sales/returns', '--root', project, '--id', '2026-09-15.1'], 1);

  console.log(`PASS protoctl v2 end-to-end (${project})`);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
