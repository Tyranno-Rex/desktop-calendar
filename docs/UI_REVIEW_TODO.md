# UI 검토 결과 - 수정 필요 항목

> 검토일: 2026-02-04
> 수정 완료된 항목은 삭제할 것

---

## 1. Desktop 모드 hover/active 상태 누락

Desktop 모드에서는 `:hover`가 동작하지 않아 `.desktop-hover`/`.desktop-active` 클래스가 필요함.

### 누락된 곳:

| 파일 | 선택자 | 라인 |
|------|--------|------|
| `src/components/SchedulePanel/SchedulePanel.css` | `.schedule-close:hover` | 93 |
| `src/components/Calendar/WeekView.css` | `.week-day-header:hover` | 38 |
| `src/components/Calendar/WeekView.css` | `.week-allday-event:hover` | 136 |
| `src/components/Calendar/WeekView.css` | `.week-allday-more:hover` | 154 |
| `src/components/Calendar/WeekView.css` | `.week-event:hover` | 253 |
| `src/components/Calendar/WeekView.css` | `.week-scroll-btn:hover` | 325 |
| `src/components/Calendar/DayView.css` | `.day-allday-event:hover` | 115 |
| `src/components/Calendar/DayView.css` | `.day-allday-more:hover` | 131 |
| `src/components/Calendar/DayView.css` | `.day-event:hover` | 224 |
| `src/components/Calendar/DayView.css` | `.day-scroll-btn:hover` | 298 |
| `src/components/TitleBar/TitleBar.css` | `.memo-dropdown-item:hover` (있는지 확인 필요) | - |

---

## 2. CSS 변수 이름 불일치

### Memo.css - 존재하지 않는 변수 사용

| 파일 | 라인 | 잘못된 변수 | 올바른 변수 |
|------|------|-------------|-------------|
| `src/components/Memo/Memo.css` | 44 | `--text-primary` | `--text-color` |
| `src/components/Memo/Memo.css` | 65 | `--bg-hover` | `--bg-cell-hover` |
| `src/components/Memo/Memo.css` | 67 | `--text-primary` | `--text-color` |
| `src/components/Memo/Memo.css` | 84 | `--text-primary` | `--text-color` |

---

## 3. 하드코딩된 색상값

CSS 변수 대신 직접 rgba 값을 사용한 곳들.

| 파일 | 라인 | 하드코딩 값 | 권장 변수 |
|------|------|-------------|-----------|
| `src/components/Calendar/Calendar.css` | 112, 119 | `rgba(118, 118, 128, 0.12)` | `--bg-cell-hover` |
| `src/components/Calendar/Calendar.css` | 154 | `rgba(118, 118, 128, 0.12)` | `--bg-cell-hover` |
| `src/components/Calendar/Calendar.css` | 224 | `rgba(118, 118, 128, 0.12)` | `--bg-cell-hover` |
| `src/components/Calendar/WeekView.css` | 118, 226 | `rgba(239, 68, 68, 0.02)` | 주말 배경용 변수 생성 권장 |
| `src/components/Calendar/DayView.css` | 99, 197 | `rgba(239, 68, 68, 0.02)` | 주말 배경용 변수 생성 권장 |

---

## 4. Shadow 변수 미사용

App.css에 정의된 shadow 변수들이 있지만 대부분 인라인으로 사용됨.

### 정의된 변수 (App.css):
```css
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.08);
--shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.12);
--shadow-lg: 0 10px 40px -10px rgb(0 0 0 / 0.15), 0 4px 16px -4px rgb(0 0 0 / 0.08);
--shadow-float: 0 20px 60px -15px rgb(0 0 0 / 0.15), 0 8px 24px -8px rgb(0 0 0 / 0.1);
--shadow-inner: inset 0 1px 0 rgba(255, 255, 255, 0.8);
```

### 인라인 shadow 사용 위치 (예시):
- `Calendar.css:350` - `box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.1)`
- `SchedulePanel.css:136-138` - 복잡한 인라인 shadow
- `Popup.css` 전반 - 모든 shadow가 인라인

---

## 5. 코드 중복

### 5-1. Popup.css와 Event.css (중복도 ~60%)

동일한 스타일:
- `.popup-input`, `.popup-btn`, `.popup-label`
- `.time-dropdown`, `.time-dropdown-item`
- `.repeat-dropdown`, `.repeat-dropdown-item`
- `.icon-btn`, `.icon-btn-dropdown`
- `.toggle-switch`, `.toggle-knob`

**제안**: 공통 스타일을 `shared/form.css` 또는 `shared/controls.css`로 추출

### 5-2. WeekView.css와 DayView.css (중복도 ~70%)

동일한 스타일:
- 시간 그리드 (`time-column`, `time-slot`, `time-label`)
- 스크롤 버튼 (`scroll-btn`, `scroll-buttons`)
- 이벤트 블록 (`event`, `event-time`, `event-title`)
- 현재 시간 라인 (`current-time-line`, `current-time-dot`)
- allday 섹션 (`allday-section`, `allday-event`)

**제안**: `shared/time-grid.css`로 추출

### 5-3. 테마 변수 중복 (App.css vs Popup.css)

Popup.css 1-75라인에서 App.css의 테마 변수를 모두 재정의.
- 이유: Popup은 별도 Electron 창이라 `.app` 클래스 스코프 없음
- **제안**: `shared/theme-variables.css` 분리 후 양쪽에서 import

### 5-4. Glassmorphism 패턴 반복

다음 패턴이 5개 이상 파일에서 반복됨:
```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
```

**제안**: `.glass-light`, `.glass-dark` 유틸리티 클래스 생성

---

## 6. 레이아웃/크기 불일치

### 6-1. 스크롤 버튼 크기 불일치

| 파일 | 클래스 | 크기 |
|------|--------|------|
| WeekView.css:310-311 | `.week-scroll-btn` | 24×24px |
| DayView.css:284-285 | `.day-scroll-btn` | 28×28px |

**제안**: 둘 다 24px 또는 28px로 통일

### 6-2. border-radius 비체계적 사용

현재 사용되는 값: 4px, 5px, 6px, 8px, 10px, 12px, 16px, 20px

**제안**: 4px / 8px / 12px / 16px 스케일로 정리
- 4px: 작은 요소 (배지, 태그)
- 8px: 버튼, 입력 필드
- 12px: 카드, 패널
- 16px: 모달, 팝업

### 6-3. 헤더 padding 불일치

| 컴포넌트 | padding |
|----------|---------|
| calendar-header | 16px 24px |
| schedule-header | 24px |
| popup-header | 16px 20px |
| event-modal popup-header | 24px 28px |

**제안**: 16px 24px 또는 20px 24px로 통일

---

## 수정 우선순위

### 🔴 높음 (기능에 영향)
1. [x] Desktop 모드 hover/active 누락 수정 ✅
2. [x] Memo.css 잘못된 변수 수정 ✅

### 🟡 중간 (일관성)
3. [x] 하드코딩된 색상 → CSS 변수 ✅
4. [x] 스크롤 버튼 크기 통일 (28px로 통일) ✅
5. [x] Shadow 변수 사용 ✅

### 🟢 낮음 (리팩토링)
6. [ ] Popup/Event CSS 공통 스타일 추출
7. [ ] WeekView/DayView 공통 스타일 추출
8. [ ] border-radius 스케일 정리
9. [ ] Glassmorphism 유틸리티 클래스
10. [ ] 테마 변수 파일 분리

---

## 수정 완료 기록

| 날짜 | 항목 | 수정 내용 |
|------|------|----------|
| 2026-02-04 | Memo.css 변수 수정 | `--text-primary` → `--text-color`, `--bg-hover` → `--bg-cell-hover` |
| 2026-02-04 | Desktop 모드 hover/active | SchedulePanel, WeekView, DayView에 `.desktop-hover`/`.desktop-active` 추가 |
| 2026-02-04 | 한글 → 영어 | TitleBar: "새 메모장" → "New Memo", "삭제" → "Delete" |
| 2026-02-04 | 스크롤 버튼 크기 통일 | WeekView, DayView 스크롤 버튼 28x28px로 통일 + 트리플클릭 위치 토글 기능 추가 |
| 2026-02-04 | 주말 배경색 CSS 변수 | `--weekend-bg` 변수 추가, WeekView/DayView에서 사용 |
| 2026-02-04 | Shadow 변수 사용 | Memo, TitleBar, Settings, Event, Popup에서 `--shadow-md`, `--shadow-lg`, `--shadow-float` 사용 |
