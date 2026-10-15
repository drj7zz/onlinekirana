import { useEffect, useState } from 'react';
import API from '@shared/api';

export default function AdminAudit() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/admin/audit')
      .then(({ data }) => setEvents(data))
      .catch((e) => setError(e.response?.data?.message || 'Could not load the audit trail.'));
  }, []);

  return (
    <section>
      <div className="page-head">
        <h1>Admin audit trail</h1>
        <p>Recent administrative changes and their result. Request bodies, passwords, customer details and IP addresses are not stored here.</p>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && events.length === 0 ? <p className="empty">No admin changes recorded yet.</p> : (
        <div className="audit-table-wrap">
          <table className="table">
            <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Record</th><th>Result</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.actor?.name || 'Deleted account'}{event.actor?.email && <small className="muted"> · {event.actor.email}</small>}</td>
                  <td><code>{event.action}</code></td>
                  <td>{event.resourceId || '—'}</td>
                  <td>{event.outcome >= 200 && event.outcome < 400 ? 'Success' : `HTTP ${event.outcome}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
