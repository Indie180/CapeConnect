import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWalletMe, request } from '../lib/authClient';

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
      const data = await getWalletMe();
      setWallet(data);
    } catch (error) {
      if (error?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const topUp = async (e) => {
    e.preventDefault();
    try {
      await request('/api/wallets/topup', { method: 'POST', body: { amount: parseFloat(amount) } });
      setAmount('');
      fetchWallet();
      alert('Top-up successful!');
    } catch (error) {
      if (error?.status === 401) navigate('/login');
      else alert('Failed to top up wallet');
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
