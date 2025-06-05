# mplace

실시간 픽셀 캔버스 프로젝트

---

## 프로젝트 구조

```
mplace/
├─ public/
│   ├─ index.html
│   ├─ client.js
│   ├─ asset/
│   └─ admin/
│       ├─ admin.html
│       └─ admin.js
├─ db/
│   ├─ init.sql
│   └─ db.js
├─ server.js
├─ .env
└─ package.json
```

- **public/**  
  - 정적 파일(클라이언트 사이드) 디렉터리  
  - `index.html`, `client.js`: 메인 Canvas 페이지  
  - `asset/`: CSS, 이미지 등 에셋 저장  
  - `admin/`  
    - `admin.html`, `admin.js`: 관리자 대시보드 (타임랩스 및 실시간 로그 확인)  

- **db/**  
  - `init.sql`: 데이터베이스(사용자·스키마·테이블) 초기화 스크립트  
  - `db.js`: Node.js에서 DB 연결(pool) 및 쿼리 함수 정의  

- **server.js**  
  - Express + Socket.IO 기반 서버 진입점(REST API + WebSocket)  

- **.env**  
  ```
  PORT=8081
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=test
  DB_PASSWORD=123
  DB_NAME=mplace
  ```

- **package.json**  
  - 의존 패키지 정보 및 실행 스크립트 정의  

---

## 전체 실행 순서 (요약)

```bash
# 1. 의존 패키지 설치
sudo apt update
sudo apt install -y nodejs npm mariadb-server nginx
sudo npm install -g pm2

# 2. 데이터베이스 초기화
mysql -u root < ./db/init.sql

# 3. 애플리케이션 설치 및 실행
cd ~/myapp/mplace
npm install
pm2 start server.js --name mplace
pm2 save
pm2 startup systemd
# (출력된 명령어를 복사하여 실행)
# ex) sudo env PATH=… pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 4. Cloudflare DNS 설정
# (A 레코드, CNAME 레코드 추가)

# 5. Nginx 리버스 프록시 설정
cd /etc/nginx/sites-available
sudo vi mplace
# (리버스 프록시 설정 붙여넣기 밑에 있음)
sudo ln -s /etc/nginx/sites-available/mplace /etc/nginx/sites-enabled/mplace
sudo nginx -t
sudo systemctl restart nginx

# 6. (선택) HTTPS/SSL 설정
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d mplace.site -d www.mplace.site

# 7. 최종 검증
# 브라우저에서 https://mplace.site 접속, PM2/NGINX 상태 확인
```

```nginx
 # /etc/nginx/sites-available/mplace

 server {
     listen 80;
     listen [::]:80;
     server_name mplace.site www.mplace.site;

     client_max_body_size 10m;

     location / {
         proxy_pass http://127.0.0.1:8081;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";

         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;

         proxy_cache_bypass $http_upgrade;
     }
 }
 ```
