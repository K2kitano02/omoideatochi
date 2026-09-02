# Issue 03 Jestテスト基盤 設計

## 目的

Expoアプリのコンポーネントと、今後追加するドメインロジックを継続的に検証できる最小のテスト基盤を用意する。

## 対象範囲

- Expo SDK 57に対応するJest環境
- React Native Testing Library
- 1回実行して終了する`npm test`
- 開発中に利用できる`npm test -- --watch`
- 初期画面の最小レンダリングテスト1件
- テスト失敗時の非0終了コード確認
- ローカル`AGENTS.md`へのテスト運用追記

## 対象外

- READMEへのテストコマンド追記
- 認証、位置判定、RLSなど未実装機能のテスト
- E2Eテスト
- スナップショットテスト
- カバレッジ下限
- GitHub Actions

## 採用構成

Jest設定は`package.json`へ置く。現在必要な設定は`jest-expo`プリセットだけであり、専用の`jest.config.js`を増やさない。

開発依存として次をExpo CLI経由で導入する。

- `jest`
- `jest-expo`
- `@types/jest`
- `@testing-library/react-native`

`react-test-renderer`はReact 19以降に対応しない非推奨構成のため導入しない。

## 設定

`package.json`へ次を追加する。

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

`tsconfig.json`の`compilerOptions.types`へ`jest`を追加し、テストコードで`describe`、`test`、`expect`の型を利用できるようにする。

## 最小レンダリングテスト

テストは`__tests__/App.test.tsx`へ置く。命名を`*.test.ts(x)`へ統一するリポジトリ規約に従う。

React Native Testing Libraryで`App`をレンダリングし、ユーザーに表示される「思い出跡地」という文字を取得できることを検証する。内部実装やスナップショットではなく、画面に現れる振る舞いを確認する。

## 実行方法

- `npm test`: 全テストを1回実行し、結果を返して終了する
- `npm test -- --watch`: ファイル変更を監視してテストを再実行する

CIでも同じ`npm test`をそのまま利用できるよう、標準スクリプトにはwatchオプションを付けない。

## 失敗時の確認

完了条件の「失敗時に非0の終了コードが返る」を確認するため、最小テストの期待文字列を一時的に存在しない文字列へ変更して`npm test`を実行する。Jestがテスト失敗を報告し、非0で終了することを確認した後、正しい期待値へ戻す。

一時的な失敗コードはコミットしない。最終状態では全テストを成功させる。

## ローカルAGENTS.md

Git管理外の`AGENTS.md`へ次の運用を追記する。

- `npm test`は全テストを1回実行して終了する
- 開発中の監視には`npm test -- --watch`を使う
- 実装後は、変更範囲に応じて`npm test`、`npm run lint`、`npm run format:check`、`npm run typecheck`を実行する

`AGENTS.md`は個人開発用のローカル指示として維持し、Git追跡対象へ変更しない。

## 検証

最終状態で次を実行する。

1. `npm test`
2. `npm run lint`
3. `npm run format:check`
4. `npm run typecheck`
5. `git diff --check`

UIの見た目や画面遷移は変更しないため、スクリーンショットと実機操作確認は対象外とする。

## 完了条件との対応

- `npm test`成功: 最小テストを含む全テストを1回実行して確認する
- 最小テストの実行: 実行結果で1 test passedを確認する
- 非0終了コード: 一時的な失敗期待値で確認する
- 命名統一: `__tests__/App.test.tsx`を採用する
