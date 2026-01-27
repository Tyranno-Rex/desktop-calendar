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
let cachedClientId: string | null = null;
let cachedAuthServerUrl: string | null = null;

// .env 파일 파싱 (dotenv 없이)
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          result[key] = value;
        }
      }
    }
  } catch {
    // 파일 없으면 무시
  }
  return result;
}

// Client ID 가져오기
function getClientId(): string {
  if (cachedClientId) return cachedClientId;

  // 환경 변수에서 먼저 확인
  if (process.env.GOOGLE_CLIENT_ID) {
    cachedClientId = process.env.GOOGLE_CLIENT_ID;
    return cachedClientId;
  }

  // .env 파일에서 로드 (개발/프로덕션 모두 지원)
  const possiblePaths = [
    // 개발 환경
    path.join(process.cwd(), 'env', '.env'),
    path.join(__dirname, '..', 'env', '.env'),
    // 패키지된 앱 (asar 내부)
    path.join(__dirname, '..', '..', 'env', '.env'),
  ];

  // process.resourcesPath가 있으면 (패키지된 앱)
  if (process.resourcesPath) {
    possiblePaths.push(
      path.join(process.resourcesPath, 'app.asar', 'env', '.env'),
      path.join(process.resourcesPath, 'app', 'env', '.env')
    );
  }

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const envVars = parseEnvFile(envPath);
      if (envVars.GOOGLE_CLIENT_ID) {
        cachedClientId = envVars.GOOGLE_CLIENT_ID;
        return cachedClientId;
      }
    }
  }

  return '';
}

// Auth 서버 URL 가져오기
function getAuthServerUrl(): string {
  if (cachedAuthServerUrl) return cachedAuthServerUrl;

  // 환경 변수에서 먼저 확인
  if (process.env.AUTH_SERVER_URL) {
    cachedAuthServerUrl = process.env.AUTH_SERVER_URL;
    return cachedAuthServerUrl;
  }

  // .env 파일에서 로드
  const possiblePaths = [
    path.join(process.cwd(), 'env', '.env'),
    path.join(__dirname, '..', 'env', '.env'),
    path.join(__dirname, '..', '..', 'env', '.env'),
  ];

  if (process.resourcesPath) {
    possiblePaths.push(
      path.join(process.resourcesPath, 'app.asar', 'env', '.env'),
      path.join(process.resourcesPath, 'app', 'env', '.env')
    );
  }

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const envVars = parseEnvFile(envPath);
      if (envVars.AUTH_SERVER_URL) {
        cachedAuthServerUrl = envVars.AUTH_SERVER_URL;
        return cachedAuthServerUrl;
      }
    }
  }

  return 'http://localhost:3001';
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

// 인증 상태 확인
export function isAuthenticated(): boolean {
  const token = loadToken();
  return token !== null;
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
  console.log('[GoogleAuth] startAuthFlow called, authInProgress:', authInProgress);

  if (!electronFunctions) {
    return Promise.reject(new Error('googleAuth not initialized'));
  }

  // 이미 인증 진행 중이면 거부
  if (authInProgress) {
    console.log('[GoogleAuth] Rejected: already in progress');
    return Promise.reject(new Error('Authentication already in progress'));
  }

  authInProgress = true;
  console.log('[GoogleAuth] Starting auth flow...');

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
            console.log('[GoogleAuth] Got code, exchanging token via auth server...');
            console.log('[GoogleAuth] Auth server URL:', getAuthServerUrl());
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
            console.log('[GoogleAuth] Token response:', tokenData.error ? tokenData : 'success');

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
