import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const ITEMS_PER_PAGE = 7;

const PointsHistoryPage = () => {

  const [summary, setSummary] = useState({
    current_points: 0,
    total_earned: 0,
    total_spent: 0,
  });

  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPointsHistory();
  }, []);

  const fetchPointsHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/reports/my-points-activity'
      );

      const data = response.data || {};

      setSummary({
        current_points:
          Number(data.summary?.current_points) || 0,

        total_earned:
          Number(data.summary?.total_earned) || 0,

        total_spent:
          Number(data.summary?.total_spent) || 0,
      });

      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions
          : []
      );
    } catch (err) {
      console.error('POINTS HISTORY ERROR:', err);

      setError(
        err.response?.data?.message ||
          'Unable to load your Points History.'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const isEarned =
        Number(transaction.points_delta) > 0;

      const isSpent =
        Number(transaction.points_delta) < 0;

      const matchesFilter =
        filter === 'all' ||
        (filter === 'earned' && isEarned) ||
        (filter === 'spent' && isSpent);

      const searchableText = [
        transaction.source_name,
        transaction.source_type,
        transaction.notes,
        transaction.transaction_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !keyword || searchableText.includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [transactions, search, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTransactions.length / ITEMS_PER_PAGE
    )
  );

  const currentTransactions = useMemo(() => {
    const start =
      (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredTransactions.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [filteredTransactions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formatNumber = (number) => {
    return Number(number || 0).toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) {
      return {
        date: '—',
        time: '',
      };
    }

    const value = new Date(date);

    return {
      date: value.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),

      time: value.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  const getTransactionSubtitle = (transaction) => {
    switch (transaction.source_type) {
      case 'activity':
        return 'Activity Participation';

      case 'redemption':
        return 'Reward Redemption';

      case 'rank_bonus':
        return 'Rank Bonus';

      case 'monthly_bonus':
        return 'Monthly Rank Benefit';

      default:
        return 'Smart Points Transaction';
    }
  };

  const getDescription = (transaction) => {
    if (transaction.notes) {
      return transaction.notes;
    }

    if (transaction.source_type === 'activity') {
      return `Approved participation in ${
        transaction.source_name || 'activity'
      }`;
    }

    if (transaction.source_type === 'redemption') {
      return `Redeemed ${
        transaction.source_name || 'reward'
      }`;
    }

    return transaction.source_name || 'Points transaction';
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];

    for (let page = 1; page <= totalPages; page++) {
      pages.push(
        <button
          key={page}
          type="button"
          className={
            currentPage === page
              ? 'points-page-number active'
              : 'points-page-number'
          }
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </button>
      );
    }

    return (
      <div className="points-pagination">
        <button
          type="button"
          className="points-page-arrow"
          disabled={currentPage === 1}
          onClick={() =>
            setCurrentPage((page) =>
              Math.max(1, page - 1)
            )
          }
        >
          ‹
        </button>

        {pages}

        <button
          type="button"
          className="points-page-arrow"
          disabled={currentPage === totalPages}
          onClick={() =>
            setCurrentPage((page) =>
              Math.min(totalPages, page + 1)
            )
          }
        >
          ›
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="points-history-page">
        <div className="points-history-container">
          <div className="points-history-loading">
            Loading Points History...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="points-history-page">
      <div className="points-history-container">

        <div className="points-history-heading">
          <h1>Points History</h1>

          <p>
            Track how you earned and used your Smart Points.
          </p>
        </div>

        {error && (
          <div className="points-history-error">
            {error}

            <button
              type="button"
              onClick={fetchPointsHistory}
            >
              Try Again
            </button>
          </div>
        )}

        <section className="points-summary-grid">

          <article className="points-summary-card current">
            <div className="points-summary-icon">
              ◎
            </div>

            <div>
              <span>Current Points</span>

              <strong>
                {formatNumber(summary.current_points)}
              </strong>

              <p>Your available Smart Points</p>
            </div>
          </article>

          <article className="points-summary-card earned">
            <div className="points-summary-icon">
              ↑
            </div>

            <div>
              <span>Total Earned</span>

              <strong>
                {formatNumber(summary.total_earned)}
              </strong>

              <p>From activities and other rewards</p>
            </div>
          </article>

          <article className="points-summary-card spent">
            <div className="points-summary-icon">
              ↓
            </div>

            <div>
              <span>Total Spent</span>

              <strong>
                {formatNumber(summary.total_spent)}
              </strong>

              <p>Used for reward redemptions</p>
            </div>
          </article>

        </section>

        <section className="points-transactions-panel">

          <div className="points-transactions-header">

            <h2>Transaction History</h2>

            <div className="points-history-controls">

              <div className="points-search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value)
                }
              >
                <option value="all">
                  All Transactions
                </option>

                <option value="earned">
                  Earned
                </option>

                <option value="spent">
                  Spent
                </option>
              </select>

            </div>
          </div>

          {currentTransactions.length === 0 ? (
            <div className="points-empty-state">
              <div>◎</div>

              <h3>No transactions found</h3>

              <p>
                Your Smart Points transactions will
                appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="points-table-wrapper">
                <table className="points-history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Transaction</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Points</th>
                      <th>Balance</th>
                      <th>Description</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentTransactions.map(
                      (transaction, index) => {
                        const earned =
                          Number(
                            transaction.points_delta
                          ) > 0;

                        const date = formatDate(
                          transaction.created_at
                        );

                        const number =
                          (currentPage - 1) *
                            ITEMS_PER_PAGE +
                          index +
                          1;

                        return (
                          <tr
                            key={
                              transaction.transaction_id
                            }
                          >
                            <td>{number}</td>

                            <td>
                              <div className="points-transaction-main">
                                <div
                                  className={`points-transaction-icon ${
                                    earned
                                      ? 'earned'
                                      : 'spent'
                                  }`}
                                >
                                  {transaction.source_type ===
                                  'redemption'
                                    ? '◆'
                                    : '▣'}
                                </div>

                                <div>
                                  <strong>
                                    {
                                      transaction.source_name
                                    }
                                  </strong>

                                  <span>
                                    {getTransactionSubtitle(
                                      transaction
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={`points-type-badge ${
                                  earned
                                    ? 'earned'
                                    : 'spent'
                                }`}
                              >
                                {earned
                                  ? 'Earned'
                                  : 'Spent'}
                              </span>
                            </td>

                            <td>
                              <div className="points-date">
                                <strong>
                                  {date.date}
                                </strong>

                                <span>
                                  {date.time}
                                </span>
                              </div>
                            </td>

                            <td>
                              <strong
                                className={
                                  earned
                                    ? 'points-positive'
                                    : 'points-negative'
                                }
                              >
                                {earned ? '+' : ''}
                                {formatNumber(
                                  transaction.points_delta
                                )}
                              </strong>
                            </td>

                            <td>
                              {formatNumber(
                                transaction.balance_after
                              )}
                            </td>

                            <td className="points-description">
                              {getDescription(
                                transaction
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="points-mobile-list">
                {currentTransactions.map(
                  (transaction) => {
                    const earned =
                      Number(transaction.points_delta) > 0;

                    const date = formatDate(
                      transaction.created_at
                    );

                    return (
                      <article
                        className="points-mobile-card"
                        key={
                          transaction.transaction_id
                        }
                      >
                        <div
                          className={`points-transaction-icon ${
                            earned
                              ? 'earned'
                              : 'spent'
                          }`}
                        >
                          {transaction.source_type ===
                          'redemption'
                            ? '◆'
                            : '▣'}
                        </div>

                        <div className="points-mobile-info">
                          <strong>
                            {transaction.source_name}
                          </strong>

                          <span>
                            {getTransactionSubtitle(
                              transaction
                            )}
                          </span>

                          <small>
                            {date.date}
                            {date.time
                              ? ` • ${date.time}`
                              : ''}
                          </small>
                        </div>

                        <div className="points-mobile-value">
                          <strong
                            className={
                              earned
                                ? 'points-positive'
                                : 'points-negative'
                            }
                          >
                            {earned ? '+' : ''}
                            {formatNumber(
                              transaction.points_delta
                            )}
                          </strong>

                          <span>
                            {formatNumber(
                              transaction.balance_after
                            )}
                          </span>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>

              {renderPagination()}
            </>
          )}

        </section>

      </div>
    </main>
  );
};

export default PointsHistoryPage;