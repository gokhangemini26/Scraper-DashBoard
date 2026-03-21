# Playwright v1.58.2 ile uyumlu Docker imajı
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Çalışma dizini
WORKDIR /app

# Paket dosyalarını kopyala
COPY package.json tsconfig.json ./

# Bağımlılıkları yükle
RUN npm install

# Kaynak kodları kopyala
COPY src ./src

# TypeScript'i derle
RUN npm run build

# Portu dışarı aktar
EXPOSE 3001

# Uygulamayı başlat
CMD ["npm", "start"]
