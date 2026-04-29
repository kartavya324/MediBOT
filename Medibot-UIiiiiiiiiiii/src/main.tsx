import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#0f172a',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          fontSize: '13px',
          fontWeight: '600',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
        duration: 3500,
      }}
    />
  </StrictMode>,
);
