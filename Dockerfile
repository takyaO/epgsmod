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

# 起動
CMD ["node", "server.js"]
