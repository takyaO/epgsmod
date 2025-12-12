# EPGSmod
<img src="./epgsmod.png" alt="epgsmod.png" width="200">

テレビ録画管理サーバー EPGStation の「録画予約」機能の使い勝手をよくする支援ツール。

スマホ利用を想定して、シンプルな操作で、番組名キーワード予約。


## 動作要件

**EPGStation v2** 
https://github.com/l3tnun/EPGStation   
  
## インストール

sudo docker run -d --network host --name epgsmod --restart unless-stopped ghcr.io/takyao/epgsmod:latest

## 使用法

ブラウザで3001ポートにアクセス。http://localhost:3001

EPGStationの URL:port を入力する。

## 機能

番組改編期に、新番組（シリーズ）の録画予約に使える。

選択した「番組名」にて、ワンクリックでネット検索できる。

予約の競合を、ワンクリックで解消できる。

有効なルールを確認し削除できる。

## 解説

[テレビ録画メディアサーバー構築入門（第２６回）](https://note.com/leal_walrus5520/n/ncaf1feb3808c)






