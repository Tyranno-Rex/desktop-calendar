// Google Auth PKCE - electron 의존성 없음
// electron 관련 기능은 main.ts에서 init 함수로 전달받음

import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAuthServerUrl, getGoogleClientId } from './utils/envLoader';

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

// PKCE 유틸리티
function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

const REDIRECT_URI = 'http://127.0.0.1:8089/oauth2callback';
const SCOPES = [
  'openid',  // ID Token을 받기 위해 필요
  'email',   // 이메일 정보
  'profile', // 프로필 정보
  'https://www.googleapis.com/auth/calendar.events'
];

// 토큰 인터페이스
export interface TokenData {
  access_token: string;
  refresh_token?: string;
  id_token?: string;  // Google ID Token (계정 시스템용)
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at?: number;
}

// 토큰 저장 경로
function getTokenPath(): string {
  if (!electronFunctions) throw new Error('googleAuth not initialized');
  return path.join(electronFunctions.getUserDataPath(), 'google-token.json');
}

// 토큰 저장 (암호화)
function saveToken(token: TokenData): void {
  if (!electronFunctions) return;

  try {
    token.expires_at = Date.now() + token.expires_in * 1000;
    const tokenString = JSON.stringify(token);

    if (electronFunctions.isEncryptionAvailable()) {
      fs.writeFileSync(getTokenPath(), electronFunctions.encryptString(tokenString));
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
      return JSON.parse(electronFunctions.decryptString(data));
    }
    return JSON.parse(data.toString());
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
  return loadToken() !== null;
}

// 토큰 검증 캐시
let lastValidationTime = 0;
let lastValidationResult = false;
const VALIDATION_CACHE_MS = 5 * 60 * 1000;

// 캐시 초기화
export function clearValidationCache(): void {
  lastValidationTime = 0;
  lastValidationResult = false;
}

// 인증 진행 상태 리셋 (stuck 상태 해결용)
export function resetAuthInProgress(): void {
  authInProgress = false;
}

// 토큰 유효성 검증
export async function validateToken(): Promise<boolean> {
  const now = Date.now();
  if (lastValidationResult && (now - lastValidationTime) < VALIDATION_CACHE_MS) {
    return true;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    const response = await fetch(`${getAuthServerUrl()}/auth/google/validate`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.log('Token validation failed, status:', response.status);
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    const result = await response.json() as { valid: boolean; expiresIn?: number };
    if (!result.valid) {
      deleteToken();
      lastValidationResult = false;
      return false;
    }

    console.log('Token valid, expires in:', result.expiresIn, 'seconds');
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

// Access Token 가져오기 (필요시 갱신)
export async function getAccessToken(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  // 토큰 만료 체크 (5분 여유)
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    if (token.refresh_token) {
      const newToken = await refreshAccessToken(token.refresh_token);
      if (newToken) return newToken.access_token;
    }
    console.log('Token refresh failed, deleting token');
    deleteToken();
    return null;
  }

  return token.access_token;
}

// ID Token 가져오기 (계정 시스템 인증용)
export async function getIdToken(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  // 토큰 만료되었으면 갱신 시도
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    if (token.refresh_token) {
      const newToken = await refreshAccessToken(token.refresh_token);
      if (newToken) return newToken.id_token || null;
    }
    console.log('Token refresh failed, deleting token');
    deleteToken();
    return null;
  }

  return token.id_token || null;
}

// Refresh Token으로 Access Token 갱신
async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const response = await fetch(`${getAuthServerUrl()}/auth/google/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json() as TokenData & { error?: string };
    if (data.error) {
      console.error('Token refresh failed:', data.error);
      return null;
    }

    const newToken: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      id_token: data.id_token,  // ID Token도 갱신
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

  if (authInProgress) {
    return Promise.reject(new Error('Authentication already in progress'));
  }

  authInProgress = true;

  return new Promise((resolve, reject) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code as string;
          const returnedState = parsedUrl.query.state as string;
          const error = parsedUrl.query.error as string;

          if (error) throw new Error(`OAuth error: ${error}`);
          if (returnedState !== state) throw new Error('State mismatch! Possible CSRF attack');

          if (code) {
            const tokenResponse = await fetch(`${getAuthServerUrl()}/auth/google/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, codeVerifier }),
            });

            const tokenData = await tokenResponse.json() as TokenData & { error?: string; details?: unknown };

            if (tokenData.error) {
              const details = tokenData.details ? JSON.stringify(tokenData.details) : '';
              throw new Error(`Token exchange failed: ${tokenData.error} ${details}`);
            }

            const token: TokenData = {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              id_token: tokenData.id_token,  // ID Token 저장
              expires_in: tokenData.expires_in,
              token_type: tokenData.token_type,
              scope: tokenData.scope,
            };
            console.log('[googleAuth] Token received - id_token:', tokenData.id_token ? 'present' : 'MISSING');
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

    server.on('error', (err) => {
      authInProgress = false;
      reject(err);
    });

    server.listen(8089, '127.0.0.1', () => {
      const authParams = new URLSearchParams({
        client_id: getGoogleClientId(),
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
