import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { reloadOnceForStaleChunk } from './lib/lazyWithReload'

// 배포 직후 이전 화면 파일을 미리 불러오다 실패하면(Vite preload) 한 번 새로고침해 최신 버전을 받는다.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault();
});

// Strictly ensure we find the root element
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(<App />);
