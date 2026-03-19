import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './amplifyConfig';
import App from './App.jsx';

// Initialize GA4
const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;
if (GA4_ID) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { send_page_view: false });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
