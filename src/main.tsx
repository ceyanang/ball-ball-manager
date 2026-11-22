import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow/400'
import '@fontsource/barlow/600'
import '@fontsource/big-shoulders-display/700'
import '@fontsource/big-shoulders-display/900'

import App from './ui/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
