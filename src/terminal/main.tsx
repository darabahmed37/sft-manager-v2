import ReactDOM from 'react-dom/client';
import '../renderer/index.css';
import TerminalApp from './TerminalApp';

// Note: StrictMode intentionally runs effects twice in dev to detect side effects.
// We deliberately skip it here because the SSH shell-open effect must run exactly once.
ReactDOM.createRoot(document.getElementById('terminal-root')!).render(<TerminalApp />);
