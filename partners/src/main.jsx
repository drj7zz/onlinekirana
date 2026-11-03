import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from '@shared/context/AuthContext.jsx';
import { ToastProvider } from '@shared/context/ToastContext.jsx';
import { applyTheme, initialTheme } from '@shared/lib/theme';
import './styles.css';

applyTheme(initialTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
