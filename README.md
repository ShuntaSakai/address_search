# 郵便番号・住所検索ツール

郵便番号と住所を相互に検索できる、シンプルな静的 Web アプリです。

IT に詳しくない人でも迷わず使えることを優先し、1 画面・小さめ・説明を増やしすぎない構成で作っています。PC では邪魔になりにくいコンパクト表示、スマートフォンでは余白を確保しつつ見やすい表示を意識しています。

## 特徴

- HTML / CSS / JavaScript のみで構成
- フレームワークなし
- ビルド不要
- `index.html` をブラウザで開くだけで使える
- 郵便番号から住所を検索可能
- 住所から郵便番号を検索可能
- 検索結果のコピー機能つき
- 静的ホスティングに載せやすい構成

## ファイル構成

```text
address_search/
├── index.html
├── style.css
├── main.js
└── README.md
```

## 使い方

1. `index.html` をブラウザで開く
2. 検索モードを選ぶ
   - `郵便番号から探す`
   - `住所から探す`
3. 入力欄に文字を入れて `検索` を押す
4. 結果を確認する
5. 必要ならコピー ボタンで結果をコピーする

Enter キーでも検索できます。

## 検索モード

### 1. 郵便番号から探す

- 7 桁の郵便番号を入力して住所を検索します
- `1000001` と `100-0001` の両方に対応します
- 全角数字は半角数字に変換して扱います
- 検索結果では `100-0001` の形式で表示します

### 2. 住所から探す

- 住所の一部または全部を入力して郵便番号候補を検索します
- 複数件ヒットした場合は一覧表示します
- 各候補について郵便番号と住所を表示します

## 入力補助

### 郵便番号入力時

- 前後の空白を削除
- 全角数字を半角数字へ変換
- ハイフンあり / なしを吸収
- 内部的には数字 7 桁で扱う
- 表示時は `3桁-4桁` に整形

### 住所入力時

- 前後の空白を削除
- 全角スペースを通常スペースに変換
- 連続スペースを 1 つに整形

## バリデーション

### 郵便番号モード

- 未入力: `郵便番号を入力してください`
- 7 桁でない: `郵便番号は7桁で入力してください`

### 住所モード

- 未入力: `住所を入力してください`

## 結果表示

### 郵便番号検索結果

以下を表示します。

- 見出し: `検索結果`
- 郵便番号
- 住所

### 住所検索結果

候補を複数件表示します。各項目に以下を表示します。

- 郵便番号
- 住所
- コピー操作ボタン

## コピー機能

検索結果から以下をコピーできます。

- 郵便番号をコピー
- 住所をコピー
- 両方をコピー

コピー成功時は `コピーしました`、失敗時は `コピーに失敗しました` を表示します。

## クリア機能

`クリア` ボタンで以下をまとめて初期化します。

- 入力欄
- 結果表示
- エラーメッセージ
- コピー通知

## デザイン方針

- 白ベースのシンプルな UI
- 幅は最大 420px 前後のコンパクト表示
- PC では中央寄せの小さめツール
- モバイルでは横幅に追従しつつ余白を確保
- 装飾は控えめ、結果は読みやすく表示

## アクセシビリティ対応

- `label` を使用して入力欄と関連付け
- ボタンはすべて `button` 要素を使用
- Enter キーで検索可能
- `aria-live` によるメッセージ通知
- フォーカス時の視認性を確保
- 低コントラストになりすぎない配色

## 使用技術

- HTML
- CSS
- JavaScript
- 外部 API: HeartRails Geo API

## API について

このアプリは外部 API を利用して検索しています。

- 郵便番号検索: `searchByPostal`
- 住所検索: `suggest`

ブラウザでそのまま開ける構成を優先し、`fetch` ではなく JSONP 形式で呼び出しています。

### API 設定箇所

`main.js` の `API_CONFIG` に API 関連の設定をまとめています。

```js
const API_CONFIG = {
  baseUrl: 'https://geoapi.heartrails.com/api/json',
  methods: {
    postalSearch: 'searchByPostal',
    addressSearch: 'suggest',
  },
  addressMatching: 'like',
  timeoutMs: 10000,
};
```

### API 差し替え箇所

将来的に API を変更する場合は、主に以下の関数を差し替えます。

- `fetchAddressByPostalCode(postalCode)`
- `fetchPostalCodesByAddress(address)`
- `formatPostalApiItem(item)`
- `formatAddressApiItem(item)`
- 必要に応じて `API_CONFIG`

UI 側は表示用の整形済みデータを前提としているため、API を変更しても画面側への影響を小さくしやすい構成です。

## 主な関数

`main.js` には責務ごとに関数を分けています。

### 入力整形

- `normalizePostalCode(input)`
- `formatPostalCode(postalCode)`
- `normalizeText(input)`

### バリデーション

- `validatePostalCode(postalCode)`
- `validateAddress(address)`

### API 呼び出し

- `fetchAddressByPostalCode(postalCode)`
- `fetchPostalCodesByAddress(address)`
- `requestJsonp(params)`

### レスポンス整形

- `formatPostalApiItem(item)`
- `formatAddressApiItem(item)`
- `buildAddressText(prefecture, city, town)`

### 表示更新

- `renderPostalResult(data)`
- `renderAddressResults(list)`
- `renderStatus(message, type)`
- `renderError(message)`
- `clearResult()`

### コピー処理

- `copyText(text)`
- `showCopyFeedback(message)`

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

## ローカル起動方法

ビルドは不要です。

### 方法

- `index.html` をブラウザで開く

## 注意事項

- このアプリは外部 API に接続できる環境で使う前提です
- オフラインでは検索できません
- 利用 API の仕様変更や停止の影響を受ける可能性があります
- 一部ブラウザではコピー機能の挙動が異なることがあります

## データ出典

出典: 「位置参照情報ダウンロードサービス」（国土交通省）を加工して作成

## 今後の拡張候補

- 検索履歴の保存
- よく使う住所のお気に入り登録
- コピー UI の簡略化切り替え
- API 変更に備えたアダプター層の追加
- 該当件数の表示
- 完全一致 / 部分一致の切り替え
- 住所のふりがな表示
