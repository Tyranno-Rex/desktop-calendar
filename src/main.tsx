import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EventPopup } from './components/Popup'
import { MemoPopup } from './components/Memo'
import { ErrorBoundary } from './components/ErrorBoundary'

// 팝업 창인지 확인
const isPopup = window.location.hash.includes('/popup');
const isMemo = window.location.hash.includes('/memo');

const RootComponent = () => {
  if (isPopup) return <EventPopup />;
  if (isMemo) return <MemoPopup />;
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootComponent />
    </ErrorBoundary>
  </StrictMode>,
)
