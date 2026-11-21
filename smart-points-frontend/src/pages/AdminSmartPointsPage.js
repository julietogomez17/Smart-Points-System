import React, { useEffect, useState } from 'react';
import api from '../services/api';

function AdminSmartPointsPage() {

 const [summary, setSummary] = useState({
  pointsAwarded: 0,
  pointsRedeemed: 0,
  netPoints: 0,
  currentCirculation: 0,
});

const [transactions, setTransactions] = useState([]);
const [period, setPeriod] = useState('all');

useEffect(() => {
  const fetchSmartPoints = async () => {
    try {
    

    const response = await api.get(
  '/reports/points-transactions',
  {
    params: {
      period: period,
    },
  }
);

const data = response.data;

if (!data.success) {
  throw new Error(
    data.message || 'Failed to fetch Smart Points data'
  );
}

      setSummary({
        pointsAwarded: Number(
          data.summary?.points_awarded || 0
        ),

        pointsRedeemed: Number(
          data.summary?.points_redeemed || 0
        ),

        netPoints: Number(
          data.summary?.net_points || 0
        ),

        currentCirculation: Number(
          data.summary?.current_circulation || 0
        ),
      });

      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions
          : []
      );
    } catch (error) {
      console.error(
        'SMART POINTS PAGE ERROR:',
        error
      );

      setTransactions([]);
    }
  };

  fetchSmartPoints();
}, [period]);



  return (
    <main className="admin-points-page">

      {/* PAGE HEADER */}
      <section className="admin-points-header">
        <div>
          <span className="admin-points-eyebrow">
            SMART POINTS MANAGEMENT
          </span>

          <h1>Smart Points</h1>

          <p>
            Monitor Smart Points awarded, redeemed, and currently
            circulating among CitiPoints citizens.
          </p>
        </div>

        <div className="admin-points-header-actions">
          <button
            type="button"
            className="admin-points-export-btn"
          >
            Export Records
          </button>
        </div>
      </section>


      {/* SUMMARY CARDS */}
      <section className="admin-points-summary-grid">

        <article className="admin-points-summary-card">
          <div className="admin-points-summary-icon awarded">
            ↑
          </div>

          <div>
            <span>Points Awarded</span>

            <strong>
              {summary.pointsAwarded.toLocaleString()}
            </strong>

            <small>
              From approved participation
            </small>
          </div>
        </article>


        <article className="admin-points-summary-card">
          <div className="admin-points-summary-icon redeemed">
            ↓
          </div>

          <div>
            <span>Points Redeemed</span>

            <strong>
              {summary.pointsRedeemed.toLocaleString()}
            </strong>

            <small>
              Used for reward redemptions
            </small>
          </div>
        </article>


        <article className="admin-points-summary-card">
          <div className="admin-points-summary-icon net">
            ◎
          </div>

          <div>
            <span>Net Points</span>

            <strong>
              {summary.netPoints.toLocaleString()}
            </strong>

            <small>
              Awarded minus redeemed
            </small>
          </div>
        </article>


        <article className="admin-points-summary-card">
          <div className="admin-points-summary-icon circulation">
            ↻
          </div>

          <div>
            <span>Current Circulation</span>

            <strong>
              {summary.currentCirculation.toLocaleString()}
            </strong>

            <small>
              Current citizen balances
            </small>
          </div>
        </article>

      </section>


      {/* TRANSACTION CARD */}
      <section className="admin-points-card">

        <div className="admin-points-card-header">

          <div>
            <h2>Smart Points Transactions</h2>

            <p>
              View Smart Points awarded and redeemed across
              CitiPoints.
            </p>
          </div>

          <select
  value={period}
  onChange={(e) => setPeriod(e.target.value)}
>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>

        </div>


        {/* SEARCH + FILTERS */}
        <div className="admin-points-toolbar">

          <div className="admin-points-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search citizen or transaction..."
            />
          </div>


          <select defaultValue="all">
            <option value="all">
              All Transactions
            </option>

            <option value="earned">
              Awarded
            </option>

            <option value="redeemed">
              Redeemed
            </option>
          </select>


          <select defaultValue="all">
            <option value="all">
              All Activities
            </option>
          </select>

        </div>


        {/* TRANSACTION TABLE */}
        <div className="admin-points-table-wrap">

          <table className="admin-points-table">

            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Citizen</th>
                <th>Source</th>
                <th>Type</th>
                <th>Points</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="admin-points-empty-cell"
                  >
                    <div className="admin-points-empty">

                      <div className="admin-points-empty-icon">
                        ◎
                      </div>

                      <strong>
                        No Smart Points transactions yet
                      </strong>

                      <span>
                        Smart Points transactions will appear
                        here once transaction data is connected.
                      </span>

                    </div>
                  </td>
                </tr>
              ) : (
               transactions.map((transaction) => {
  const isCredit =
    Number(transaction.points_delta) > 0;

  const displayType = isCredit
    ? 'Awarded'
    : 'Redeemed';

  return (
    <tr key={transaction.transaction_id}>

      <td>
        #{transaction.transaction_id}
      </td>

      <td>
        <div className="admin-points-citizen">

          <div className="admin-points-avatar">
            {transaction.full_name
              ?.charAt(0)
              .toUpperCase() || '?'}
          </div>

          <span>
            {transaction.full_name || 'Unknown Citizen'}
          </span>

        </div>
      </td>

      <td>
        {transaction.source_name ||
          transaction.source_type ||
          '—'}
      </td>

      <td>
        <span
          className={`admin-points-type ${
            displayType.toLowerCase()
          }`}
        >
          {displayType}
        </span>
      </td>

      <td>
        <strong
          className={
            isCredit
              ? 'points-positive'
              : 'points-negative'
          }
        >
          {isCredit ? '+' : '-'}
          {Math.abs(
            Number(transaction.points_delta || 0)
          ).toLocaleString()}
        </strong>
      </td>

      <td>
        {transaction.created_at
          ? new Date(
              transaction.created_at
            ).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'}
      </td>

      <td>
        <span className="admin-points-status">
          Completed
        </span>
      </td>

    </tr>
  );
})
)}

            </tbody>

          </table>

        </div>

      </section>


      {/* INFORMATION SECTION */}
      <section className="admin-points-info-grid">

        <article className="admin-points-info-card">

          <div className="admin-points-info-icon">
            ✓
          </div>

          <div>
            <h3>LGU-Authorized Awarding</h3>

            <p>
              Smart Points are awarded after participation
              records have been reviewed and approved.
            </p>
          </div>

        </article>


        <article className="admin-points-info-card">

          <div className="admin-points-info-icon">
            ◎
          </div>

          <div>
            <h3>Points Accumulation</h3>

            <p>
              Citizens accumulate Smart Points through approved
              activities, attendance, feedback, consultations,
              and volunteer participation.
            </p>
          </div>

        </article>


        <article className="admin-points-info-card">

          <div className="admin-points-info-icon">
            ↻
          </div>

          <div>
            <h3>Reward Redemptions</h3>

            <p>
              Redeemed Smart Points are recorded when citizens
              use their available balance for eligible rewards.
            </p>
          </div>

        </article>

      </section>

    </main>
  );
}

export default AdminSmartPointsPage;