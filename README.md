# EPGSmod
<img src="./epgsmod.png" alt="epgsmod.png" width="200">

テレビ録画管理サーバー EPGStation の使い勝手を支援するツール。

1. ジャンルごとに、放送される番組のリストを一括取得し、
2. 選択した番組エピソードの「番組名」を抽出して、
3. 「番組名」をキーワードとして録画ルールに追加

スマホ利用を想定して、文字入力やマウス操作の手間を極力避けるための便利ツール。

## 動作要件

**EPGStation v2** 
https://github.com/l3tnun/EPGStation   
  
## インストール

sudo docker run -d --network host --name epgsmod --restart unless-stopped ghcr.io/takyao/epgsmod:latest

ブラウザで3001ポートにアクセス。http://localhost:3001

EPGStationの URL:port を入力する。

<img src="./Screenshot_20251210-204708.png" alt="screenshot" width="400">



