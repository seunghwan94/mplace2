# mplace

실시간 픽셀 협업 캔버스 프로젝트

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

## 1. 개발 환경 준비

### 1.1 Node.js / npm 설치

```bash
# Ubuntu 예시: Node.js 18.x 버전 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

설치 후 버전 확인:

```bash
node -v    # v18.x.x
npm -v     # 8.x.x
```

### 1.2 MariaDB(MySQL) 설치

```bash
sudo apt update
sudo apt install -y mariadb-server
```

설치 후 MariaDB 서비스 자동 시작 확인:

```bash
sudo systemctl enable mariadb
sudo systemctl start mariadb
sudo systemctl status mariadb
```

---

## 2. 데이터베이스 및 사용자 초기화

### 2.1 `init.sql` 파일 내용 (`db/init.sql`)

```sql
-- --------------------------------------------------------
-- 1) 'test' 사용자 생성 및 권한 설정
-- --------------------------------------------------------
CREATE USER IF NOT EXISTS 'test'@'localhost' IDENTIFIED BY '123';
GRANT ALL PRIVILEGES ON mplace.* TO 'test'@'localhost';
FLUSH PRIVILEGES;

-- --------------------------------------------------------
-- 2) mplace 데이터베이스 생성
-- --------------------------------------------------------
CREATE DATABASE IF NOT EXISTS mplace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mplace;

-- --------------------------------------------------------
-- 3) pixel_state 테이블 생성
--    현재 캔버스(100×100) 각 좌표의 최신 색상을 저장
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS pixel_state (
  x INT NOT NULL,
  y INT NOT NULL,
  color VARCHAR(7) NOT NULL,
  PRIMARY KEY (x, y)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4) pixel_log 테이블 생성
--    클릭할 때마다 로그 기록 (순서대로 조회 가능)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS pixel_log (
  id INT NOT NULL AUTO_INCREMENT,
  x INT NOT NULL,
  y INT NOT NULL,
  color VARCHAR(7) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_created_at (created_at),
  INDEX idx_nickname (nickname)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
```

### 2.2 초기화 실행

1. MariaDB root 권한으로 접속:

   ```bash
   sudo mysql
   ```

2. 기존에 생성된 사용자와 데이터베이스를 삭제 (선택 단계):

   ```sql
   DROP USER IF EXISTS 'test'@'localhost';
   DROP DATABASE IF EXISTS mplace;
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. `init.sql` 실행:

   ```bash
   mysql -u root < ./db/init.sql
   ```

4. 정상 생성 확인:

   ```bash
   mysql -u test -p
   # Enter password: 123

   MariaDB [(none)]> SHOW DATABASES;
   +--------------------+
   | Database           |
   +--------------------+
   | information_schema |
   | mplace             |
   | mysql              |
   | performance_schema |
   | sys                |
   +--------------------+

   MariaDB [(none)]> USE mplace;
   Database changed

   MariaDB [mplace]> SHOW TABLES;
   +----------------+
   | Tables_in_mplace |
   +----------------+
   | pixel_log      |
   | pixel_state    |
   +----------------+
   ```

---

## 3. 애플리케이션 설치 및 실행

### 3.1 의존 패키지 설치

```bash
cd ~/myapp/mplace
npm install
```

### 3.2 `.env` 파일 생성 / 설정

프로젝트 루트에 `.env` 파일 생성·작성:

```
PORT=8081
DB_HOST=localhost
DB_PORT=3306
DB_USER=test
DB_PASSWORD=123
DB_NAME=mplace
```

**주의**: `.env` 파일은 민감 정보를 담으므로 Git에 커밋하지 않도록 `.gitignore`에 추가하세요.

### 3.3 PM2를 통한 프로세스 관리

1. PM2 글로벌 설치 (설치되어 있지 않다면):

   ```bash
   sudo npm install -g pm2
   ```

2. 애플리케이션 실행:

   ```bash
   pm2 start server.js --name mplace
   ```

3. PM2 프로세스 목록 저장:

   ```bash
   pm2 save
   ```

4. 서버 재부팅 시 PM2가 자동으로 실행되도록 시스템 서비스 등록:

   ```bash
   pm2 startup systemd
   ```

   위 명령 후 출력된 “sudo env PATH=… pm2 startup systemd -u ubuntu --hp /home/ubuntu” 명령을 복사하여 실행하세요.

---

## 4. 도메인 연결 & Nginx 리버스 프록시 설정

### 4.1 Cloudflare DNS 설정

1. Cloudflare DNS 탭에 접속
2. 다음 레코드 추가:
   - **A 레코드**
     - Name: `mplace.site`
     - IPv4 address: (EC2 인스턴스 퍼블릭 IP, 예: `3.36.70.222`)
     - Proxy Status: Proxied (🟢)
   - **CNAME 레코드**
     - Name: `www`
     - Target: `mplace.site`
     - Proxy Status: Proxied (🟢)

### 4.2 Nginx 리버스 프록시 설정

1. Nginx 설정 디렉터리로 이동:

   ```bash
   cd /etc/nginx/sites-available
   ```

2. `mplace` 파일 생성:

   ```bash
   sudo vi /etc/nginx/sites-available/mplace
   ```

3. 아래 내용 붙여넣기:

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

4. 심볼릭 링크 생성:

   ```bash
   sudo ln -s /etc/nginx/sites-available/mplace /etc/nginx/sites-enabled/mplace
   ```

5. Nginx 문법 테스트 및 재시작:

   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 5. (선택) HTTPS/SSL 적용

1. Certbot 설치:

   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. Certbot 실행:

   ```bash
   sudo certbot --nginx -d mplace.site -d www.mplace.site
   ```

3. Cloudflare SSL/TLS 모드를 **Full (Strict)**로 설정

---

## 6. 전체 실행 순서 요약

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

# 4. Cloudflare DNS 설정
# (A 레코드, CNAME 레코드 추가)

# 5. Nginx 리버스 프록시 설정
cd /etc/nginx/sites-available
sudo vi mplace
# (리버스 프록시 설정 붙여넣기)
sudo ln -s /etc/nginx/sites-available/mplace /etc/nginx/sites-enabled/mplace
sudo nginx -t
sudo systemctl restart nginx

# 6. (선택) HTTPS/SSL 설정
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d mplace.site -d www.mplace.site

# 7. 최종 검증
# 브라우저에서 https://mplace.site 접속, PM2/NGINX 상태 확인
```
