import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode deshabilitado temporalmente: en React 19 + HMR de Vite causaba
// que el Dashboard renderizara dos instancias con desync de state.
createRoot(document.getElementById('root')).render(<App />)
