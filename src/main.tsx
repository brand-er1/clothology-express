
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Strictly ensure we find the root element
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(<App />);
