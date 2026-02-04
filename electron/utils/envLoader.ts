import fs from 'fs';
import path from 'path';

// 환경 변수 캐시 (싱글톤)
let envCache: Record<string, string> | null = null;

/**
 * .env 파일 로드 및 캐싱
 * 여러 경로에서 .env 파일을 찾아 파싱
 */
function loadEnvVars(): Record<string, string> {
  if (envCache) return envCache;

  envCache = {};

  // .env 파일 경로 후보
  const possiblePaths = [
    path.join(process.cwd(), 'env', '.env'),
    path.join(__dirname, '..', 'env', '.env'),
    path.join(__dirname, '..', '..', 'env', '.env'),
  ];

  // 패키징된 앱에서의 경로
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    possiblePaths.push(
      path.join(resourcesPath, 'app.asar', 'env', '.env'),
      path.join(resourcesPath, 'app', 'env', '.env')
    );
  }

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim();
              envCache[key] = value;
            }
          }
        }
        break; // 첫 번째 발견된 파일만 사용
      } catch {
        // 파일 읽기 실패시 다음 경로 시도
      }
    }
  }

  return envCache;
}

/**
 * 환경 변수 가져오기
 * process.env 우선, 없으면 .env 파일에서 로드
 */
export function getEnv(key: string, defaultValue = ''): string {
  return process.env[key] || loadEnvVars()[key] || defaultValue;
}

/**
 * Auth 서버 URL 가져오기
 */
export function getAuthServerUrl(): string {
  const url = getEnv('AUTH_SERVER_URL', 'http://localhost:3001');
  console.log('[envLoader] AUTH_SERVER_URL:', url);
  return url;
}

/**
 * Google Client ID 가져오기
 */
export function getGoogleClientId(): string {
  return getEnv('GOOGLE_CLIENT_ID');
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearEnvCache(): void {
  envCache = null;
}
