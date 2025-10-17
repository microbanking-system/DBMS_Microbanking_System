import React, { useState } from 'react';
import axios from 'axios';

interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  gender: string;
  nic: string;
  date_of_birth: string;
  contact_no_1?: string;
  contact_no_2?: string;
  email?: string;
  address?: string;
  accounts_count: number;
  account_ids: number[];
}

const ManagerCustomerSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get('/api/manager/customers/search', {
        params: { query: trimmed },
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(resp.data.customers || []);
    } catch (err: any) {
      console.error('Search failed', err);
      setError(err?.response?.data?.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="manager-customer-search">
      <div className="section-header">
        <div>
          <h4>Search Customers</h4>
          <p className="section-subtitle">Search by name or NIC within your branch</p>
        </div>
      </div>

      <form className="search-form" onSubmit={onSearch}>
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter name or NIC..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Only show results after a search attempt (results !== null) */}
      {results !== null && (
        <div className="results-section">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">🔎</div>
              <h5>No customers found</h5>
              <p>Try a different name or NIC.</p>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-header">
                <h4>Results</h4>
                <span className="results-count">{results.length} match(es)</span>
              </div>
              <div className="table-wrapper">
                <table className="accounts-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>NIC</th>
                      <th>Gender</th>
                      <th>Date of Birth</th>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((c) => (
                      <tr key={c.customer_id}>
                        <td>
                          <div><strong>{c.first_name} {c.last_name}</strong></div>
                          <div className="muted">ID: {c.customer_id}</div>
                        </td>
                        <td>{c.nic}</td>
                        <td>{c.gender}</td>
                        <td>{formatDate(c.date_of_birth)}</td>
                        <td>{c.contact_no_1 || '—'}</td>
                        <td className="email" title={c.email || ''}>{c.email || '—'}</td>
                        <td className="address" title={c.address || ''}>{(c.address || '').length > 25 ? (c.address || '').slice(0, 25) + '...' : (c.address || '—')}</td>
                        <td>
                          <div>{c.accounts_count} account(s)</div>
                          {c.account_ids && c.account_ids.length > 0 && (
                            <div className="muted">{c.account_ids.join(', ')}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManagerCustomerSearch;
