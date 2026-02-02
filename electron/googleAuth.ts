// Google Auth PKCE - electron 의존성 없음
// electron 관련 기능은 main.ts에서 init 함수로 전달받음

import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Electron에서 전달받을 함수들
let electronFunctions: {
  getUserDataPath: () => string;
  encryptString: (str: string) => Buffer;
  decryptString: (buf: Buffer) => string;
  isEncryptionAvailable: () => boolean;
  openAuthWindow: (url: string, onClose: () => void) => void;
} | null = null;

// 초기화 함수 (main.ts에서 호출)
export function initGoogleAuth(funcs: typeof electronFunctions) {
  electronFunctions = funcs;
}

// 환경 변수 캐시
let envCache: Record<string, string> | null = null;

// .env 파일 로드 및 캐싱
function getEnvVars(): Record<string, string> {
  if (envCache) return envCache;

  envCache = {};

  // .env 파일 경로 후보
  const possiblePaths = [
    path.join(process.cwd(), 'env', '.env'),
    path.join(__dirname, '..', 'env', '.env'),
    path.join(__dirname, '..', '..', 'env', '.env'),
  ];

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

// 환경 변수 가져오기 (process.env 우선, 없으면 .env 파일)
function getEnv(key: string, defaultValue = ''): string {
  return process.env[key] || getEnvVars()[key] || defaultValue;
}

// Client ID 가져오기
function getClientId(): string {
  return getEnv('GOOGLE_CLIENT_ID');
}

// Auth 서버 URL 가져오기
function getAuthServerUrl(): string {
  return getEnv('AUTH_SERVER_URL', 'http://localhost:3001');
}

// PKCE: Code Verifier 생성 (43~128자 랜덤 문자열)
function generateCodeVerifier(): string {
  const buffer = crypto.randomBytes(32);
  return base64URLEncode(buffer);
}

// PKCE: Code Challenge 생성 (SHA256 해싱)
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64URLEncode(hash);
}

// Base64 URL-safe 인코딩
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// CSRF 방지용 State 생성
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

const REDIRECT_URI = 'http://127.0.0.1:8089/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// 토큰 인터페이스
export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at?: number; // 만료 시간 (timestamp)
}

// 토큰 저장 경로
function getTokenPath(): string {
  if (!electronFunctions) {
    throw new Error('googleAuth not initialized');
  }
  return path.join(electronFunctions.getUserDataPath(), 'google-token.json');
}

// 토큰 저장 (암호화)
function saveToken(token: TokenData): void {
  if (!electronFunctions) return;

  try {
    // 만료 시간 계산
    token.expires_at = Date.now() + token.expires_in * 1000;
    const tokenString = JSON.stringify(token);

    if (electronFunctions.isEncryptionAvailable()) {
      const encrypted = electronFunctions.encryptString(tokenString);
      fs.writeFileSync(getTokenPath(), encrypted);
    } else {
      fs.writeFileSync(getTokenPath(), tokenString);
    }
  } catch (error) {
    console.error('Failed to save token:', error);
  }
}

// 토큰 로드 (복호화)
export function loadToken(): TokenData | null {
  if (!electronFunctions) return null;

  try {
    const tokenPath = getTokenPath();
    if (!fs.existsSync(tokenPath)) return null;

    const data = fs.readFileSync(tokenPath);

    if (electronFunctions.isEncryptionAvailable()) {
      const decrypted = electronFunctions.decryptString(data);
      return JSON.parse(decrypted);
    } else {
      return JSON.parse(data.toString());
    }
  } catch (error) {
    console.error('Failed to load token:', error);
    return null;
  }
}

// 토큰 삭제
export function deleteToken(): void {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  } catch (error) {
    console.error('Failed to delete token:', error);
  }
}

// 인증 상태 확인 (토큰 존재 여부만 체크, 만료는 getAccessToken에서 처리)
export function isAuthenticated(): boolean {
  const token = loadToken();
  return token !== null;
}

// 토큰 검증 캐시 (5분간 유효)
let lastValidationTime = 0;
let lastValidationResult = false;
const VALIDATION_CACHE_MS = 5 * 60 * 1000; // 5분

// 토큰 유효성 검증 (서버 프록시 사용, 캐싱 적용)
export async function validateToken(): Promise<boolean> {
  // 캐시된 결과가 있고 5분 이내면 재사용
  const now = Date.now();
  if (lastValidationResult && (now - lastValidationTime) < VALIDATION_CACHE_MS) {
    return true;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // 토큰 없거나 갱신 실패 → 토큰 삭제
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    // 서버 프록시를 통해 토큰 유효성 확인
    const response = await fetch(`${getAuthServerUrl()}/auth/google/validate`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.log('Token validation failed, status:', response.status);
      // 토큰 무효 → 삭제
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    // 토큰 정보 확인
    const result = await response.json() as { valid: boolean; expiresIn?: number };

    if (!result.valid) {
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    console.log('Token valid, expires in:', result.expiresIn, 'seconds');

    // 검증 결과 캐싱
    lastValidationTime = now;
    lastValidationResult = true;
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    deleteToken();
    lastValidationResult = false;
    return false;
  }
}

// 캐시 초기화 (로그아웃 시 호출)
export function clearValidationCache(): void {
  lastValidationTime = 0;
  lastValidationResult = false;
}

// Access Token 가져오기 (필요시 갱신)
export async function getAccessToken(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  // 토큰 만료 체크 (5분 여유)
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    // 토큰 갱신 필요
    if (token.refresh_token) {
      const newToken = await refreshAccessToken(token.refresh_token);
      if (newToken) {
        return newToken.access_token;
      }
    }
    // 갱신 실패 → 토큰 삭제 (재인증 필요)
    console.log('Token refresh failed, deleting token');
    deleteToken();
    return null;
  }

  return token.access_token;
}

// Refresh Token으로 Access Token 갱신 (서버 경유)
async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const response = await fetch(`${getAuthServerUrl()}/auth/google/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json() as any;

    if (data.error) {
      console.error('Token refresh failed:', data.error);
      return null;
    }

    const newToken: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    };

    saveToken(newToken);
    return newToken;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
}

// 인증 진행 중 플래그
let authInProgress = false;

// PKCE OAuth 인증 플로우 시작
export function startAuthFlow(): Promise<TokenData> {
  if (!electronFunctions) {
    return Promise.reject(new Error('googleAuth not initialized'));
  }

  // 이미 인증 진행 중이면 거부
  if (authInProgress) {
    return Promise.reject(new Error('Authentication already in progress'));
  }

  authInProgress = true;

  return new Promise((resolve, reject) => {
    // PKCE 값 생성
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // 로컬 서버 시작 (콜백 받기 위해)
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code as string;
          const returnedState = parsedUrl.query.state as string;
          const error = parsedUrl.query.error as string;

          if (error) {
            throw new Error(`OAuth error: ${error}`);
          }

          if (returnedState !== state) {
            throw new Error('State mismatch! Possible CSRF attack');
          }

          if (code) {
            // 서버를 통해 토큰 교환 (client_secret은 서버에서 처리)
            const tokenResponse = await fetch(`${getAuthServerUrl()}/auth/google/token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code: code,
                codeVerifier: codeVerifier,
              }),
            });

            const tokenData = await tokenResponse.json() as TokenData & { error?: string; error_description?: string; details?: any };

            if (tokenData.error) {
              const details = tokenData.details ? JSON.stringify(tokenData.details) : '';
              throw new Error(`Token exchange failed: ${tokenData.error} ${details}`);
            }

            const token: TokenData = {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expires_in: tokenData.expires_in,
              token_type: tokenData.token_type,
              scope: tokenData.scope,
            };
            saveToken(token);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                             display: flex; align-items: center; justify-content: center;
                             height: 100vh; margin: 0; background: #1a1a2e; color: white;">
                  <div style="text-align: center;">
                    <h1>✅ 인증 완료!</h1>
                    <p>이 창을 닫아도 됩니다.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                  </div>
                </body>
              </html>
            `);

            server.close();
            authInProgress = false;
            resolve(token);
          } else {
            throw new Error('No authorization code received');
          }
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                         display: flex; align-items: center; justify-content: center;
                         height: 100vh; margin: 0; background: #1a1a2e; color: white;">
              <div style="text-align: center;">
                <h1>❌ 인증 실패</h1>
                <p>${error}</p>
              </div>
            </body>
          </html>
        `);
        server.close();
        authInProgress = false;
        reject(error);
      }
    });

    // 서버 에러 핸들링 (포트 충돌 등)
    server.on('error', (err) => {
      authInProgress = false;
      reject(err);
    });

    server.listen(8089, '127.0.0.1', () => {
      const authParams = new URLSearchParams({
        client_id: getClientId(),
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
        access_type: 'offline',
        prompt: 'consent',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams}`;

      // Electron 창 열기 (main.ts에서 전달받은 함수 사용)
      electronFunctions!.openAuthWindow(authUrl, () => {
        server.close();
        authInProgress = false;
      });
    });

    // 타임아웃 (2분)
    setTimeout(() => {
      server.close();
      authInProgress = false;
      reject(new Error('Authentication timeout'));
    }, 120000);
  });
}
