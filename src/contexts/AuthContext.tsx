import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, AuthState } from '../types';

// API 서버 URL
const API_BASE_URL = 'http://localhost:3001';

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // 세션 토큰으로 유저 정보 가져오기
  const fetchUserProfile = useCallback(async (token: string): Promise<User | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('[AuthContext] Failed to fetch user profile:', response.status);
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        subscriptionTier: data.subscription_tier,
        subscriptionExpiresAt: data.subscription_expires_at,
      };
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      return null;
    }
  }, []);

  // 초기화: 저장된 세션 토큰 확인
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!window.electronAPI) {
          setIsLoading(false);
          return;
        }

        const savedToken = await window.electronAPI.getSessionToken();
        if (savedToken) {
          const userProfile = await fetchUserProfile(savedToken);
          if (userProfile) {
            setSessionToken(savedToken);
            setUser(userProfile);
            setIsAuthenticated(true);
          } else {
            // 토큰이 유효하지 않으면 삭제
            await window.electronAPI.deleteSessionToken();
          }
        }
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchUserProfile]);

  // 로그인
  const login = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    setIsLoading(true);
    try {
      // 1. Google OAuth로 로그인 (기존 기능)
      console.log('[AuthContext] Step 1: Starting Google OAuth login...');
      const googleAuthResult = await window.electronAPI.googleAuthLogin();
      console.log('[AuthContext] Step 1 result:', googleAuthResult);
      if (!googleAuthResult.success) {
        throw new Error(googleAuthResult.error || 'Google login failed');
      }

      // 2. Google ID Token 가져오기
      console.log('[AuthContext] Step 2: Getting Google ID Token...');
      const idToken = await window.electronAPI.getGoogleIdToken();
      console.log('[AuthContext] Step 2 result:', idToken ? `${idToken.substring(0, 30)}...` : 'null');
      if (!idToken) {
        throw new Error('Failed to get Google ID Token');
      }

      // 3. 서버에 세션 생성 요청
      console.log('[AuthContext] Step 3: Creating session at', `${API_BASE_URL}/auth/session`);
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ google_id_token: idToken }),
      });
      console.log('[AuthContext] Step 3 response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AuthContext] Step 3 error data:', errorData);
        throw new Error(errorData.error || 'Session creation failed');
      }

      const { session_token: newToken, user: userData } = await response.json();
      console.log('[AuthContext] Step 3 success, user:', userData?.email);

      // 4. 세션 토큰 저장
      console.log('[AuthContext] Step 4: Saving session token...');
      await window.electronAPI.saveSessionToken(newToken);

      // 5. 상태 업데이트
      console.log('[AuthContext] Step 5: Updating state...');
      setSessionToken(newToken);
      setUser({
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name,
        avatarUrl: userData.avatar_url,
        subscriptionTier: userData.subscription_tier,
        subscriptionExpiresAt: userData.subscription_expires_at,
      });
      setIsAuthenticated(true);
      console.log('[AuthContext] Login completed successfully!');
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    if (!window.electronAPI) return;

    setIsLoading(true);
    try {
      // 1. 서버에 세션 삭제 요청
      if (sessionToken) {
        await fetch(`${API_BASE_URL}/auth/session`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }

      // 2. Google OAuth 로그아웃
      await window.electronAPI.googleAuthLogout();

      // 3. 로컬 세션 토큰 삭제
      await window.electronAPI.deleteSessionToken();

      // 4. 상태 초기화
      setSessionToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
      // 에러가 발생해도 로컬 상태는 초기화
      setSessionToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  // 유저 정보 새로고침
  const refreshUser = useCallback(async () => {
    if (!sessionToken) return;

    const userProfile = await fetchUserProfile(sessionToken);
    if (userProfile) {
      setUser(userProfile);
    } else {
      // 토큰이 만료되었을 수 있음
      await logout();
    }
  }, [sessionToken, fetchUserProfile, logout]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    sessionToken,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
