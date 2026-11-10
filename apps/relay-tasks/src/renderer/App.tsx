import { useEffect, useState } from 'react';
import { Workspace } from './views/Workspace';
import { Companion } from './views/Companion';

export function App() {
  const [view, setView] = useState(window.location.hash === '#companion' ? 'companion' : 'workspace');
  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#companion' ? 'companion' : 'workspace');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return view === 'companion' ? <Companion /> : <Workspace />;
}
