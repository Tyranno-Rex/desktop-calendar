# 계정 시스템 및 클라우드 동기화 구현 계획

> **상태**: 계획 단계
> **작성일**: 2026-02-02
> **선행 조건**: 기본 기능 완성 및 안정화 후 진행

---

## 목차
1. [개요](#1-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [DB 스키마](#4-db-스키마)
5. [API 설계](#5-api-설계)
6. [클라이언트 구현](#6-클라이언트-구현)
7. [구독 시스템](#7-구독-시스템)
8. [동기화 로직](#8-동기화-로직)
9. [보안](#9-보안)
10. [마이그레이션](#10-마이그레이션)
11. [테스트 계획](#11-테스트-계획)
12. [작업 일정](#12-작업-일정)
13. [리스크 및 대응](#13-리스크-및-대응)

---

## 1. 개요

### 1.1 목표
Desktop Calendar 앱에 계정 시스템과 클라우드 동기화를 추가하여 Premium 구독 서비스 제공

### 1.2 구현할 기능
| 기능 | 설명 | 티어 |
|------|------|------|
| 클라우드 동기화 | 이벤트/메모를 서버에 저장 | Premium |
| 다중 기기 지원 | 여러 PC에서 동일 데이터 접근 | Premium |
| 자동 백업 | 클라우드에 자동 백업 | Premium |
| 설정 동기화 | 테마, 옵션 등 설정 동기화 | Premium |
| Google Calendar 연동 | 기존 기능 유지 | Premium |

### 1.3 Free vs Premium
| 기능 | Free | Premium |
|------|------|---------|
| 로컬 이벤트 관리 | ✅ | ✅ |
| 로컬 자동 백업 | ✅ | ✅ |
| Google Calendar 연동 | ❌ | ✅ |
| 클라우드 동기화 | ❌ | ✅ |
| 다중 기기 | ❌ | ✅ |
| 클라우드 백업 | ❌ | ✅ |

---

## 2. 기술 스택

### 2.1 선택된 기술
| 구분 | 기술 | 선택 이유 |
|------|------|----------|
| 인증 | Google OAuth만 | 기존 연동 활용, 구현 단순화 |
| DB | Supabase (PostgreSQL) | 무료 티어 충분, Auth 내장, RLS 지원 |
| 동기화 | Pull 방식 | 구현 단순, 실시간 불필요 |
| 결제 | Stripe | 개발자 친화적, 한국 지원 |

### 2.2 Supabase 무료 티어 한도
- DB: 500MB
- Auth: MAU 50,000
- API 요청: 무제한
- 실시간 연결: 200 동시

### 2.3 예상 비용 (월간)
| 항목 | Free 티어 | 유료 전환 시점 |
|------|----------|---------------|
| Supabase | $0 | DB 500MB 초과 시 $25/월 |
| Stripe | 거래당 2.9% + 30¢ | 즉시 |
| 서버 (Hono) | $0 (Cloudflare Workers) | 10만 요청/일 초과 시 |

---

## 3. 시스템 아키텍처

### 3.1 전체 구조
```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop Calendar App                      │
│                           (Electron)                             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Auth Server                              │
│                      (Hono + Cloudflare)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /auth/*     │  │ /sync/*     │  │ /subscription/*         │  │
│  │ 인증 처리    │  │ 데이터 동기화│  │ 구독 관리               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                  │                      │
           ▼                  ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Google OAuth   │  │    Supabase      │  │     Stripe       │
│   (기존 유지)     │  │  (PostgreSQL)    │  │    (결제)        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 3.2 데이터 흐름

#### 로그인 흐름
```
1. [앱] Google 로그인 버튼 클릭
2. [앱] Google OAuth 페이지 열기
3. [Google] 사용자 인증 → Authorization Code 반환
4. [앱] Auth Server로 코드 전송
5. [서버] Google에서 Access Token + ID Token 획득
6. [서버] ID Token에서 이메일 추출
7. [서버] Supabase에서 유저 조회/생성
8. [서버] 세션 토큰 생성 → 앱에 반환
9. [앱] 세션 토큰 저장 (safeStorage 암호화)
```

#### 동기화 흐름
```
1. [앱] 앱 시작 또는 수동 동기화 버튼 클릭
2. [앱] 로컬 변경사항 수집 (lastSyncAt 이후)
3. [앱] POST /sync/events { events, lastSyncAt }
4. [서버] 구독 상태 확인 → Premium 아니면 403
5. [서버] 클라이언트 변경사항 → DB 저장 (upsert)
6. [서버] DB에서 lastSyncAt 이후 변경된 데이터 조회
7. [서버] 변경된 데이터 + 새 syncedAt 반환
8. [앱] 서버 데이터를 로컬에 머지
9. [앱] lastSyncAt 업데이트
```

#### 결제 흐름
```
1. [앱] "Premium 구독" 버튼 클릭
2. [앱] POST /subscription/checkout
3. [서버] Stripe Checkout Session 생성
4. [서버] Checkout URL 반환
5. [앱] 브라우저에서 Stripe 결제 페이지 열기
6. [유저] 카드 정보 입력 → 결제
7. [Stripe] Webhook → POST /subscription/webhook
8. [서버] DB에 구독 상태 업데이트
9. [앱] 구독 상태 새로고침 → Premium 활성화
```

---

## 4. DB 스키마

### 4.1 ERD
```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │     events      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ email           │  │    │ user_id (FK)    │──┐
│ display_name    │  │    │ local_id        │  │
│ subscription_*  │  │    │ title           │  │
│ stripe_*        │  │    │ date            │  │
│ created_at      │  │    │ time            │  │
│ updated_at      │  │    │ ...             │  │
└─────────────────┘  │    │ updated_at      │  │
                     │    │ deleted_at      │  │
                     │    └─────────────────┘  │
                     │                         │
                     │    ┌─────────────────┐  │
                     │    │     memos       │  │
                     │    ├─────────────────┤  │
                     │    │ id (PK)         │  │
                     └────│ user_id (FK)    │──┤
                          │ local_id        │  │
                          │ content         │  │
                          │ updated_at      │  │
                          │ deleted_at      │  │
                          └─────────────────┘  │
                                               │
                          ┌─────────────────┐  │
                          │  user_settings  │  │
                          ├─────────────────┤  │
                          │ user_id (PK,FK) │──┘
                          │ settings (JSON) │
                          │ updated_at      │
                          └─────────────────┘
```

### 4.2 테이블 정의

#### users 테이블
```sql
CREATE TABLE users (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,

  -- 구독 정보
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  subscription_canceled_at TIMESTAMPTZ,

  -- Stripe 연동
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### events 테이블
```sql
CREATE TABLE events (
  -- 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL, -- 클라이언트에서 생성한 UUID

  -- 이벤트 기본 정보
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  completed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Google Calendar 연동
  google_event_id TEXT,
  is_google_event BOOLEAN NOT NULL DEFAULT FALSE,

  -- 반복 설정
  repeat_type TEXT DEFAULT 'none'
    CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval INT DEFAULT 1,
  repeat_end_date DATE,
  repeat_group_id TEXT,
  is_repeat_instance BOOLEAN NOT NULL DEFAULT FALSE,

  -- 알림 설정
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_minutes_before INT DEFAULT 30,

  -- 동기화용 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete (NULL이면 활성)

  -- 제약조건
  CONSTRAINT unique_user_local_id UNIQUE (user_id, local_id)
);

-- 인덱스
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_user_date ON events(user_id, date);
CREATE INDEX idx_events_user_updated ON events(user_id, updated_at);
CREATE INDEX idx_events_deleted ON events(deleted_at) WHERE deleted_at IS NULL;

-- updated_at 트리거
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### memos 테이블
```sql
CREATE TABLE memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,

  content TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_memo_user_local_id UNIQUE (user_id, local_id)
);

CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_user_updated ON memos(user_id, updated_at);

CREATE TRIGGER memos_updated_at
  BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### user_settings 테이블
```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 설정 JSON (유연성)
  settings JSONB NOT NULL DEFAULT '{
    "opacity": 0.95,
    "alwaysOnTop": false,
    "desktopMode": false,
    "theme": "dark",
    "fontSize": 14,
    "showHolidays": true,
    "showAdjacentMonths": true,
    "showGridLines": true,
    "hiddenDays": [],
    "schedulePanelPosition": "right",
    "showEventDots": false,
    "autoBackup": true,
    "showOverdueTasks": true
  }'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### coupons 테이블 (Limited-use 쿠폰 시스템)
```sql
-- 쿠폰 테이블
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 20자리 (XXXX-XXXX-XXXX-XXXX-XXXX)
  description TEXT,

  -- 사용 제한
  max_uses INT, -- NULL이면 무제한
  used_count INT NOT NULL DEFAULT 0,

  -- 혜택
  duration_days INT NOT NULL DEFAULT 365, -- Premium 기간 (일)

  -- 유효 기간
  expires_at TIMESTAMPTZ, -- NULL이면 만료 없음
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active) WHERE is_active = TRUE;

CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 쿠폰 사용 기록 테이블
CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 한 유저가 같은 쿠폰을 여러 번 사용 못하도록
  CONSTRAINT unique_coupon_user UNIQUE (coupon_id, user_id)
);

CREATE INDEX idx_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX idx_redemptions_user ON coupon_redemptions(user_id);
```

### 4.3 RLS (Row Level Security) 정책
```sql
-- 모든 테이블에 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- users: 자신의 데이터만 조회/수정
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- events: 자신의 이벤트만 CRUD
CREATE POLICY "events_all_own" ON events
  FOR ALL USING (auth.uid() = user_id);

-- memos: 자신의 메모만 CRUD
CREATE POLICY "memos_all_own" ON memos
  FOR ALL USING (auth.uid() = user_id);

-- user_settings: 자신의 설정만 CRUD
CREATE POLICY "settings_all_own" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
```

---

## 5. API 설계

### 5.1 엔드포인트 목록

#### 인증 (Auth)
| Method | Path | 설명 | 인증 필요 |
|--------|------|------|----------|
| POST | /auth/google/callback | Google OAuth 콜백 | ❌ |
| GET | /auth/google/validate | 토큰 유효성 검증 | ✅ |
| POST | /auth/session | 세션 토큰 발급 | ✅ (Google) |
| DELETE | /auth/session | 로그아웃 | ✅ |

#### 유저 (User)
| Method | Path | 설명 | 인증 필요 |
|--------|------|------|----------|
| GET | /user/profile | 프로필 조회 | ✅ |
| PATCH | /user/profile | 프로필 수정 | ✅ |

#### 동기화 (Sync)
| Method | Path | 설명 | 인증 필요 | Premium |
|--------|------|------|----------|---------|
| GET | /sync/status | 동기화 상태 조회 | ✅ | ✅ |
| POST | /sync/events | 이벤트 동기화 | ✅ | ✅ |
| POST | /sync/memos | 메모 동기화 | ✅ | ✅ |
| POST | /sync/settings | 설정 동기화 | ✅ | ✅ |
| POST | /sync/all | 전체 동기화 | ✅ | ✅ |

#### 구독 (Subscription)
| Method | Path | 설명 | 인증 필요 |
|--------|------|------|----------|
| GET | /subscription/status | 구독 상태 조회 | ✅ |
| POST | /subscription/checkout | 결제 세션 생성 | ✅ |
| POST | /subscription/webhook | Stripe 웹훅 | ❌ (서명 검증) |
| GET | /subscription/portal | 고객 포털 URL | ✅ |
| POST | /subscription/cancel | 구독 취소 | ✅ |

### 5.2 API 상세 명세

#### POST /auth/session
세션 토큰 발급 (Google 토큰으로 서버 세션 생성)

**Request:**
```json
{
  "google_access_token": "ya29.a0...",
  "google_id_token": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "session_token": "sb-xxxx-auth-token",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "display_name": "John Doe",
    "subscription_tier": "free",
    "subscription_expires_at": null
  },
  "expires_at": "2026-02-09T00:00:00Z"
}
```

**Response (401):**
```json
{
  "error": "Invalid Google token"
}
```

#### POST /sync/events
이벤트 동기화 (양방향)

**Request:**
```json
{
  "events": [
    {
      "local_id": "uuid-from-client",
      "title": "Meeting",
      "date": "2026-02-03",
      "time": "14:00",
      "description": "Team meeting",
      "color": "#3b82f6",
      "completed": false,
      "updated_at": "2026-02-02T08:00:00Z",
      "deleted": false
    }
  ],
  "last_sync_at": "2026-02-01T00:00:00Z"
}
```

**Response (200):**
```json
{
  "events": [
    {
      "local_id": "uuid-from-another-device",
      "title": "Other Event",
      "date": "2026-02-04",
      "updated_at": "2026-02-02T07:00:00Z"
    }
  ],
  "synced_at": "2026-02-02T08:30:00Z",
  "conflicts": []
}
```

**Response (403):**
```json
{
  "error": "Premium subscription required",
  "code": "PREMIUM_REQUIRED"
}
```

#### POST /subscription/checkout
Stripe 결제 세션 생성

**Request:**
```json
{
  "plan": "monthly",  // "monthly" | "yearly"
  "success_url": "desktop-calendar://subscription/success",
  "cancel_url": "desktop-calendar://subscription/cancel"
}
```

**Response (200):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/...",
  "session_id": "cs_xxx"
}
```

#### POST /subscription/webhook
Stripe 웹훅 처리

**Headers:**
```
Stripe-Signature: t=xxx,v1=xxx
```

**Events Handled:**
- `checkout.session.completed` - 결제 완료
- `customer.subscription.updated` - 구독 상태 변경
- `customer.subscription.deleted` - 구독 취소
- `invoice.payment_failed` - 결제 실패

---

## 6. 클라이언트 구현

### 6.1 새로운 파일 구조
```
src/
├── lib/
│   └── supabase.ts              # Supabase 클라이언트 (새)
│
├── hooks/
│   ├── useEvents.ts             # 수정: 클라우드 동기화 연동
│   ├── useAuth.ts               # 새: 인증 상태 관리
│   ├── useCloudSync.ts          # 새: 동기화 로직
│   └── useSubscription.ts       # 새: 구독 상태 관리
│
├── components/
│   ├── Auth/
│   │   ├── LoginButton.tsx      # 새: 로그인 버튼
│   │   └── UserMenu.tsx         # 새: 유저 메뉴 (프로필, 로그아웃)
│   │
│   └── Subscription/
│       ├── UpgradeModal.tsx     # 새: 업그레이드 안내 모달
│       ├── PlanBadge.tsx        # 새: Free/Premium 뱃지
│       └── ManageSubscription.tsx # 새: 구독 관리
│
├── contexts/
│   └── AuthContext.tsx          # 새: 인증 컨텍스트
│
└── types/
    └── index.ts                 # 수정: 새 타입 추가
```

### 6.2 새로운 타입 정의
```typescript
// src/types/index.ts에 추가

// 유저
interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiresAt: string | null;
}

// 인증 상태
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  sessionToken: string | null;
}

// 동기화 상태
interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  pendingChanges: number;
}

// 구독 상태
interface SubscriptionState {
  tier: 'free' | 'premium';
  expiresAt: string | null;
  isCanceled: boolean;
  isLoading: boolean;
}
```

### 6.3 useAuth Hook
```typescript
// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '../types';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    sessionToken: null,
  });

  // 앱 시작 시 저장된 세션 확인
  useEffect(() => {
    checkStoredSession();
  }, []);

  const checkStoredSession = async () => {
    try {
      if (!window.electronAPI) return;

      const sessionToken = await window.electronAPI.getSessionToken();
      if (!sessionToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // 서버에서 세션 유효성 확인
      const response = await fetch(`${AUTH_SERVER_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const user = await response.json();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          sessionToken,
        });
      } else {
        // 세션 만료 - 삭제
        await window.electronAPI.deleteSessionToken();
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async () => {
    // 1. Google 로그인
    const googleResult = await window.electronAPI.googleAuthLogin();
    if (!googleResult.success) {
      throw new Error('Google login failed');
    }

    // 2. 서버에서 세션 토큰 발급
    const response = await fetch(`${AUTH_SERVER_URL}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_access_token: googleResult.accessToken,
        google_id_token: googleResult.idToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Session creation failed');
    }

    const { session_token, user } = await response.json();

    // 3. 세션 토큰 저장
    await window.electronAPI.saveSessionToken(session_token);

    setState({
      isAuthenticated: true,
      isLoading: false,
      user,
      sessionToken: session_token,
    });
  }, []);

  const logout = useCallback(async () => {
    await window.electronAPI?.deleteSessionToken();
    await window.electronAPI?.googleAuthLogout();

    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      sessionToken: null,
    });
  }, []);

  return {
    ...state,
    login,
    logout,
    refreshUser: checkStoredSession,
  };
}
```

### 6.4 useCloudSync Hook
```typescript
// src/hooks/useCloudSync.ts
import { useState, useCallback, useRef } from 'react';
import type { CalendarEvent, Memo, SyncState } from '../types';

interface SyncResult {
  events: CalendarEvent[];
  memos: Memo[];
  syncedAt: string;
}

export function useCloudSync(sessionToken: string | null, isPremium: boolean) {
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    lastSyncAt: null,
    syncError: null,
    pendingChanges: 0,
  });

  const syncInProgressRef = useRef(false);

  // 전체 동기화
  const syncAll = useCallback(async (
    localEvents: CalendarEvent[],
    localMemos: Memo[]
  ): Promise<SyncResult | null> => {
    if (!sessionToken || !isPremium) return null;
    if (syncInProgressRef.current) return null;

    syncInProgressRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const response = await fetch(`${AUTH_SERVER_URL}/sync/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          events: localEvents,
          memos: localMemos,
          last_sync_at: state.lastSyncAt,
        }),
      });

      if (response.status === 403) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: 'Premium subscription required',
        }));
        return null;
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();

      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: result.synced_at,
        pendingChanges: 0,
      }));

      return {
        events: result.events,
        memos: result.memos,
        syncedAt: result.synced_at,
      };
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: String(error),
      }));
      return null;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [sessionToken, isPremium, state.lastSyncAt]);

  // 변경사항 카운트 증가 (로컬 변경 시 호출)
  const markPendingChange = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingChanges: prev.pendingChanges + 1,
    }));
  }, []);

  return {
    ...state,
    syncAll,
    markPendingChange,
  };
}
```

### 6.5 useEvents 수정사항
```typescript
// src/hooks/useEvents.ts 수정

export function useEvents(cloudSync?: ReturnType<typeof useCloudSync>) {
  // ... 기존 코드 ...

  // 이벤트 추가 시 클라우드 동기화 마킹
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent = { ...event, id: uuidv4() };

    setEvents(prev => {
      const newEvents = [...prev, newEvent];
      persistEvents(newEvents);
      return newEvents;
    });

    // 클라우드 동기화 대기 표시
    cloudSync?.markPendingChange();

    return newEvent;
  }, [cloudSync]);

  // 앱 시작 시 클라우드에서 데이터 로드
  const loadFromCloud = useCallback(async () => {
    if (!cloudSync) return;

    const result = await cloudSync.syncAll(events, memos);
    if (result) {
      // 서버 데이터와 로컬 데이터 머지
      setEvents(mergeEvents(events, result.events));
    }
  }, [cloudSync, events]);

  return {
    // ... 기존 반환값 ...
    loadFromCloud,
  };
}
```

### 6.6 electron preload 추가
```typescript
// electron/preload.ts에 추가

contextBridge.exposeInMainWorld('electronAPI', {
  // ... 기존 API ...

  // 세션 토큰 관리
  saveSessionToken: (token: string) => ipcRenderer.invoke('save-session-token', token),
  getSessionToken: () => ipcRenderer.invoke('get-session-token'),
  deleteSessionToken: () => ipcRenderer.invoke('delete-session-token'),
});
```

---

## 7. 구독 시스템

### 7.1 Stripe 설정

#### Products & Prices
| Plan | Price ID | 가격 | Billing |
|------|----------|------|---------|
| Monthly | price_monthly_xxx | $4.99/월 | 매월 자동결제 |
| Yearly | price_yearly_xxx | $39.99/년 | 매년 자동결제 (~33% 할인) |

#### Webhook Events
- `checkout.session.completed` - 최초 결제 완료
- `customer.subscription.updated` - 플랜 변경, 갱신
- `customer.subscription.deleted` - 취소 완료
- `invoice.payment_failed` - 결제 실패 (카드 만료 등)

### 7.2 서버 구현
```typescript
// server/src/routes/subscription.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 결제 세션 생성
app.post('/subscription/checkout', async (c) => {
  const user = await getAuthenticatedUser(c);
  const { plan } = await c.req.json();

  // 기존 Stripe Customer 조회 또는 생성
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // Checkout Session 생성
  const priceId = plan === 'yearly'
    ? process.env.STRIPE_YEARLY_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/subscription/cancel`,
  });

  return c.json({ checkout_url: session.url, session_id: session.id });
});

// Webhook 처리
app.post('/subscription/webhook', async (c) => {
  const sig = c.req.header('stripe-signature')!;
  const body = await c.req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(subscription);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancel(subscription);
      break;
    }
  }

  return c.json({ received: true });
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await supabase
    .from('users')
    .update({
      subscription_tier: 'premium',
      subscription_started_at: new Date().toISOString(),
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_subscription_id: subscription.id,
    })
    .eq('stripe_customer_id', session.customer);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
  const isCanceled = subscription.cancel_at_period_end;

  await supabase
    .from('users')
    .update({
      subscription_expires_at: expiresAt,
      subscription_canceled_at: isCanceled ? new Date().toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionCancel(subscription: Stripe.Subscription) {
  await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_expires_at: null,
      stripe_subscription_id: null,
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

### 7.3 클라이언트 구현
```typescript
// src/hooks/useSubscription.ts
export function useSubscription(user: User | null) {
  const [isLoading, setIsLoading] = useState(false);

  const isPremium = user?.subscriptionTier === 'premium';
  const expiresAt = user?.subscriptionExpiresAt;

  const openCheckout = useCallback(async (plan: 'monthly' | 'yearly') => {
    setIsLoading(true);
    try {
      const response = await fetch(`${AUTH_SERVER_URL}/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ plan }),
      });

      const { checkout_url } = await response.json();

      // 외부 브라우저에서 열기
      window.electronAPI?.openExternal(checkout_url);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  const openPortal = useCallback(async () => {
    const response = await fetch(`${AUTH_SERVER_URL}/subscription/portal`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` },
    });
    const { portal_url } = await response.json();
    window.electronAPI?.openExternal(portal_url);
  }, [sessionToken]);

  return {
    isPremium,
    expiresAt,
    isLoading,
    openCheckout,
    openPortal,
  };
}
```

---

## 8. 동기화 로직

### 8.1 충돌 해결 전략
**Last Write Wins (LWW)** 방식 사용
- 단순하고 예측 가능
- updated_at 기준으로 최신 데이터 선택
- 동시 수정 시 나중에 수정한 쪽이 우선

```typescript
// 서버에서 충돌 해결
function resolveConflict(clientEvent: Event, serverEvent: Event): Event {
  const clientTime = new Date(clientEvent.updated_at).getTime();
  const serverTime = new Date(serverEvent.updated_at).getTime();

  return clientTime > serverTime ? clientEvent : serverEvent;
}
```

### 8.2 Soft Delete
삭제된 항목도 동기화를 위해 유지
```typescript
// 삭제 시
await supabase
  .from('events')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', eventId);

// 조회 시 (삭제된 항목도 포함 - 동기화용)
const { data } = await supabase
  .from('events')
  .select('*')
  .eq('user_id', userId)
  .gt('updated_at', lastSyncAt);

// 클라이언트에서 deleted_at이 있으면 로컬에서도 삭제
```

### 8.3 동기화 타이밍
| 이벤트 | 동기화 실행 |
|--------|------------|
| 앱 시작 | ✅ 자동 |
| 수동 새로고침 버튼 | ✅ |
| 이벤트 생성/수정/삭제 | ❌ (로컬만, 배치로 나중에) |
| 앱 포커스 복귀 | ✅ (5분 경과 시) |
| 앱 종료 | ✅ (pending 있으면) |

### 8.4 오프라인 지원
```typescript
// 네트워크 상태 감지
const isOnline = navigator.onLine;

// 오프라인 시
if (!isOnline) {
  // 로컬에만 저장
  await persistEvents(events);
  // pending 카운트 증가
  markPendingChange();
  return;
}

// 온라인 복귀 시
window.addEventListener('online', () => {
  if (pendingChanges > 0) {
    syncAll();
  }
});
```

---

## 9. 보안

### 9.1 토큰 관리
| 토큰 | 저장 위치 | 암호화 |
|------|----------|--------|
| Google Access Token | electron safeStorage | ✅ OS 수준 |
| Google Refresh Token | electron safeStorage | ✅ OS 수준 |
| Session Token | electron safeStorage | ✅ OS 수준 |

### 9.2 API 보안
- 모든 API는 HTTPS 사용
- Rate Limiting: 30초당 동기화 1회
- RLS로 다른 유저 데이터 접근 불가
- Stripe Webhook 서명 검증

### 9.3 CORS 설정
```typescript
app.use(cors({
  origin: ['http://localhost:5173', 'app://desktop-calendar'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## 10. 마이그레이션

### 10.1 기존 유저 데이터 마이그레이션
```
1. Premium 구독 시작
2. "로컬 데이터를 클라우드에 업로드하시겠습니까?" 확인
3. 확인 → 로컬 데이터 전체 업로드
4. 이후부터 양방향 동기화
```

### 10.2 마이그레이션 UI
```typescript
// 최초 Premium 전환 시 표시
function MigrationModal({ onConfirm, onSkip }) {
  return (
    <Modal>
      <h2>로컬 데이터 업로드</h2>
      <p>현재 저장된 {eventCount}개의 이벤트와 {memoCount}개의 메모를
         클라우드에 업로드합니다.</p>
      <p>이후 다른 기기에서도 접근할 수 있습니다.</p>
      <Button onClick={onConfirm}>업로드</Button>
      <Button variant="ghost" onClick={onSkip}>나중에</Button>
    </Modal>
  );
}
```

---

## 11. 테스트 계획

### 11.1 유닛 테스트
- [ ] 충돌 해결 로직 (LWW)
- [ ] 동기화 머지 로직
- [ ] 구독 상태 확인 로직

### 11.2 통합 테스트
- [ ] Google 로그인 → 세션 생성
- [ ] 이벤트 CRUD → 클라우드 동기화
- [ ] Stripe 결제 → 구독 활성화

### 11.3 E2E 테스트
| 시나리오 | 테스트 내용 |
|----------|------------|
| 신규 가입 | 로그인 → 무료 → 이벤트 생성 (로컬만) |
| Premium 전환 | 결제 → 로컬 데이터 업로드 → 동기화 확인 |
| 다중 기기 | PC1 이벤트 생성 → PC2에서 확인 |
| 오프라인 | 네트워크 끊김 → 로컬 수정 → 복귀 → 동기화 |
| 충돌 | 두 기기에서 동시 수정 → LWW 확인 |
| 구독 만료 | 만료 → 클라우드 기능 비활성화 → 로컬 유지 |

### 11.4 성능 테스트
- [ ] 1000개 이벤트 동기화 속도
- [ ] 동시 접속 10대 기기

---

## 12. 작업 일정 (세부 단계)

---

### Phase 1: Supabase 설정

#### Step 1.1: Supabase 프로젝트 생성
- [x] https://supabase.com 접속 및 로그인
- [x] New Project 생성 (이름: `desktop-calendar`)
- [x] Region 선택: Northeast Asia (Seoul) - ap-northeast-2
- [x] Database Password 설정 및 안전한 곳에 저장
- [x] 프로젝트 생성 완료 대기 (약 2분)

**확인 사항:**
- Project URL: `https://xxxxx.supabase.co`
- API Key (anon/public): 대시보드 → Settings → API
- API Key (service_role): 서버에서만 사용, 절대 클라이언트에 노출 금지

#### Step 1.2: DB 스키마 생성
- [x] SQL Editor 접속 (대시보드 → SQL Editor)
- [x] Step 1.2.1: `update_updated_at` 트리거 함수 생성
- [x] Step 1.2.2: `users` 테이블 생성
- [x] Step 1.2.3: `events` 테이블 생성
- [x] Step 1.2.4: `memos` 테이블 생성
- [x] Step 1.2.5: `user_settings` 테이블 생성
- [x] Step 1.2.6: 인덱스 생성
- [x] Step 1.2.7: 각 테이블에 updated_at 트리거 연결

**SQL 실행 순서:**
```sql
-- 1.2.1: 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.2.2: users 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  subscription_canceled_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1.2.3: events 테이블
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id TEXT,
  is_google_event BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_type TEXT DEFAULT 'none'
    CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval INT DEFAULT 1,
  repeat_end_date DATE,
  repeat_group_id TEXT,
  is_repeat_instance BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_minutes_before INT DEFAULT 30,
  is_d_day BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_user_local_id UNIQUE (user_id, local_id)
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_user_date ON events(user_id, date);
CREATE INDEX idx_events_user_updated ON events(user_id, updated_at);
CREATE INDEX idx_events_deleted ON events(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1.2.4: memos 테이블
CREATE TABLE memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_memo_user_local_id UNIQUE (user_id, local_id)
);

CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_user_updated ON memos(user_id, updated_at);

CREATE TRIGGER memos_updated_at
  BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1.2.5: user_settings 테이블
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{
    "opacity": 0.95,
    "alwaysOnTop": false,
    "desktopMode": false,
    "theme": "dark",
    "accentColor": "blue",
    "fontSize": 14,
    "resizeMode": true,
    "showHolidays": true,
    "showAdjacentMonths": true,
    "showGridLines": true,
    "hiddenDays": [],
    "schedulePanelPosition": "right",
    "showEventDots": false,
    "autoBackup": true,
    "showOverdueTasks": true,
    "weekStartDay": 0
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1.2.6: repeat_instance_states 테이블 (반복 인스턴스 완료 상태)
CREATE TABLE repeat_instance_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  instance_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_instance_state UNIQUE (user_id, event_id, instance_date)
);

CREATE INDEX idx_repeat_states_user ON repeat_instance_states(user_id);
CREATE INDEX idx_repeat_states_event ON repeat_instance_states(user_id, event_id);

CREATE TRIGGER repeat_instance_states_updated_at
  BEFORE UPDATE ON repeat_instance_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### Step 1.3: RLS (Row Level Security) 설정
- [x] Step 1.3.1: 모든 테이블에 RLS 활성화
- [x] Step 1.3.2: users 테이블 정책 생성
- [x] Step 1.3.3: events 테이블 정책 생성
- [x] Step 1.3.4: memos 테이블 정책 생성
- [x] Step 1.3.5: user_settings 테이블 정책 생성
- [x] Step 1.3.6: repeat_instance_states 테이블 정책 생성

**SQL:**
```sql
-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeat_instance_states ENABLE ROW LEVEL SECURITY;

-- users 정책 (서버에서 service_role로 접근하므로 기본 허용)
CREATE POLICY "Allow service role full access to users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- events 정책
CREATE POLICY "Allow service role full access to events"
  ON events FOR ALL
  USING (true)
  WITH CHECK (true);

-- memos 정책
CREATE POLICY "Allow service role full access to memos"
  ON memos FOR ALL
  USING (true)
  WITH CHECK (true);

-- user_settings 정책
CREATE POLICY "Allow service role full access to user_settings"
  ON user_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- repeat_instance_states 정책
CREATE POLICY "Allow service role full access to repeat_instance_states"
  ON repeat_instance_states FOR ALL
  USING (true)
  WITH CHECK (true);
```

**참고:** 서버에서 `service_role` 키를 사용하므로 RLS를 우회함. 클라이언트 직접 접근 시에는 더 엄격한 정책 필요.

#### Step 1.4: 환경 변수 설정
- [x] Step 1.4.1: 서버 `.env` 파일에 Supabase 정보 추가
- [x] Step 1.4.2: 연결 테스트

**서버 `.env` 추가 내용:**
```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # service_role key (절대 노출 금지)
```

#### Step 1.5: 테이블 확인 및 테스트
- [x] Supabase 대시보드 → Table Editor에서 테이블 확인
- [x] 테스트 데이터 삽입 시도
- [x] RLS 동작 확인

**Phase 1 완료 체크리스트:**
- [x] 5개 테이블 생성 완료 (users, events, memos, user_settings, repeat_instance_states)
- [x] 모든 인덱스 생성 완료
- [x] 모든 트리거 연결 완료
- [x] RLS 활성화 및 정책 설정 완료
- [x] 환경 변수 설정 완료

---

### Phase 2: Auth Server 수정

#### Step 2.1: Supabase 클라이언트 설정
- [x] Step 2.1.1: `@supabase/supabase-js` 패키지 설치
- [x] Step 2.1.2: `src/lib/supabase.ts` 파일 생성 (index.ts에 통합)
- [x] Step 2.1.3: Supabase 클라이언트 초기화 코드 작성
- [x] Step 2.1.4: 연결 테스트

**파일: `server/src/lib/supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

#### Step 2.2: 유저 관리 함수 작성
- [x] Step 2.2.1: `src/services/userService.ts` 생성 (index.ts에 통합)
- [x] Step 2.2.2: `findOrCreateUser(email, displayName, avatarUrl)` 함수
- [x] Step 2.2.3: `getUserById(id)` 함수
- [x] Step 2.2.4: `updateUserProfile(id, updates)` 함수
- [x] Step 2.2.5: `updateLastLogin(id)` 함수

#### Step 2.3: 세션 토큰 시스템 구현
- [x] Step 2.3.1: JWT 토큰 생성/검증 유틸리티 (`src/lib/jwt.ts`) (index.ts에 통합)
- [x] Step 2.3.2: `jsonwebtoken` 패키지 설치
- [x] Step 2.3.3: `generateSessionToken(userId)` 함수
- [x] Step 2.3.4: `verifySessionToken(token)` 함수
- [x] Step 2.3.5: 토큰 만료 시간 설정 (7일)

**파일: `server/src/lib/jwt.ts`**
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateSessionToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
```

#### Step 2.4: 인증 미들웨어 작성
- [x] Step 2.4.1: `src/middleware/auth.ts` 생성 (index.ts에 통합)
- [x] Step 2.4.2: `requireAuth` 미들웨어 (세션 토큰 검증)
- [x] Step 2.4.3: `requirePremium` 미들웨어 (Premium 구독 확인)
- [x] Step 2.4.4: 미들웨어 테스트

**파일: `server/src/middleware/auth.ts`**
```typescript
import { Context, Next } from 'hono';
import { verifySessionToken } from '../lib/jwt';
import { getUserById } from '../services/userService';

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = verifySessionToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  c.set('user', user);
  await next();
}

export async function requirePremium(c: Context, next: Next) {
  const user = c.get('user');
  if (user.subscription_tier !== 'premium') {
    return c.json({
      error: 'Premium subscription required',
      code: 'PREMIUM_REQUIRED'
    }, 403);
  }

  // 구독 만료 체크
  if (user.subscription_expires_at) {
    const expiresAt = new Date(user.subscription_expires_at);
    if (expiresAt < new Date()) {
      return c.json({
        error: 'Subscription expired',
        code: 'SUBSCRIPTION_EXPIRED'
      }, 403);
    }
  }

  await next();
}
```

#### Step 2.5: Auth 엔드포인트 구현
- [x] Step 2.5.1: `POST /auth/session` - Google 토큰으로 세션 생성
- [x] Step 2.5.2: `DELETE /auth/session` - 로그아웃
- [x] Step 2.5.3: `GET /auth/session` - 세션 상태 확인

**파일: `server/src/routes/auth.ts`**
```typescript
import { Hono } from 'hono';
import { findOrCreateUser, updateLastLogin } from '../services/userService';
import { generateSessionToken } from '../lib/jwt';

const auth = new Hono();

// Google 토큰으로 세션 생성
auth.post('/session', async (c) => {
  const { google_access_token, google_id_token } = await c.req.json();

  // Google ID 토큰 검증 및 사용자 정보 추출
  const googleUser = await verifyGoogleToken(google_id_token);
  if (!googleUser) {
    return c.json({ error: 'Invalid Google token' }, 401);
  }

  // DB에서 유저 찾거나 생성
  const user = await findOrCreateUser(
    googleUser.email,
    googleUser.name,
    googleUser.picture
  );

  // 마지막 로그인 시간 업데이트
  await updateLastLogin(user.id);

  // 세션 토큰 생성
  const sessionToken = generateSessionToken({
    userId: user.id,
    email: user.email,
  });

  return c.json({
    session_token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      subscription_tier: user.subscription_tier,
      subscription_expires_at: user.subscription_expires_at,
    },
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

export default auth;
```

#### Step 2.6: User 엔드포인트 구현
- [x] Step 2.6.1: `GET /user/profile` - 프로필 조회
- [x] Step 2.6.2: `PATCH /user/profile` - 프로필 수정

#### Step 2.7: Sync 엔드포인트 구현
- [x] Step 2.7.1: `src/services/syncService.ts` 생성 (index.ts에 통합)
- [x] Step 2.7.2: `POST /sync/events` - 이벤트 동기화
- [x] Step 2.7.3: `POST /sync/memos` - 메모 동기화
- [x] Step 2.7.4: `POST /sync/settings` - 설정 동기화
- [x] Step 2.7.5: `POST /sync/all` - 전체 동기화
- [x] Step 2.7.6: `GET /sync/status` - 동기화 상태 조회

**파일: `server/src/routes/sync.ts`**
```typescript
import { Hono } from 'hono';
import { requireAuth, requirePremium } from '../middleware/auth';
import { syncEvents, syncMemos, syncSettings } from '../services/syncService';

const sync = new Hono();

// 모든 동기화 엔드포인트는 인증 + Premium 필요
sync.use('/*', requireAuth, requirePremium);

// 이벤트 동기화
sync.post('/events', async (c) => {
  const user = c.get('user');
  const { events, last_sync_at } = await c.req.json();

  const result = await syncEvents(user.id, events, last_sync_at);
  return c.json(result);
});

// 메모 동기화
sync.post('/memos', async (c) => {
  const user = c.get('user');
  const { memos, last_sync_at } = await c.req.json();

  const result = await syncMemos(user.id, memos, last_sync_at);
  return c.json(result);
});

// 전체 동기화
sync.post('/all', async (c) => {
  const user = c.get('user');
  const { events, memos, settings, repeat_instance_states, last_sync_at } = await c.req.json();

  const eventsResult = await syncEvents(user.id, events, last_sync_at);
  const memosResult = await syncMemos(user.id, memos, last_sync_at);
  // ... settings, repeat_instance_states도 동기화

  return c.json({
    events: eventsResult.events,
    memos: memosResult.memos,
    synced_at: new Date().toISOString(),
  });
});

export default sync;
```

#### Step 2.8: 동기화 서비스 구현
- [x] Step 2.8.1: `syncEvents` 함수 - LWW 방식 충돌 해결
- [x] Step 2.8.2: `syncMemos` 함수
- [x] Step 2.8.3: `syncSettings` 함수
- [x] Step 2.8.4: `syncRepeatInstanceStates` 함수

**파일: `server/src/services/syncService.ts`**
```typescript
import { supabase } from '../lib/supabase';

interface SyncEvent {
  local_id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color?: string;
  completed?: boolean;
  repeat_type?: string;
  repeat_interval?: number;
  repeat_end_date?: string;
  is_d_day?: boolean;
  updated_at: string;
  deleted?: boolean;
}

export async function syncEvents(
  userId: string,
  clientEvents: SyncEvent[],
  lastSyncAt: string | null
) {
  const syncedAt = new Date().toISOString();

  // 1. 클라이언트 이벤트를 DB에 upsert (LWW)
  for (const event of clientEvents) {
    if (event.deleted) {
      // Soft delete
      await supabase
        .from('events')
        .update({ deleted_at: syncedAt, updated_at: syncedAt })
        .eq('user_id', userId)
        .eq('local_id', event.local_id);
    } else {
      // Upsert with conflict resolution
      await supabase
        .from('events')
        .upsert({
          user_id: userId,
          local_id: event.local_id,
          title: event.title,
          date: event.date,
          time: event.time,
          description: event.description,
          color: event.color,
          completed: event.completed,
          repeat_type: event.repeat_type,
          repeat_interval: event.repeat_interval,
          repeat_end_date: event.repeat_end_date,
          is_d_day: event.is_d_day,
          updated_at: event.updated_at,
        }, {
          onConflict: 'user_id,local_id',
          ignoreDuplicates: false,
        });
    }
  }

  // 2. lastSyncAt 이후 변경된 서버 이벤트 조회
  let query = supabase
    .from('events')
    .select('*')
    .eq('user_id', userId);

  if (lastSyncAt) {
    query = query.gt('updated_at', lastSyncAt);
  }

  const { data: serverEvents } = await query;

  return {
    events: serverEvents || [],
    synced_at: syncedAt,
  };
}
```

#### Step 2.9: 라우터 통합 및 테스트
- [x] Step 2.9.1: `src/index.ts`에 새 라우터 등록
- [x] Step 2.9.2: 각 엔드포인트 수동 테스트
- [x] Step 2.9.3: 에러 핸들링 확인

**Phase 2 완료 체크리스트:**
- [x] Supabase 클라이언트 연동 완료
- [x] JWT 세션 토큰 시스템 구현 완료
- [x] 인증 미들웨어 구현 완료
- [x] `/auth/*` 엔드포인트 구현 완료
- [x] `/user/*` 엔드포인트 구현 완료
- [x] `/sync/*` 엔드포인트 구현 완료
- [x] 동기화 서비스 (LWW) 구현 완료

---

### Phase 3: 클라이언트 수정

#### Step 3.1: 타입 정의 추가
- [x] Step 3.1.1: `src/types/index.ts`에 User, AuthState, SyncState 타입 추가
- [x] Step 3.1.2: ElectronAPI 인터페이스에 세션 관련 메서드 추가

**추가할 타입:**
```typescript
// User
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiresAt: string | null;
}

// Auth State
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  sessionToken: string | null;
}

// Sync State
export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  pendingChanges: number;
}

// ElectronAPI 추가
interface ElectronAPI {
  // ... 기존 메서드들 ...

  // 세션 토큰 관리
  saveSessionToken: (token: string) => Promise<boolean>;
  getSessionToken: () => Promise<string | null>;
  deleteSessionToken: () => Promise<boolean>;
}
```

#### Step 3.2: Electron IPC 핸들러 추가
- [x] Step 3.2.1: `electron/ipcHandlers.ts`에 세션 토큰 저장/조회/삭제 핸들러 추가
- [x] Step 3.2.2: `electron/preload.ts`에 API 노출
- [x] Step 3.2.3: safeStorage를 사용한 암호화 저장

**파일: `electron/ipcHandlers.ts` 추가**
```typescript
import { safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';

// 세션 토큰 저장 경로
function getSessionTokenPath(): string {
  return path.join(app.getPath('userData'), 'session-token.enc');
}

// 세션 토큰 저장 (암호화)
ipcMain.handle('save-session-token', async (_, token: string) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(getSessionTokenPath(), encrypted);
    } else {
      // 암호화 불가 시 평문 저장 (개발 환경)
      fs.writeFileSync(getSessionTokenPath(), token);
    }
    return true;
  } catch (error) {
    console.error('Failed to save session token:', error);
    return false;
  }
});

// 세션 토큰 조회 (복호화)
ipcMain.handle('get-session-token', async () => {
  try {
    const tokenPath = getSessionTokenPath();
    if (!fs.existsSync(tokenPath)) return null;

    const data = fs.readFileSync(tokenPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data);
    }
    return data.toString();
  } catch (error) {
    console.error('Failed to get session token:', error);
    return null;
  }
});

// 세션 토큰 삭제
ipcMain.handle('delete-session-token', async () => {
  try {
    const tokenPath = getSessionTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete session token:', error);
    return false;
  }
});
```

#### Step 3.3: AuthContext 구현
- [x] Step 3.3.1: `src/contexts/AuthContext.tsx` 생성
- [x] Step 3.3.2: AuthProvider 컴포넌트 구현
- [x] Step 3.3.3: useAuth 훅 구현
- [x] Step 3.3.4: main.tsx에 AuthProvider 래핑

**파일: `src/contexts/AuthContext.tsx`**
```typescript
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, AuthState } from '../types';

const AUTH_SERVER_URL = 'http://localhost:3001'; // 환경변수로 대체 예정

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    sessionToken: null,
  });

  // 앱 시작 시 저장된 세션 확인
  useEffect(() => {
    checkStoredSession();
  }, []);

  const checkStoredSession = async () => {
    try {
      if (!window.electronAPI?.getSessionToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const sessionToken = await window.electronAPI.getSessionToken();
      if (!sessionToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // 서버에서 세션 유효성 확인
      const response = await fetch(`${AUTH_SERVER_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const user = await response.json();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          sessionToken,
        });
      } else {
        // 세션 만료 - 삭제
        await window.electronAPI.deleteSessionToken();
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async () => {
    // 1. 기존 Google 로그인 사용
    const googleResult = await window.electronAPI?.googleAuthLogin();
    if (!googleResult?.success) {
      throw new Error('Google login failed');
    }

    // 2. 서버에서 세션 토큰 발급
    // ... (기존 계획서 참조)
  }, []);

  const logout = useCallback(async () => {
    await window.electronAPI?.deleteSessionToken();
    await window.electronAPI?.googleAuthLogout();
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      sessionToken: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser: checkStoredSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### Step 3.4: useCloudSync 훅 구현
- [x] Step 3.4.1: `src/hooks/useCloudSync.ts` 생성
- [x] Step 3.4.2: syncAll 함수 구현
- [x] Step 3.4.3: 동기화 상태 관리 (isSyncing, lastSyncAt, syncError)
- [ ] Step 3.4.4: 오프라인 감지 및 대기열 관리 (추후 구현)

#### Step 3.5: useSubscription 훅 구현
- [x] Step 3.5.1: `src/hooks/useSubscription.ts` 생성
- [x] Step 3.5.2: isPremium 상태 관리
- [x] Step 3.5.3: upgradeToPremium, cancelSubscription 함수 구현 (Phase 4에서 완성)

#### Step 3.6: useEvents 수정 (추후 구현)
- [ ] Step 3.6.1: cloudSync 연동 추가
- [ ] Step 3.6.2: 이벤트 변경 시 pendingChange 마킹
- [ ] Step 3.6.3: 서버 데이터와 로컬 데이터 머지 로직

#### Step 3.7: 로그인/로그아웃 UI 구현
- [x] Step 3.7.1: Settings 패널에 Account 섹션 추가 (로그인/로그아웃)
- [x] Step 3.7.2: Premium 뱃지 표시
- [x] Step 3.7.3: Cloud Sync 상태 표시 및 Upgrade 버튼

#### Step 3.8: 동기화 상태 UI 구현
- [x] Step 3.8.1: TitleBar에 클라우드 동기화 상태 아이콘 추가
- [ ] Step 3.8.2: 동기화 중 스피너 표시 (추후 구현)
- [ ] Step 3.8.3: 마지막 동기화 시간 표시 (추후 구현)
- [ ] Step 3.8.4: 동기화 오류 표시 (추후 구현)

**Phase 3 완료 체크리스트:**
- [x] 타입 정의 추가 완료
- [x] Electron IPC 핸들러 추가 완료
- [x] AuthContext 및 useAuth 훅 구현 완료
- [x] useCloudSync 훅 구현 완료
- [x] useSubscription 훅 구현 완료
- [ ] useEvents 클라우드 연동 (추후 구현)
- [x] 로그인/로그아웃 UI 구현 완료
- [x] 동기화 상태 UI 기본 구현 완료

---

### Phase 4: Stripe 연동

#### Step 4.1: Stripe 계정 설정
- [ ] Step 4.1.1: https://stripe.com 계정 생성/로그인
- [ ] Step 4.1.2: 테스트 모드 활성화 확인
- [ ] Step 4.1.3: API 키 확인 (Dashboard → Developers → API keys)
  - Publishable key: `pk_test_...`
  - Secret key: `sk_test_...`

#### Step 4.2: Product 및 Price 생성
- [ ] Step 4.2.1: Dashboard → Products → Add product
- [ ] Step 4.2.2: Product 생성
  - Name: "Desktop Calendar Premium"
  - Description: "클라우드 동기화, 다중 기기 지원"
- [ ] Step 4.2.3: Monthly Price 생성
  - Price: $4.99/month (또는 ₩4,900)
  - Billing period: Monthly
  - Price ID 저장: `price_monthly_xxx`
- [ ] Step 4.2.4: Yearly Price 생성
  - Price: $39.99/year (또는 ₩39,900)
  - Billing period: Yearly
  - Price ID 저장: `price_yearly_xxx`

#### Step 4.3: 서버 환경 변수 추가
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_MONTHLY_PRICE_ID=price_xxx
STRIPE_YEARLY_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx  # Step 4.6에서 생성
```

#### Step 4.4: Stripe 라이브러리 설치 및 설정
- [ ] Step 4.4.1: `npm install stripe` (서버)
- [ ] Step 4.4.2: `src/lib/stripe.ts` 생성

**파일: `server/src/lib/stripe.ts`**
```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});
```

#### Step 4.5: Subscription 엔드포인트 구현
- [x] Step 4.5.1: 엔드포인트 스텁 생성 (index.ts에 추가)
- [x] Step 4.5.2: `GET /subscription/status` - 구독 상태 조회 (완전 구현 - DB만 사용)
- [x] Step 4.5.3: `POST /subscription/checkout` - Checkout 세션 스텁 (TODO: Stripe 연동)
- [x] Step 4.5.4: `POST /subscription/portal` - 고객 포털 스텁 (TODO: Stripe 연동)
- [x] Step 4.5.5: `POST /subscription/cancel` - 구독 취소 스텁 (TODO: Stripe 연동)
- [x] Step 4.5.6: `POST /subscription/reactivate` - 구독 재활성화 스텁 (TODO: Stripe 연동)
- [x] Step 4.5.7: `POST /subscription/webhook` - Stripe 웹훅 스텁 (TODO: Stripe 연동)

#### Step 4.6: Webhook 설정
- [ ] Step 4.6.1: Stripe Dashboard → Developers → Webhooks
- [ ] Step 4.6.2: Add endpoint: `https://your-server.com/subscription/webhook`
- [ ] Step 4.6.3: 이벤트 선택:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Step 4.6.4: Webhook signing secret 저장
- [ ] Step 4.6.5: `POST /subscription/webhook` 엔드포인트 구현

#### Step 4.7: 클라이언트 구독 UI 구현
- [ ] Step 4.7.1: `src/components/Subscription/UpgradeModal.tsx` 생성
- [ ] Step 4.7.2: `src/components/Subscription/PlanBadge.tsx` 생성
- [ ] Step 4.7.3: `src/components/Subscription/ManageSubscription.tsx` 생성
- [ ] Step 4.7.4: Settings에 구독 관리 섹션 추가

#### Step 4.8: 결제 테스트
- [ ] Step 4.8.1: 테스트 카드로 결제 테스트
  - 성공: `4242 4242 4242 4242`
  - 실패: `4000 0000 0000 0002`
- [ ] Step 4.8.2: Webhook 수신 확인
- [ ] Step 4.8.3: DB 구독 상태 업데이트 확인
- [ ] Step 4.8.4: 앱에서 Premium 기능 활성화 확인

**Phase 4 완료 체크리스트:**
- [ ] Stripe 계정 및 Product/Price 설정 완료
- [ ] Checkout 세션 생성 구현 완료
- [ ] Webhook 처리 구현 완료
- [ ] 고객 포털 연동 완료
- [ ] 클라이언트 구독 UI 구현 완료
- [ ] 결제 테스트 완료

---

### Phase 5: 통합 테스트 및 배포 준비

#### Step 5.1: 통합 테스트
- [ ] Step 5.1.1: 신규 가입 플로우 테스트
- [ ] Step 5.1.2: 로그인/로그아웃 테스트
- [ ] Step 5.1.3: Free 유저 기능 제한 테스트
- [ ] Step 5.1.4: Premium 결제 → 기능 활성화 테스트
- [ ] Step 5.1.5: 클라우드 동기화 테스트 (이벤트, 메모, 설정)
- [ ] Step 5.1.6: 다중 기기 동기화 테스트
- [ ] Step 5.1.7: 오프라인 → 온라인 동기화 테스트

#### Step 5.2: 버그 수정 및 최적화
- [ ] Step 5.2.1: 발견된 버그 수정
- [ ] Step 5.2.2: 성능 최적화 (대량 데이터 동기화)
- [ ] Step 5.2.3: 에러 메시지 개선
- [ ] Step 5.2.4: 로딩 상태 UX 개선

#### Step 5.3: 배포 준비
- [ ] Step 5.3.1: 환경 변수 프로덕션 값으로 변경
- [ ] Step 5.3.2: Stripe 라이브 모드 전환
- [ ] Step 5.3.3: 서버 배포 (Cloudflare Workers 또는 기타)
- [ ] Step 5.3.4: Supabase 프로덕션 설정 확인

**총 예상: 8-11일**

---

## 13. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Supabase 무료 한도 초과 | 낮음 | 중간 | 유료 플랜 전환 또는 자체 DB |
| 동기화 충돌 데이터 손실 | 중간 | 높음 | 충돌 시 양쪽 모두 보관 옵션 |
| Stripe 한국 결제 이슈 | 낮음 | 높음 | PayPal 대체 결제 추가 |
| 오프라인 장기 사용 후 대량 충돌 | 낮음 | 중간 | 수동 머지 UI 제공 |

---

## 체크리스트: 구현 전 완료할 것

- [ ] 기존 기능 버그 수정 완료
- [ ] 기존 기능 테스트 완료
- [ ] Supabase 계정 생성
- [ ] Stripe 계정 생성
- [ ] 가격 정책 결정 (월/연 가격)
