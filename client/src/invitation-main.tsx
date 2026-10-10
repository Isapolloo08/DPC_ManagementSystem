import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import { EventInvitationPage } from './pages/EventInvitationPage';
import './index.css';

function InvitationWebsite() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  if (hash.startsWith('#/invite/')) return <EventInvitationPage key={hash} token={hash.match(/^#\/invite\/([a-f0-9]{64})$/)?.[1] || ''} />;
  return <main className="event-invitation-page"><article className="event-invitation-card">
    <header><p>DAET PRESBYTERIAN CHURCH</p><h1>Event invitations</h1><p>Open the invitation link sent by your event organizer to view the event and respond.</p></header>
  </article></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><InvitationWebsite /></ThemeProvider></StrictMode>);
