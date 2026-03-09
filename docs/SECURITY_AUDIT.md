# セキュリティ監査レポート

**対象**: X Post Search v0.1.0  
**監査日**: 2026年3月  
**監査範囲**: 認証情報の取り扱い、Electron セキュリティ、外部通信、入力検証

---

## 1. 認証情報の保存

### 現状

- **Bearer Token**: `localStorage` に平文で保存
- **OAuth 認証情報** (apiKey, apiSecret, accessToken, accessTokenSecret): `localStorage` に JSON で平文保存

### リスク

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| ローカルストレージの漏洩 | 高 | マルウェアや物理アクセスで読み取り可能 |
| XSS による窃取 | 中 | 現状 XSS 脆弱性は未検出だが、将来の拡張でリスク |

### 推奨対策

1. **Electron の safeStorage** の利用を検討（macOS Keychain / Windows Credential Vault）
2. 最低限、設定画面の入力フィールドを `type="password"` のまま維持（現状 ✅）
3. 設定クリア機能で確実に削除できることを明示（現状 ✅）

### 評価: ⚠️ 要改善

---

## 2. Electron セキュリティ設定

### 現状

| 項目 | 設定 | 評価 |
|------|------|------|
| contextIsolation | true | ✅ 適切 |
| nodeIntegration | false | ✅ 適切 |
| preload スクリプト | 必要最小限の API のみ公開 | ✅ 適切 |
| webSecurity | デフォルト（有効） | ✅ 適切 |

### preload.js の公開 API

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  saveCSV: (data) => ipcRenderer.invoke('save-csv', data),
  xApiRequest: (data) => ipcRenderer.invoke('x-api-request', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
```

- 最小権限の原則に従っている
- 任意の URL を openExternal に渡せる点は、リンク先が固定であれば問題なし（現状は固定 URL のみ）

### 評価: ✅ 良好

---

## 3. メインプロセス（main.js）

### 現状

- **IPC ハンドラ**: `x-api-request`, `save-csv`, `open-external` の3つのみ
- **x-api-request**: 渡された URL に fetch でリクエスト。URL の検証なし
- **save-csv**: ユーザーが選択したパスに書き込み。`dialog.showSaveDialog` でパスを取得
- **open-external**: `shell.openExternal(url)` で外部ブラウザを開く

### リスク

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| オープンリダイレクト | 低 | open-external に任意 URL を渡せるが、レンダラー側で固定リンクのみ使用 |
| プロトコルインジェクション | 低 | URL が api.twitter.com 以外にも送信可能。現状はレンダラーが X API の URL のみ生成 |

### 推奨対策

- `x-api-request` で許可する URL を `api.twitter.com` に制限するホワイトリスト検証を追加
- `open-external` で許可する URL をホワイトリスト化（forms.gle, developer.twitter.com 等）

### 評価: ⚠️ 軽微な改善余地あり

---

## 4. 入力検証

### 現状

| 入力 | 検証 | 評価 |
|------|------|------|
| アカウント名 | `replace('@', '')` のみ。特殊文字のサニタイズなし | △ |
| 日付 | HTML5 date input。YYYY-MM-DD 形式 | ✅ |
| キーワード | 未検証。そのまま API クエリに含める | △ |
| 最大取得件数 | 100/500/1000 のラジオ選択。固定値 | ✅ |

### リスク

- X API のクエリインジェクション: `from:${username}` に特殊文字が含まれると意図しない検索になる可能性。X API の仕様上、username は英数字とアンダースコアに限定される想定。
- キーワード: ユーザー入力がそのままクエリに入る。悪意ある入力で API エラーや予期しない結果の可能性は低いが、長大な入力は API 制限に抵触する可能性。

### 推奨対策

- アカウント名: 英数字・アンダースコアのみ許可する正規表現バリデーション
- キーワード: 長さ制限（例: 200文字）

### 評価: △ 改善推奨

---

## 5. 外部通信

### 現状

- 通信先: `api.twitter.com` のみ（X API）
- 認証: Bearer Token または OAuth 1.0a
- HTTPS 使用（fetch のデフォルト）

### 評価: ✅ 適切

---

## 6. 依存関係

### 現状

- `npm audit` で 0 vulnerabilities を確認（2026年3月時点）
- 主要依存: Next.js, React, Electron, crypto-js, oauth-1.0a

### 評価: ✅ 現状問題なし

---

## 総合評価と優先度付き推奨事項

| 優先度 | 項目 | 対応 |
|--------|------|------|
| 高 | 認証情報の平文保存 | safeStorage または暗号化の検討 |
| 中 | URL ホワイトリスト | main.js の x-api-request, open-external に検証追加 |
| 低 | 入力検証の強化 | アカウント名・キーワードのバリデーション追加 |
