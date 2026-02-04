# UI Style Guide - Desktop Calendar

> 최종 업데이트: 2026-02-04
> 이 문서는 UI 일관성을 유지하기 위한 디자인 원칙과 규칙을 정리합니다.

---

## 1. CSS 변수 시스템

### 1-1. 테마 색상 변수

모든 색상은 CSS 변수를 사용합니다. 하드코딩 금지.

```css
/* 배경 */
--bg-primary      /* 주 배경 */
--bg-secondary    /* 보조 배경 */
--bg-cell         /* 셀 배경 */
--bg-cell-hover   /* 셀 hover 배경 */

/* 텍스트 */
--text-color      /* 주 텍스트 */
--text-secondary  /* 보조 텍스트 */
--text-muted      /* 흐린 텍스트 */
--text-tertiary   /* 가장 흐린 텍스트 */

/* 기타 */
--border-color    /* 테두리 */
--weekend-color   /* 주말 텍스트 색상 */
--weekend-bg      /* 주말 배경 색상 */

/* 액센트 */
--accent-color    /* 주 강조색 */
--accent-hover    /* 강조색 hover */
--accent-light    /* 강조색 연한 버전 */
--accent-text     /* 강조 텍스트 */
```

### 1-2. Shadow 변수

모든 그림자는 정의된 변수를 사용합니다.

```css
--shadow-sm     /* 작은 그림자 - 배지, 작은 버튼 */
--shadow-md     /* 중간 그림자 - 카드, 드롭다운 */
--shadow-lg     /* 큰 그림자 - 패널 */
--shadow-float  /* 플로팅 요소 - 모달, 팝업 */
--shadow-inner  /* 내부 그림자 */
```

---

## 2. 크기 및 간격

### 2-1. Border Radius 스케일

**4단계 스케일만 사용:**

| 값 | 용도 | 예시 |
|----|------|------|
| `4px` | 작은 요소 | 배지, 태그, 작은 버튼 |
| `8px` | 중간 요소 | 버튼, 입력 필드, 드롭다운 |
| `12px` | 큰 요소 | 카드, 패널, 토글 |
| `16px` | 최대 요소 | 모달, 팝업 컨테이너 |

```css
/* 예시 */
.badge { border-radius: 4px; }
.button { border-radius: 8px; }
.card { border-radius: 12px; }
.modal { border-radius: 16px; }
```

### 2-2. 헤더/푸터 Padding

**통일 규칙: `16px 24px`**

```css
.any-header {
  padding: 16px 24px;  /* 세로 16px, 가로 24px */
}

.any-footer {
  padding: 16px 24px;
}
```

### 2-3. 스크롤 버튼

- 크기: `28px × 28px`
- border-radius: `4px`

---

## 3. Desktop Mode 대응

### 3-1. Hover/Active 클래스

Desktop Mode에서는 `:hover`, `:active`가 동작하지 않으므로 별도 클래스 필요.

**필수 패턴:**
```css
/* 항상 :hover와 .desktop-hover를 함께 정의 */
.button:hover,
.button.desktop-hover {
  background: var(--bg-cell-hover);
}

.button:active,
.button.desktop-active {
  transform: scale(0.95);
}
```

**적용 대상:**
- 모든 버튼 (`.btn`, `.nav-btn`, `.close-btn` 등)
- 클릭 가능한 아이템 (`.schedule-item`, `.event-item` 등)
- 드롭다운 아이템
- 체크박스
- 토글

---

## 4. Glassmorphism 패턴

### 4-1. Light Theme
```css
.app.light .element {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

### 4-2. Dark Theme
```css
.app.dark .element {
  background: rgba(44, 44, 46, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

### 4-3. 강도 변형

| 강도 | 배경 투명도 | blur | 용도 |
|------|------------|------|------|
| Soft | 0.5 | 20px | Title Bar |
| Normal | 0.72 | 20px | Header, Panel |
| Strong | 0.88 | 40px | Modal, Settings |

---

## 5. 언어 규칙

### UI 텍스트는 영어 사용

| 잘못된 예 | 올바른 예 |
|----------|----------|
| 새 메모장 | New Memo |
| 삭제 | Delete |
| 저장 | Save |
| 취소 | Cancel |

**예외:** 사용자 입력 데이터, 날짜 포맷 (locale에 따름)

---

## 6. 파일 구조 규칙

### 6-1. CSS 파일 위치
```
src/
├── styles/
│   └── theme.css             // 공통 테마 변수 (App, Popup 공유)
├── components/
│   ├── ComponentName/
│   │   ├── ComponentName.tsx
│   │   └── ComponentName.css // 컴포넌트별 CSS
│   └── shared/               // 공통 스타일 (향후)
│       ├── form.css
│       ├── dropdown.css
│       └── glass.css
```

### 6-2. CSS 변수 정의 위치

| 변수 종류 | 정의 위치 |
|----------|----------|
| 테마 색상, Shadow | `src/styles/theme.css` (공통) |
| App 전용 스타일 | `App.css` |
| Popup 컨테이너 스타일 | `Popup.css` (변수는 theme.css에서 import) |

**사용 방법:**
```css
/* App.css */
@import './styles/theme.css';

/* Popup.css */
@import '../../styles/theme.css';
```

---

## 7. 체크리스트

새 컴포넌트 또는 스타일 추가 시:

- [ ] 색상에 CSS 변수 사용했는가?
- [ ] Shadow에 `--shadow-*` 변수 사용했는가?
- [ ] border-radius가 4/8/12/16px 중 하나인가?
- [ ] `.desktop-hover`, `.desktop-active` 클래스 추가했는가?
- [ ] 헤더/푸터 padding이 `16px 24px`인가?
- [ ] UI 텍스트가 영어인가?

---

## 8. 수정 이력

| 날짜 | 항목 |
|------|------|
| 2026-02-04 | 초안 작성 |
| 2026-02-04 | border-radius 스케일 확정 (4/8/12/16px) |
| 2026-02-04 | 헤더/푸터 padding 통일 (16px 24px) |
| 2026-02-04 | Desktop Mode hover/active 규칙 추가 |
| 2026-02-04 | Shadow 변수 사용 규칙 추가 |
| 2026-02-04 | 테마 변수 파일 분리 (`src/styles/theme.css`) |
