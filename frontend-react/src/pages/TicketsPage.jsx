import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const useTicket = async (ticketId) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tickets/${ticketId}/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to use ticket');
      
      fetchTickets();
    } catch (error) {
      console.error('Error using ticket:', error);
      alert('Failed to use ticket');
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
