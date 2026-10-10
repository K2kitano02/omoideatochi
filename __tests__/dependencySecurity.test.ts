/** @jest-environment node */
/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const lock = JSON.parse(
  readFileSync(resolve(root, 'package-lock.json'), 'utf8'),
) as { packages: Record<string, { version?: string }> };
const expansionPaths = Object.keys(lock.packages).filter((path) =>
  path.endsWith('/brace-expansion'),
);

describe('brace-expansionの依存更新の回帰', () => {
  it('検証対象の依存が存在する', () => {
    expect(expansionPaths.length).toBeGreaterThan(0);
  });

  // 実際にインストールされた全コピーを、Jestのモックなしで検証する。
  // 子プロセスの時間・出力制限により、旧版の再導入時もテストを巻き込まない。
  it.each(expansionPaths)(
    '%sで通常の展開と深い入れ子を安全に処理する',
    (path) => {
      const output = execFileSync(
        process.execPath,
        [
          '-e',
          `const assert = require('node:assert/strict');
         const library = require(process.argv[1]);
         const expand = typeof library === 'function' ? library : library.expand;
         assert.deepEqual(expand('photo-{1,2}.jpg'), ['photo-1.jpg', 'photo-2.jpg']);
         const input = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
         const result = expand(input);
         assert.ok(Array.isArray(result));
         assert.ok(result.length > 0 && result.length <= 2);
         assert.ok(result.every(value => typeof value === 'string' && value.length <= input.length));
         process.stdout.write('passed');`,
          resolve(root, path),
        ],
        { encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024 },
      );
      expect(output).toBe('passed');
    },
  );
});
