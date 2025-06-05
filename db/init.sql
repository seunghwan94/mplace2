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
