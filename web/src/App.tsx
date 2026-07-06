import { useEffect, useState } from 'react';

type NotificationItem = {
  id: string;
  message: string;
  receivedAt: string;
};

function formatMessage(data: string) {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (typeof parsed.message === 'string') {
      return parsed.message;
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return data;
  }
}

function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoDate));
}

function App() {
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const source = new EventSource(`${apiUrl}/stream`);

    source.onopen = () => {
      setConnected(true);
    };

    source.onerror = () => {
      setConnected(false);
    };

    source.addEventListener('notification', (event) => {
      const item: NotificationItem = {
        id: crypto.randomUUID(),
        message: formatMessage(event.data),
        receivedAt: new Date().toISOString(),
      };

      setHistory((current) => [item, ...current]);
    });

    return () => {
      source.close();
    };
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">SSE + Redis</p>
          <h1>Notificações</h1>
        </div>
        <span className={`status-badge ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Conectado' : 'Desconectado'}
        </span>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Histórico</h2>
          <span className="count-badge">{history.length}</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma notificação ainda.</p>
            <small>Publique no Redis para ver aparecer aqui.</small>
          </div>
        ) : (
          <ul className="notification-list">
            {history.map((item) => (
              <li key={item.id} className="notification-card">
                <div className="notification-meta">
                  <span className="notification-dot" />
                  <time dateTime={item.receivedAt}>{formatTime(item.receivedAt)}</time>
                </div>
                <p className="notification-message">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
