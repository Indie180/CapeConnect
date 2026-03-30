import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTickets, request } from '../lib/authClient';

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const data = await getTickets();
      setTickets(data);
    } catch (error) {
      if (error?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const useTicket = async (ticketId) => {
    try {
      await request(`/api/tickets/${ticketId}/use`, { method: 'POST' });
      fetchTickets();
    } catch (error) {
      if (error?.status === 401) navigate('/login');
      else alert('Failed to use ticket');
    }
  };

  if (loading) return <div>Loading tickets...</div>;

  return (
    <div>
      <h1>My Tickets</h1>
      {tickets.length === 0 ? (
        <p>No tickets found</p>
      ) : (
        <div>
          {tickets.map(ticket => (
            <div key={ticket.id} style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
              <p>Route: {ticket.route_id}</p>
              <p>Status: {ticket.status}</p>
              <p>Price: R{ticket.price}</p>
              <p>Purchased: {new Date(ticket.purchased_at).toLocaleString()}</p>
              {ticket.status === 'PAID' && (
                <button onClick={() => useTicket(ticket.id)}>Use Ticket</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
