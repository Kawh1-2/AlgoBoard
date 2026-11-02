// 必须放在最前面：在渲染任何 tldraw UI 之前把语言列表收窄到中英两种
import './i18n/restrictLanguages'

import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// 不使用 StrictMode：tldraw 的编辑器实例在开发模式下会被重复挂载两次，
// 容易引发持久化与 shape 注册的重复初始化问题。
createRoot(document.getElementById('root')!).render(<App />)
