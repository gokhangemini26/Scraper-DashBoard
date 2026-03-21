# Resmi Playwright imajını kullanıyoruz. Bu imaj içinde Chrome/Chromium için gerekli tüm arka plan kütüphaneleri (OS libs) hazırdır.
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Çalışma dizini
WORKDIR /app

# Paket dosyalarını kopyala
COPY package.json tsconfig.json ./

# Bağımlılıkları yükle
RUN npm install

# Kaynak kodları kopyala
COPY src ./src
COPY .env.example ./.env

# TypeScript'i derle
RUN npm run build

# Portu dışarı aktar
EXPOSE 3001

# Uygulamayı başlat
CMD ["npm", "start"]
