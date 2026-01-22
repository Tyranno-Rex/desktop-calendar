# Desktop Calendar

Windows 바탕화면에 임베딩되는 투명 캘린더 앱 (Electron + React + TypeScript)

## 기능

- 바탕화면 아이콘 뒤에 표시되는 Desktop Mode
- Google Calendar 연동 (PKCE OAuth 2.0)
- 투명도, 테마, 폰트 크기 조절
- 일정 추가/수정/삭제
- 시스템 트레이 지원

## 개발 환경 설정

### 필수 요구사항

- Node.js 18+ (권장: 20.x 또는 22.x)
- npm 또는 yarn

### 설치

```bash
npm install
```

### Google Calendar 연동 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성 (데스크톱 앱 유형)
3. `env/.env` 파일 생성:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## 빌드 명령어

### 개발 모드

```bash
npm run electron:dev
```

### 프로덕션 미리보기

```bash
npm run electron:preview
```

### 릴리즈 빌드

```bash
npm run electron:build
```

빌드 결과물:
- `release/Desktop Calendar Setup 1.0.0.exe` - 설치 프로그램
- `release/Desktop Calendar 1.0.0.exe` - 포터블 버전

---

## 빌드 문제 해결

### ELECTRON_RUN_AS_NODE 환경 변수 문제

#### 증상

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
TypeError: Cannot read properties of undefined (reading 'app')
```

`require('electron')`이 Electron API 객체 대신 실행 파일 경로 문자열을 반환하는 경우.

#### 원인

시스템에 `ELECTRON_RUN_AS_NODE=1` 환경 변수가 설정되어 있으면 Electron이 일반 Node.js처럼 동작합니다.

#### 확인 방법

```bash
# Windows PowerShell
echo $env:ELECTRON_RUN_AS_NODE

# Git Bash / WSL
echo $ELECTRON_RUN_AS_NODE
```

값이 `1`이면 문제의 원인입니다.

#### 해결 방법

**방법 1: Windows 환경 변수 GUI에서 삭제**

1. Windows 검색 → "환경 변수" 검색 → "시스템 환경 변수 편집"
2. "환경 변수" 버튼 클릭
3. 사용자 변수 및 시스템 변수에서 `ELECTRON_RUN_AS_NODE` 찾아서 삭제
4. VS Code / 터미널 재시작

**방법 2: PowerShell에서 영구 삭제**

```powershell
# 사용자 변수에서 삭제
[Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "", "User")

# 시스템 변수에서 삭제 (관리자 권한 필요)
[Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "", "Machine")
```

**방법 3: 임시로 환경 변수 무시하고 실행 (Git Bash)**

```bash
env -u ELECTRON_RUN_AS_NODE npm run electron:preview
```

---

## 프로젝트 구조

```
desktop-calendar/
├── electron/           # Electron 메인 프로세스
│   ├── main.ts         # 메인 진입점
│   ├── preload.ts      # 프리로드 스크립트
│   ├── googleAuth.ts   # Google OAuth PKCE 인증
│   └── googleCalendar.ts # Google Calendar REST API
├── src/                # React 프론트엔드
│   ├── components/     # React 컴포넌트
│   ├── hooks/          # 커스텀 훅
│   └── types/          # TypeScript 타입 정의
├── env/                # 환경 변수
│   └── .env            # Google Client ID
├── dist/               # Vite 빌드 결과
├── dist-electron/      # TypeScript 컴파일 결과
└── release/            # electron-builder 결과
```

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite
- **Desktop**: Electron 33
- **Windows API**: koffi (FFI for native calls)
- **Animation**: Motion (Framer Motion)
- **Icons**: Lucide React
