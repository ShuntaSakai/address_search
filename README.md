# 郵便番号・住所検索ツール

郵便番号と住所を相互に検索できる、シンプルな Web アプリです。

家族、とくに IT に詳しくない人でも迷わず使えることを優先し、1 画面・小さめ・説明を増やしすぎない構成にしています。PC では邪魔になりにくいコンパクト表示、スマートフォンでは余白を確保しつつ見やすい表示を意識しています。

## 概要

- フロントエンドは HTML / CSS / JavaScript のみ
- 検索 API は Netlify Functions 経由で呼び出し
- ブラウザから第三者 API を直接呼ばない構成
- JSONP は使用しない
- 公開時は Netlify にそのまま載せられる

## この構成にした理由

以前の実装では JSONP で外部 API を呼んでいましたが、JSONP は外部サイトの JavaScript を自サイト上で実行する構成になるため、静的公開サイトとしては避けたい方式です。

この版では以下の形に変更しています。

- ブラウザは自サイトの `/api/*` だけを呼ぶ
- Netlify Functions が外部 API を取得する
- 外部 API のレスポンスは Function 側で検証・整形する
- ブラウザには整形済み JSON だけを返す

これにより、ブラウザ側で外部スクリプトを実行するリスクを避けています。

## ファイル構成

```text
address_search/
├── index.html
├── style.css
├── main.js
├── netlify.toml
├── netlify/
│   └── functions/
│       ├── _shared.js
│       ├── postal-search.js
│       └── address-search.js
└── README.md
```

## 主な機能

- 郵便番号から住所を検索
- 住所から郵便番号を検索
- 検索結果のコピー
- エラーメッセージ表示
- クリア機能
- モバイル / PC 両対応

## 検索モード

### 1. 郵便番号から探す

- 7 桁の郵便番号を受け付けます
- `1000001` と `100-0001` の両方に対応します
- 全角数字を半角に変換します
- 検索結果は `100-0001` 形式で表示します

### 2. 住所から探す

- 住所の一部または全部で検索できます
- 複数件ヒットした場合は一覧で表示します
- 各候補ごとにコピーできます

## 入力補助

### 郵便番号

- 前後空白の除去
- 全角数字の半角化
- ハイフン有無の吸収
- 表示時の `3桁-4桁` 整形

### 住所

- 前後空白の除去
- 全角スペースの通常スペース化
- 連続空白の整形

## バリデーション

### 郵便番号モード

- 未入力: `郵便番号を入力してください`
- 7 桁でない: `郵便番号は7桁で入力してください`

### 住所モード

- 未入力: `住所を入力してください`

## 結果表示

### 郵便番号検索

- 見出し: `検索結果`
- 郵便番号
- 住所
- 住所のふりがな

### 住所検索

- 郵便番号
- 住所
- 住所のふりがな
- コピー操作ボタン

## コピー機能

検索結果から以下をコピーできます。

- 郵便番号をコピー
- 住所をコピー
- 両方をコピー

コピー成功時は `コピーしました`、失敗時は `コピーに失敗しました` を表示します。

## ふりがな表示

- `city-kana` と `town-kana` は HeartRails Geo API のレスポンスを利用します
- `prefecture-kana` は API に含まれないため、Function 側で 47 都道府県の固定マップから補完します
- 画面には `addressKana` として連結済みのふりがなを表示します

## 使用技術

- HTML
- CSS
- JavaScript
- Netlify Functions
- HeartRails Geo API

## リクエストの流れ

1. ブラウザで検索実行
2. `main.js` が `/api/postal-search` または `/api/address-search` を呼ぶ
3. `netlify.toml` のリダイレクトで Netlify Function に転送
4. Function が HeartRails Geo API へサーバー側からアクセス
5. Function がレスポンスを検証・整形して JSON を返す
6. フロントエンドが結果を表示

## API エンドポイント

ブラウザ側が呼ぶパス:

- `/api/postal-search?postalCode=***`
- `/api/address-search?address=***`

Netlify 上では以下の Functions に転送されます。

- `netlify/functions/postal-search.js`
- `netlify/functions/address-search.js`

## 役割分担

### フロントエンド

- `main.js`
- 入力整形
- バリデーション
- Function 呼び出し
- 結果描画
- コピー処理

### サーバー側

- `netlify/functions/_shared.js`
- 外部 API 呼び出し
- 入力の再検証
- レスポンス検証
- 表示用データへの整形

## 主な関数

### フロント側

- `normalizePostalCode(input)`
- `formatPostalCode(postalCode)`
- `normalizeText(input)`
- `validatePostalCode(postalCode)`
- `fetchAddressByPostalCode(postalCode)`
- `fetchPostalCodesByAddress(address)`
- `renderPostalResult(data)`
- `renderAddressResults(list)`
- `renderError(message)`
- `clearResult()`
- `copyText(text)`

### Function 側

- `fetchUpstream(params)`
- `extractLocations(response)`
- `formatLocation(item)`
- `deduplicateResults(results)`
- `createJsonResponse(statusCode, payload)`

## セキュリティ方針

### 対応済み

- JSONP 廃止
- ブラウザから第三者 API を直接呼ばない
- 同一オリジンの `/api/*` のみ利用
- `netlify.toml` でセキュリティヘッダーを設定
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`

### 残る前提

- Function からの外部 API 利用は継続するため、上流 API の停止や仕様変更の影響は受けます
- 高い可用性が必要なら、将来的には独自データソースやキャッシュ層も検討できます

## エラー表示

以下の状況で短くわかりやすいメッセージを表示します。

- 入力不足
- 郵便番号形式不正
- 検索結果なし
- 通信失敗
- API 応答異常

表示例:

- `郵便番号を入力してください`
- `郵便番号は7桁で入力してください`
- `住所を入力してください`
- `見つかりませんでした`
- `通信に失敗しました`
- `データを取得できませんでした`

## ローカルでの確認方法

この版は Netlify Functions 前提なので、単に `index.html` を `file://` で開くだけでは検索 API は動きません。

### 方法 1: Netlify にデプロイして確認

最も簡単です。

1. Netlify にサイトを作成
2. このディレクトリをデプロイ
3. 発行された URL で動作確認

### 方法 2: Netlify Dev で確認

Netlify CLI を使う方法です。

```bash
netlify dev
```

起動後、表示されたローカル URL をブラウザで開いて確認します。

## 公開方法

Netlify にそのまま載せられます。

### 例

1. GitHub に push
2. Netlify でリポジトリを連携
3. デプロイ
4. 発行された URL をメールや LINE で共有

## API 差し替え箇所

将来的に外部 API を差し替える場合は、主に以下を変更します。

- `netlify/functions/_shared.js`
- `netlify/functions/postal-search.js`
- `netlify/functions/address-search.js`

フロント側は `/api/postal-search` と `/api/address-search` の JSON 形式だけを見ているため、Function 側で吸収しやすい構成です。

## データ出典

出典: 「位置参照情報ダウンロードサービス」（国土交通省）を加工して作成

## 今後の拡張候補

- Function 側のキャッシュ追加
- レート制限
- ログ記録
- 住所検索の完全一致 / 部分一致切り替え
- 独自データソースへの移行
- よく使う住所の保存
