FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# 依存ファイルだけ先にコピー（キャッシュ効く）
COPY package*.json ./

# 必要ライブラリをインストール
RUN npm install --production

# アプリ本体をコピー
COPY . .

# Express が 3001 で listen すると仮定
EXPOSE 3001

# 1. ビルド時に外部から渡される日付変数を定義
ARG BUILD_DATE
# 2. その変数を実行時環境変数としてコンテナ内に埋め込む
ENV IMAGE_BUILT_AT=$BUILD_DATE

# 起動
CMD ["node", "server.js"]

