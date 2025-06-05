-- 1. 픽셀 현재 상태를 저장하는 테이블
CREATE TABLE IF NOT EXISTS pixel_state (
  x TINYINT UNSIGNED NOT NULL,             -- 0~99
  y TINYINT UNSIGNED NOT NULL,             -- 0~99
  color CHAR(7) NOT NULL,                  -- '#rrggbb'
  PRIMARY KEY (x, y)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 픽셀 변경 내역을 기록하는 로그 테이블 (타임랩스/통계용)
CREATE TABLE IF NOT EXISTS pixel_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  x TINYINT UNSIGNED NOT NULL,             -- 0~99
  y TINYINT UNSIGNED NOT NULL,             -- 0~99
  color CHAR(7) NOT NULL,                  -- '#rrggbb'
  nickname VARCHAR(20) NOT NULL,           -- 클릭한 사용자 닉네임
  ip VARCHAR(45) NOT NULL,                 -- IPv4/IPv6
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
