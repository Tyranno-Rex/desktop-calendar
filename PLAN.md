# TDD 환경 구축 계획

## 현재 상태
- **클라이언트**: Vite + React + TypeScript (테스트 환경 없음)
- **서버**: Hono + TypeScript (테스트 환경 없음)
- 테스트 프레임워크, 설정 파일 모두 부재

---

## 1. 테스트 프레임워크 선택

### 클라이언트 (React)
- **Vitest** (Vite와 자연스러운 통합, Jest 호환 API)
- **React Testing Library** (컴포넌트 테스트)
- **MSW (Mock Service Worker)** (API 모킹)

### 서버 (Hono)
- **Vitest** (통일된 테스트 경험)
- **supertest** 스타일의 Hono 테스트 유틸리티

---

## 2. 테스트 범위 및 우선순위

### Phase 1: 핵심 유틸리티 (가장 먼저)
순수 함수들 - 의존성 없이 테스트 가능

**클라이언트**
- `src/utils/date.ts` - 날짜 유틸리티 함수들
  - `getLocalDateString`, `sortEventsByCompletion`, `getDDay`, `getTodayString` 등

**서버**
- `src/lib/utils.ts` - 유틸리티 함수들
- `src/routes/sync.ts` - 검증 함수들
  - `validateEventContent`, `validateMemoContent`, `validateSettings`
  - `checkPayloadSize`, `checkBatchSize`, `checkSyncCooldown`

### Phase 2: 서비스 레이어
비즈니스 로직 테스트 (DB 모킹 필요)

**서버**
- `src/services/sync.ts` - `upsertEvents`, `upsertMemos`
- `src/services/storage.ts` - `checkStorageLimit`, `countNewItems`
- `src/services/user.ts` - 사용자 관련 서비스

### Phase 3: API 엔드포인트
통합 테스트

**서버**
- `src/routes/sync.ts` - 동기화 API
- `src/routes/auth.ts` - 인증 API
- `src/routes/user.ts` - 사용자 API

### Phase 4: React Hooks
상태 관리 로직 테스트

**클라이언트**
- `src/hooks/useEvents.ts` - 이벤트 CRUD
- `src/hooks/useCloudSync.ts` - 클라우드 동기화
- `src/hooks/useSettings.ts` - 설정 관리

### Phase 5: 컴포넌트
UI 테스트

**클라이언트**
- `src/components/Calendar/` - 캘린더 렌더링
- `src/components/SchedulePanel/` - 일정 패널
- `src/components/Event/` - 이벤트 폼

---

## 3. 설치할 패키지

### 클라이언트
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

### 서버
```bash
npm install -D vitest @hono/node-server
```

---

## 4. 설정 파일

### 클라이언트: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
```

### 서버: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

---

## 5. 디렉토리 구조

### 클라이언트
```
src/
├── test/
│   ├── setup.ts           # 테스트 전역 설정
│   └── mocks/
│       └── handlers.ts    # MSW 핸들러
├── utils/
│   ├── date.ts
│   └── date.test.ts       # 같은 폴더에 테스트
├── hooks/
│   ├── useEvents.ts
│   └── useEvents.test.ts
└── components/
    └── Calendar/
        ├── Calendar.tsx
        └── Calendar.test.tsx
```

### 서버
```
src/
├── test/
│   ├── setup.ts           # 테스트 전역 설정
│   └── helpers.ts         # 테스트 유틸리티
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
├── services/
│   ├── sync.ts
│   └── sync.test.ts
└── routes/
    ├── sync.ts
    └── sync.test.ts
```

---

## 6. npm 스크립트

### 클라이언트 `package.json`
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 서버 `package.json`
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 7. 구현 순서

1. **클라이언트 Vitest 설치 및 설정**
2. **`date.ts` 테스트 작성** (첫 번째 테스트)
3. **서버 Vitest 설치 및 설정**
4. **`sync.ts` 검증 함수 테스트 작성**
5. **서비스 레이어 테스트** (DB 모킹)
6. **API 통합 테스트**
7. **React Hooks 테스트**
8. **컴포넌트 테스트**

---

## 8. 예상 테스트 케이스

### `date.ts` 예시
```typescript
describe('getLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(getLocalDateString(date)).toBe('2024-01-15');
  });
});

describe('getDDay', () => {
  it('returns D-day for today', () => {
    const today = new Date();
    expect(getDDay(getLocalDateString(today))).toBe('D-Day');
  });

  it('returns D-N for future dates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDDay(getLocalDateString(tomorrow))).toBe('D-1');
  });
});
```

### `sync.ts` 검증 함수 예시
```typescript
describe('validateEventContent', () => {
  it('passes for valid events', () => {
    const events = [{ title: 'Meeting', description: 'Team sync' }];
    expect(validateEventContent(events)).toEqual({ valid: true });
  });

  it('fails for title exceeding 50 chars', () => {
    const events = [{ title: 'a'.repeat(51) }];
    const result = validateEventContent(events);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('title too long');
  });
});

describe('checkSyncCooldown', () => {
  it('allows first request', () => {
    expect(checkSyncCooldown('new-user')).toEqual({ allowed: true });
  });
});
```

---

## 승인 후 진행할 작업

1. 클라이언트/서버에 vitest 및 관련 패키지 설치
2. vitest.config.ts 생성
3. 테스트 setup 파일 생성
4. Phase 1 테스트 코드 작성 (date.ts, sync 검증 함수)
5. package.json에 test 스크립트 추가
