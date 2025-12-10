# EPGSmod
![epgsmod.png](./epgsmod.png)
**テレビ録画管理サーバー EPGStation** の使い勝手を支援するツールです。ジャンルごとに、放送される番組のリストを一括取得し、選択した番組の「番組名」を抽出して、これをキーワードとして録画ルールに追加します。スマホ利用を想定して、文字入力の手間を極力避ける

## 動作要件

**EPGStation v2** 
https://github.com/l3tnun/EPGStation   
  
## インストール

sudo docker run -d --network host --name epgsmod --restart unless-stopped ghcr.io/takyao/epgsmod:latest

ブラウザで3001ポートにアクセス。http://localhost:3001

EPGStationの URL:port を入力する。

![screenshot](./Screenshot_20251210-204708.png)



