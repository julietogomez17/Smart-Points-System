import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const ITEMS_PER_PAGE = 10;

const TIER_ORDER = [
  'New',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
];

function SeasonLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  });

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [limitFilter, setLimitFilter] = useState('50');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');

        const [leaderboardResponse, userResponse] =
          await Promise.all([
            api.get('/reports/season-leaderboard'),
            api.get('/auth/me'),
          ]);

        setLeaderboard(
          leaderboardResponse.data?.leaderboard || []
        );

        if (userResponse.data?.user) {
          setUser(userResponse.data.user);

          localStorage.setItem(
            'user',
            JSON.stringify(userResponse.data.user)
          );
        }
      } catch (err) {
        console.error('LEADERBOARD ERROR:', err);

        setError(
          err.response?.data?.message ||
            'Unable to load the season leaderboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const filteredLeaderboard = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let rows = leaderboard.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.full_name
          ?.toLowerCase()
          .includes(keyword);

      const memberTier =
        member.tier ||
        member.current_rank ||
        'New';

      const matchesTier =
        tierFilter === 'All' ||
        memberTier === tierFilter;

      return matchesSearch && matchesTier;
    });

    if (limitFilter !== 'All') {
      rows = rows.slice(0, Number(limitFilter));
    }

    return rows;
  }, [leaderboard, search, tierFilter, limitFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredLeaderboard.length / ITEMS_PER_PAGE
    )
  );

  const currentRows = useMemo(() => {
    const start =
      (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredLeaderboard.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [filteredLeaderboard, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tierFilter, limitFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getInitials = (name = '') => {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return 'U';

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';

    return rank;
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'Diamond':
        return '◆';

      case 'Platinum':
        return '♛';

      case 'Gold':
        return '★';

      case 'Silver':
        return '★';

      case 'Bronze':
        return '★';

      default:
        return '●';
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];

    const startPage = Math.max(
      1,
      Math.min(currentPage - 2, totalPages - 4)
    );

    const endPage = Math.min(
      totalPages,
      startPage + 4
    );

    for (
      let page = startPage;
      page <= endPage;
      page += 1
    ) {
      pages.push(
        <button
          key={page}
          type="button"
          className={
            page === currentPage
              ? 'season-page-number active'
              : 'season-page-number'
          }
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </button>
      );
    }

    return (
      <div className="season-pagination-buttons">
        <button
          type="button"
          className="season-page-arrow"
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
          className="season-page-arrow"
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
      <main className="season-leaderboard-page">
        <div className="season-leaderboard-container">
          <div className="season-loading">
            Loading Season Leaderboard...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="season-leaderboard-page">
      <div className="season-leaderboard-container">

        {/* HEADER */}

        <section className="season-page-header">

          <div className="season-title-area">
            <div className="season-trophy">
              🏆
            </div>

            <div>
              <h1>Season Leaderboard</h1>

              <p>
                Top participating citizens for the
                current season
              </p>
            </div>
          </div>

          <div className="season-current-panel">
            <div className="season-calendar-icon">
              ▣
            </div>

            <div className="season-current-text">
              <strong>Current Season</strong>

              <span>
                Current monthly ranking period
              </span>
            </div>

            <span className="season-status">
              Ongoing
            </span>
          </div>

        </section>

        {error && (
          <div className="season-error">
            {error}
          </div>
        )}

        {/* LEADERBOARD */}

        <section className="season-board">

          <div className="season-board-controls">

            <div className="season-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search name..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="season-filters">

              <select
                value={tierFilter}
                onChange={(event) =>
                  setTierFilter(event.target.value)
                }
              >
                <option value="All">
                  All Tiers
                </option>

                {TIER_ORDER.map((tier) => (
                  <option
                    key={tier}
                    value={tier}
                  >
                    {tier}
                  </option>
                ))}
              </select>

              <select
                value={limitFilter}
                onChange={(event) =>
                  setLimitFilter(event.target.value)
                }
              >
                <option value="10">Top 10</option>
                <option value="25">Top 25</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="All">
                  All Citizens
                </option>
              </select>

            </div>

          </div>

          {currentRows.length === 0 ? (
            <div className="season-empty">
              <div>🏆</div>

              <h3>No citizens found</h3>

              <p>
                Try changing your search or tier
                filter.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="season-table-wrapper">
                <table className="season-table">

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Citizen</th>
                      <th>Tier</th>
                      <th>Season Points</th>
                      <th>Approved Activities</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentRows.map((member) => {
                      const isCurrentUser =
                        Number(member.user_id) ===
                        Number(user?.user_id);

                      const tier =
                        member.tier ||
                        member.current_rank ||
                        'New';

                      return (
                        <tr
                          key={member.user_id}
                          className={
                            isCurrentUser
                              ? 'season-current-user'
                              : ''
                          }
                        >
                          <td>
                            <span
                              className={`season-rank season-rank-${member.rank}`}
                            >
                              {getRankDisplay(
                                Number(member.rank)
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="season-citizen">

                              <div className="season-avatar">
                                {getInitials(
                                  member.full_name
                                )}
                              </div>

                              <strong>
                                {member.full_name}
                              </strong>

                              {isCurrentUser && (
                                <span className="season-you">
                                  You
                                </span>
                              )}

                            </div>
                          </td>

                          <td>
                            <span
                              className={`season-tier season-tier-${tier.toLowerCase()}`}
                            >
                              <span>
                                {getTierIcon(tier)}
                              </span>

                              {tier}
                            </span>
                          </td>

                          <td>
                            <strong className="season-points">
                              {Number(
                                member.season_points || 0
                              ).toLocaleString()}
                            </strong>
                          </td>

                          <td>
                            {Number(
                              member.approved_count || 0
                            ).toLocaleString()}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

              {/* MOBILE */}

              <div className="season-mobile-list">

                {currentRows.map((member) => {
                  const isCurrentUser =
                    Number(member.user_id) ===
                    Number(user?.user_id);

                  const tier =
                    member.tier ||
                    member.current_rank ||
                    'New';

                  return (
                    <article
                      key={member.user_id}
                      className={`season-mobile-card ${
                        isCurrentUser
                          ? 'current-user'
                          : ''
                      }`}
                    >

                      <div
                        className={`season-rank season-rank-${member.rank}`}
                      >
                        {getRankDisplay(
                          Number(member.rank)
                        )}
                      </div>

                      <div className="season-avatar">
                        {getInitials(
                          member.full_name
                        )}
                      </div>

                      <div className="season-mobile-user">

                        <div>
                          <strong>
                            {member.full_name}
                          </strong>

                          {isCurrentUser && (
                            <span className="season-you">
                              You
                            </span>
                          )}
                        </div>

                        <span
                          className={`season-tier season-tier-${tier.toLowerCase()}`}
                        >
                          {getTierIcon(tier)} {tier}
                        </span>

                        <small>
                          {Number(
                            member.approved_count || 0
                          )}{' '}
                          approved activities
                        </small>

                      </div>

                      <div className="season-mobile-points">
                        <strong>
                          {Number(
                            member.season_points || 0
                          ).toLocaleString()}
                        </strong>

                        <span>pts</span>
                      </div>

                    </article>
                  );
                })}

              </div>

              {/* FOOTER */}

              <div className="season-board-footer">

                {renderPagination()}

                <p>
                  Showing{' '}
                  {filteredLeaderboard.length === 0
                    ? 0
                    : (currentPage - 1) *
                        ITEMS_PER_PAGE +
                      1}
                  {' - '}
                  {Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredLeaderboard.length
                  )}{' '}
                  of{' '}
                  {filteredLeaderboard.length.toLocaleString()}{' '}
                  participants
                </p>

              </div>
            </>
          )}

        </section>

      </div>
    </main>
  );
}

export default SeasonLeaderboardPage;