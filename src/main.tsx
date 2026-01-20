import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EventPopup } from './components/Popup'

// 팝업 창인지 확인
const isPopup = window.location.hash.includes('/popup');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPopup ? <EventPopup /> : <App />}
  </StrictMode>,
)
