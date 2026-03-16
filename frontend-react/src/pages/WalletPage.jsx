import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/wallets/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch wallet');
      }

      const data = await response.json();
      setWallet(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const topUp = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/wallets/topup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(amount) })
      });

      if (!response.ok) throw new Error('Failed to top up');
      
      setAmount('');
      fetchWallet();
      alert('Top-up successful!');
    } catch (error) {
      console.error('Error topping up:', error);
      alert('Failed to top up wallet');
    }
  };

  if (loading) return <div>Loading wallet...</div>;

  return (
    <div>
      <h1>My Wallet</h1>
      {wallet && (
        <div>
          <h2>Balance: R{wallet.balance.toFixed(2)}</h2>
          <p>Operator: {wallet.operator}</p>
          
          <form onSubmit={topUp} style={{ marginTop: '2rem' }}>
            <h3>Top Up</h3>
            <input
              type="number"
              step="0.01"
              min="1"
              max="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              required
            />
            <button type="submit">Top Up</button>
          </form>
        </div>
      )}
    </div>
  );
}
