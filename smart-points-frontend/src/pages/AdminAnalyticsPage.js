import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function AdminAnalyticsPage() {
  const [dashboard, setDashboard] = useState({});
  const [activityReport, setActivityReport] = useState([]);
  const [memberReport, setMemberReport] = useState([]);
  const [redemptionReport, setRedemptionReport] = useState([]);
  const [partnerReport, setPartnerReport] = useState([]);
  const [fraudReport, setFraudReport] = useState([]);
  const [participationTrends, setParticipationTrends] = useState([]);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState('all');
  

  /* =========================================================
     FETCH REPORTS
     ========================================================= */

  useEffect(() => {
    fetchReports();

    const interval = setInterval(() => {
      fetchReports(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const [
        dashboardRes,
        activityRes,
        memberRes,
        redemptionRes,
        partnerRes,
        fraudRes,
        trendsRes,
      ] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/activities'),
        api.get('/reports/members'),
        api.get('/reports/redemptions'),
        api.get('/reports/partners'),
        api.get('/reports/fraud'),
        api.get('/reports/participation-trends'),
      ]);

      setDashboard(dashboardRes.data.dashboard || {});
      setActivityReport(activityRes.data.report || []);
      setMemberReport(memberRes.data.report || []);
      setRedemptionReport(redemptionRes.data.report || []);
      setPartnerReport(partnerRes.data.report || []);
      setFraudReport(fraudRes.data.report || []);
      setParticipationTrends(trendsRes.data.report || []);

      setMessage('');
    } catch (error) {
      console.error('ANALYTICS ERROR:', error);

      setMessage(
        error.response?.data?.message ||
          'Failed to load analytics reports.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString();

  const formatDate = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRiskScore = (value) => {
    let score = Number(value || 0);

    if (score > 0 && score <= 1) {
      score *= 100;
    }

    return Math.min(Math.max(score, 0), 100);
  };

  const getRiskLevel = (value) => {
    const score = getRiskScore(value);

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';

    return 'low';
  };

  const getCompletionNumber = (value) => {
    if (typeof value === 'number') return value;

    const parsed = parseFloat(String(value || '0').replace('%', ''));

    return Number.isNaN(parsed) ? 0 : parsed;
  };

  /* =========================================================
     CALCULATED VALUES
     ========================================================= */

  const activeCitizens = useMemo(() => {
    return memberReport.filter(
      (member) =>
        Number(member.approved_participations || 0) > 0
    ).length;
  }, [memberReport]);

  const totalParticipations = useMemo(() => {
    const dashboardValue = Number(
      dashboard.approved_participations || 0
    );

    if (dashboardValue > 0) return dashboardValue;

    return activityReport.reduce(
      (total, activity) =>
        total + Number(activity.approved_count || 0),
      0
    );
  }, [dashboard, activityReport]);

  const activePartners = useMemo(() => {
    return partnerReport.filter(
      (partner) =>
        Number(partner.total_rewards || 0) > 0 ||
        Number(partner.total_activities || 0) > 0
    ).length;
  }, [partnerReport]);

  const pointsRedeemed = useMemo(() => {
    return redemptionReport.reduce(
      (total, reward) =>
        total + Number(reward.total_points_spent || 0),
      0
    );
  }, [redemptionReport]);

  const topActivities = useMemo(() => {
    return [...activityReport]
      .sort(
        (a, b) =>
          Number(b.approved_count || 0) -
          Number(a.approved_count || 0)
      )
      .slice(0, 5);
  }, [activityReport]);

  const topPartners = useMemo(() => {
    return [...partnerReport]
      .sort(
        (a, b) =>
          Number(b.total_activities || 0) -
          Number(a.total_activities || 0)
      )
      .slice(0, 5);
  }, [partnerReport]);

  const recentFraudAlerts = useMemo(() => {
    return [...fraudReport]
      .sort(
        (a, b) =>
          new Date(b.submitted_at || 0) -
          new Date(a.submitted_at || 0)
      )
      .slice(0, 5);
  }, [fraudReport]);

  const maxTrendValue = useMemo(() => {
    return Math.max(
      ...participationTrends.map((item) =>
        Number(item.total_participations || 0)
      ),
      1
    );
  }, [participationTrends]);

  const maxActivityCount = useMemo(() => {
    return Math.max(
      ...topActivities.map((item) =>
        Number(item.approved_count || 0)
      ),
      1
    );
  }, [topActivities]);

  /* =========================================================
     PLACEHOLDER BARANGAYS
     ========================================================= */

  /*
    IMPORTANT:
    Barangay is not connected to your database yet.
    These values are intentionally zero/placeholders.
    Replace this array with backend data later.
  */

  const topBarangays = [
    { name: 'Barangay 1', participations: 0 },
    { name: 'Barangay 2', participations: 0 },
    { name: 'Barangay 3', participations: 0 },
    { name: 'Barangay 4', participations: 0 },
    { name: 'Barangay 5', participations: 0 },
  ];

  /* =========================================================
     CSV EXPORT
     ========================================================= */

  const csvEscape = (value) => {
    const text = String(value ?? '');

    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const rows = [];

    rows.push(['CITIPOINTS ANALYTICS & REPORTS']);
    rows.push(['Generated', new Date().toLocaleString('en-PH')]);
    rows.push([]);

    rows.push(['SUMMARY']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Citizens', memberReport.length]);
    rows.push(['Active Citizens', activeCitizens]);
    rows.push(['Total Participations', totalParticipations]);
    rows.push([
      'Smart Points Granted',
      dashboard.total_points_awarded || 0,
    ]);
    rows.push([
      'Rewards Redeemed',
      dashboard.total_rewards_redeemed || 0,
    ]);
    rows.push(['Active Partners', activePartners]);
    rows.push([
      'Fraud Alerts',
      dashboard.flagged_or_suspicious || fraudReport.length,
    ]);

    rows.push([]);
    rows.push(['ACTIVITY ENGAGEMENT REPORT']);
    rows.push([
      'Activity',
      'Category',
      'Status',
      'Joined',
      'Approved',
      'Rejected',
      'Completion Rate',
      'Points Generated',
    ]);

    activityReport.forEach((item) => {
      rows.push([
        item.title || '',
        item.category || '',
        item.status || '',
        item.total_joined || 0,
        item.approved_count || 0,
        item.rejected_count || 0,
        item.completion_rate || '0%',
        item.total_points_generated || 0,
      ]);
    });

    rows.push([]);
    rows.push(['PARTICIPATION TRENDS']);
    rows.push([
      'Month',
      'Approved Participations',
      'Active Citizens',
    ]);

    participationTrends.forEach((item) => {
      rows.push([
        item.month || item.month_key || '',
        item.total_participations || 0,
        item.active_citizens || 0,
      ]);
    });

    rows.push([]);
    rows.push(['PARTNER ACTIVITY']);
    rows.push([
      'Partner',
      'Activities',
      'Rewards',
    ]);

    partnerReport.forEach((partner) => {
      rows.push([
        partner.organization_name || '',
        partner.total_activities || 0,
        partner.total_rewards || 0,
      ]);
    });

    rows.push([]);
    rows.push(['REWARD REDEMPTIONS']);
    rows.push([
      'Reward',
      'Category',
      'Redemptions',
      'Points Spent',
    ]);

    redemptionReport.forEach((reward) => {
      rows.push([
        reward.reward_name || '',
        reward.category || '',
        reward.total_redemptions || 0,
        reward.total_points_spent || 0,
      ]);
    });

    rows.push([]);
    rows.push(['FRAUD ALERTS']);
    rows.push([
      'Participation ID',
      'Citizen',
      'Activity',
      'AI Risk Score',
      'Status',
      'Submitted',
    ]);

    fraudReport.forEach((record) => {
      rows.push([
        record.participation_id || '',
        record.full_name || '',
        record.activity_title || '',
        `${getRiskScore(record.ai_score).toFixed(2)}%`,
        record.status || '',
        formatDate(record.submitted_at),
      ]);
    });

    const csv = rows
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `citipoints-analytics-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     PDF / PRINT
     ========================================================= */

  /*
    This uses the browser's print dialog.
    Select "Save as PDF" to create the PDF.

    The CSS we add next will give this a separate clean
    print layout and hide the sidebar/buttons.
  */

  const handleExportPDF = () => {
  try {
    

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 14;
    const navy = [18, 35, 63];
    const blue = [22, 119, 255];
    const muted = [105, 121, 143];

    let y = 15;

    /* =====================================================
       HELPER - PAGE HEADER
       ===================================================== */

    const addSmallPageHeader = () => {
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 12, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);

      pdf.text(
        'CITIPOINTS | Analytics & Reports',
        margin,
        8
      );
    };

    /* =====================================================
       HELPER - NEW PAGE WHEN NEEDED
       ===================================================== */

    const checkPage = (requiredHeight = 20) => {
      if (y + requiredHeight > pageHeight - 20) {
        pdf.addPage();
        addSmallPageHeader();
        y = 20;
      }
    };

    /* =====================================================
       HELPER - SECTION TITLE
       ===================================================== */

    const addSectionTitle = (title) => {
      checkPage(15);

      pdf.setFillColor(...blue);
      pdf.roundedRect(
        margin,
        y,
        3,
        7,
        1,
        1,
        'F'
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...navy);

      pdf.text(
        title,
        margin + 7,
        y + 5.3
      );

      y += 12;
    };

    /* =====================================================
       HELPER - TABLE
       ===================================================== */

    const addTable = (headers, rows, columnStyles = {}) => {
      const bodyRows =
        rows.length > 0
          ? rows
          : [
              [
                'No records available',
                ...Array(headers.length - 1).fill(''),
              ],
            ];

      autoTable(pdf, {
        startY: y,

        head: [headers],
        body: bodyRows,

        theme: 'grid',

        margin: {
          left: margin,
          right: margin,
          bottom: 18,
        },

        headStyles: {
          fillColor: navy,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2.5,
        },

        bodyStyles: {
          textColor: [48, 63, 82],
          fontSize: 7.5,
          cellPadding: 2.5,
        },

        alternateRowStyles: {
          fillColor: [245, 249, 253],
        },

        styles: {
          overflow: 'linebreak',
          lineColor: [225, 232, 240],
          lineWidth: 0.15,
          valign: 'middle',
        },

        columnStyles,

        didDrawPage: () => {
          /*
            AutoTable may create additional pages.
            This places the small CitiPoints header
            on those pages.
          */

          if (
            pdf.internal.getCurrentPageInfo()
              .pageNumber > 1
          ) {
            addSmallPageHeader();
          }
        },
      });

      y = pdf.lastAutoTable.finalY + 10;
    };

    /* =====================================================
       MAIN REPORT HEADER
       ===================================================== */

    pdf.setFillColor(...navy);
    pdf.rect(
      0,
      0,
      pageWidth,
      43,
      'F'
    );

    pdf.setFillColor(...blue);
    pdf.rect(
      0,
      41,
      pageWidth,
      2,
      'F'
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(21);
    pdf.setTextColor(255, 255, 255);

    pdf.text(
      'CITIPOINTS',
      margin,
      17
    );

    pdf.setFontSize(12);

    pdf.text(
      'Analytics & Reports',
      margin,
      26
    );

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(210, 226, 246);

    pdf.text(
      'AI-Driven Reward-Based Citizen Engagement System',
      margin,
      34
    );

    pdf.setFontSize(7.5);

    pdf.text(
      `Generated: ${new Date().toLocaleString(
        'en-PH'
      )}`,
      pageWidth - margin,
      25,
      {
        align: 'right',
      }
    );

    pdf.text(
      'Mandaue City, Cebu',
      pageWidth - margin,
      32,
      {
        align: 'right',
      }
    );

    y = 51;

    /* =====================================================
       EXECUTIVE SUMMARY
       ===================================================== */

    addSectionTitle('EXECUTIVE SUMMARY');

    addTable(
      ['Metric', 'Value'],
      [
        [
          'Total Citizens',
          formatNumber(memberReport.length),
        ],

        [
          'Active Citizens',
          formatNumber(activeCitizens),
        ],

        [
          'Total Participations',
          formatNumber(totalParticipations),
        ],

        [
          'Smart Points Granted',
          formatNumber(
            dashboard.total_points_awarded
          ),
        ],

        [
          'Rewards Redeemed',
          formatNumber(
            dashboard.total_rewards_redeemed
          ),
        ],

        [
          'Active Partners',
          formatNumber(activePartners),
        ],

        [
          'Fraud Alerts',
          formatNumber(
            dashboard.flagged_or_suspicious ||
              fraudReport.length
          ),
        ],
      ],
      {
        0: {
          cellWidth: 100,
        },

        1: {
          cellWidth: 60,
          halign: 'center',
          fontStyle: 'bold',
        },
      }
    );

    /* =====================================================
       PARTICIPATION TRENDS
       ===================================================== */

    addSectionTitle('PARTICIPATION TRENDS');

    addTable(
      [
        'Month',
        'Approved Participations',
        'Active Citizens',
      ],

      participationTrends.map((item) => [
        item.month ||
          item.month_key ||
          'N/A',

        formatNumber(
          item.total_participations
        ),

        formatNumber(
          item.active_citizens
        ),
      ]),

      {
        1: {
          halign: 'center',
        },

        2: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       ACTIVITY ENGAGEMENT
       ===================================================== */

    addSectionTitle(
      'ACTIVITY ENGAGEMENT REPORT'
    );

    addTable(
      [
        'Activity',
        'Category',
        'Status',
        'Joined',
        'Approved',
        'Rejected',
        'Completion',
        'Points',
      ],

      activityReport.map((item) => [
        item.title || 'N/A',

        item.category || 'N/A',

        item.status || 'N/A',

        formatNumber(
          item.total_joined
        ),

        formatNumber(
          item.approved_count
        ),

        formatNumber(
          item.rejected_count
        ),

        String(
          item.completion_rate || '0%'
        ),

        formatNumber(
          item.total_points_generated
        ),
      ]),

      {
        0: {
          cellWidth: 55,
        },

        1: {
          cellWidth: 30,
        },

        2: {
          cellWidth: 25,
        },

        3: {
          halign: 'center',
        },

        4: {
          halign: 'center',
        },

        5: {
          halign: 'center',
        },

        6: {
          halign: 'center',
        },

        7: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       PARTICIPATION BY CATEGORY
       ===================================================== */

    addSectionTitle(
      'PARTICIPATION BY CATEGORY'
    );

    const categoryTotals = {};

    activityReport.forEach(
      (activity) => {
        const category =
          activity.category ||
          'Others';

        categoryTotals[category] =
          (categoryTotals[category] ||
            0) +
          Number(
            activity.approved_count ||
              0
          );
      }
    );

    const categoryTotal =
      Object.values(
        categoryTotals
      ).reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0
      );

    addTable(
      [
        'Category',
        'Approved Participations',
        'Percentage',
      ],

      Object.entries(
        categoryTotals
      ).map(
        ([category, count]) => [
          category,

          formatNumber(count),

          categoryTotal > 0
            ? `${(
                (count /
                  categoryTotal) *
                100
              ).toFixed(1)}%`
            : '0%',
        ]
      ),

      {
        1: {
          halign: 'center',
        },

        2: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       TOP BARANGAYS
       ===================================================== */

    addSectionTitle('TOP BARANGAYS');

    checkPage(20);

    pdf.setFillColor(
      243,
      248,
      255
    );

    pdf.setDrawColor(
      196,
      218,
      242
    );

    pdf.roundedRect(
      margin,
      y,
      pageWidth -
        margin * 2,
      15,
      2,
      2,
      'FD'
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );

    pdf.setFontSize(8);
    pdf.setTextColor(...muted);

    pdf.text(
      'Barangay participation data is not yet connected to the CitiPoints database. This section will display participating barangays once barangay data is implemented.',
      margin + 5,
      y + 9,
      {
        maxWidth:
          pageWidth -
          margin * 2 -
          10,
      }
    );

    y += 24;

    /* =====================================================
       SMART POINTS OVERVIEW
       ===================================================== */

    addSectionTitle(
      'SMART POINTS OVERVIEW'
    );

    const totalPointsAwarded =
      Number(
        dashboard.total_points_awarded ||
          0
      );

    const currentCirculation =
      Math.max(
        totalPointsAwarded -
          pointsRedeemed,
        0
      );

    const redemptionUsage =
      totalPointsAwarded > 0
        ? (
            (pointsRedeemed /
              totalPointsAwarded) *
            100
          ).toFixed(1)
        : '0.0';

    addTable(
      ['Metric', 'Value'],

      [
        [
          'Total Points Granted',
          formatNumber(
            totalPointsAwarded
          ),
        ],

        [
          'Points Used for Rewards',
          formatNumber(
            pointsRedeemed
          ),
        ],

        [
          'Current Circulation',
          formatNumber(
            currentCirculation
          ),
        ],

        [
          'Redemption Usage',
          `${redemptionUsage}%`,
        ],
      ],

      {
        0: {
          cellWidth: 100,
        },

        1: {
          cellWidth: 60,
          halign: 'center',
          fontStyle: 'bold',
        },
      }
    );

    /* =====================================================
       REWARDS REDEMPTION
       ===================================================== */

    addSectionTitle(
      'REWARDS REDEMPTION'
    );

    addTable(
      [
        'Reward',
        'Category',
        'Total Redemptions',
        'Points Spent',
      ],

      redemptionReport.map(
        (reward) => [
          reward.reward_name ||
            'N/A',

          reward.category ||
            'Other',

          formatNumber(
            reward.total_redemptions
          ),

          formatNumber(
            reward.total_points_spent
          ),
        ]
      ),

      {
        0: {
          cellWidth: 90,
        },

        2: {
          halign: 'center',
        },

        3: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       PARTNER CONTRIBUTIONS
       ===================================================== */

    addSectionTitle(
      'PARTNER CONTRIBUTIONS'
    );

    addTable(
      [
        'Partner',
        'Activities',
        'Rewards',
      ],

      partnerReport.map(
        (partner) => [
          partner.organization_name ||
            'N/A',

          formatNumber(
            partner.total_activities
          ),

          formatNumber(
            partner.total_rewards
          ),
        ]
      ),

      {
        0: {
          cellWidth: 120,
        },

        1: {
          halign: 'center',
        },

        2: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       AI-ASSISTED FRAUD ALERTS
       ===================================================== */

    addSectionTitle(
      'AI-ASSISTED FRAUD ALERTS'
    );

    addTable(
      [
        'ID',
        'Citizen',
        'Activity',
        'AI Risk Score',
        'Risk Level',
        'Status',
      ],

      fraudReport.map(
        (record) => {
          const riskScore =
            getRiskScore(
              record.ai_score
            );

          const riskLevel =
            getRiskLevel(
              record.ai_score
            );

          return [
            String(
              record.participation_id ||
                'N/A'
            ),

            record.full_name ||
              'N/A',

            record.activity_title ||
              'N/A',

            `${riskScore.toFixed(
              2
            )}%`,

            riskLevel.toUpperCase(),

            record.status ||
              'Pending',
          ];
        }
      ),

      {
        0: {
          cellWidth: 20,
        },

        1: {
          cellWidth: 45,
        },

        2: {
          cellWidth: 70,
        },

        3: {
          halign: 'center',
        },

        4: {
          halign: 'center',
        },

        5: {
          halign: 'center',
        },
      }
    );

    /* =====================================================
       HUMAN REVIEW NOTE
       ===================================================== */

    checkPage(25);

    pdf.setFillColor(
      255,
      248,
      230
    );

    pdf.setDrawColor(
      242,
      199,
      95
    );

    pdf.roundedRect(
      margin,
      y,
      pageWidth -
        margin * 2,
      17,
      2,
      2,
      'FD'
    );

    pdf.setFont(
      'helvetica',
      'bold'
    );

    pdf.setFontSize(8);
    pdf.setTextColor(
      125,
      82,
      12
    );

    pdf.text(
      'Human Review Required',
      margin + 5,
      y + 6
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );

    pdf.setFontSize(7.5);

    pdf.text(
      'AI risk scores are decision-support indicators only. Final participation approval, rejection, and other administrative actions remain with authorized LGU personnel.',
      margin + 5,
      y + 12,
      {
        maxWidth:
          pageWidth -
          margin * 2 -
          10,
      }
    );

    /* =====================================================
       PAGE NUMBERS / FOOTER
       ===================================================== */

    const totalPages =
      pdf.internal.getNumberOfPages();

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber++
    ) {
      pdf.setPage(pageNumber);

      pdf.setDrawColor(
        221,
        229,
        238
      );

      pdf.line(
        margin,
        pageHeight - 13,
        pageWidth - margin,
        pageHeight - 13
      );

      pdf.setFont(
        'helvetica',
        'normal'
      );

      pdf.setFontSize(7);
      pdf.setTextColor(...muted);

      pdf.text(
        'CITIPOINTS | Analytics & Reports',
        margin,
        pageHeight - 8
      );

      pdf.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        {
          align: 'right',
        }
      );
    }

    /* =====================================================
       DOWNLOAD PDF
       ===================================================== */

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    pdf.save(
      `CitiPoints-Analytics-Report-${date}.pdf`
    );
  } catch (error) {
    console.error(
      'PDF EXPORT ERROR:',
      error
    );

    setMessage(
      'Unable to generate the PDF report. Please try again.'
    );
  } finally {
  
  }
};

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="analytics-v2-page">
        <div className="analytics-v2-loading">
          <div className="analytics-v2-spinner" />

          <h2>Loading Analytics</h2>

          <p>
            Preparing CitiPoints analytics and reports...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="analytics-v2-page">
      {/* PRINT TITLE */}

      <div className="analytics-print-heading">
        <h1>CITIPOINTS Analytics & Reports</h1>
        <p>
          Generated {new Date().toLocaleString('en-PH')}
        </p>
      </div>

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="analytics-v2-hero">
        <div className="analytics-v2-hero-copy">
          <span>DATA &amp; INSIGHTS</span>

          <h1>Analytics &amp; Reports</h1>

          <p>
            View key statistics and trends to monitor citizen
            engagement, activity participation, Smart Points,
            rewards, and platform usage.
          </p>
        </div>

        <div className="analytics-v2-hero-graphic">
          <div className="analytics-v2-mini-line">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>

          <div className="analytics-v2-mini-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="analytics-v2-actions no-print">
          <select
            value={dateRange}
            onChange={(event) =>
              setDateRange(event.target.value)
            }
          >
            <option value="all">All Time</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last 12 Months</option>
          </select>

          <button
            type="button"
            className="analytics-v2-csv-btn"
            onClick={handleExportCSV}
          >
            ↓ Export CSV
          </button>

          <button
            type="button"
            className="analytics-v2-pdf-btn"
            onClick={handleExportPDF}
          >
            ▣ Export PDF
          </button>
        </div>
      </section>

      {message && (
        <div className="analytics-v2-error">
          {message}

          <button
            type="button"
            onClick={() => fetchReports()}
          >
            Retry
          </button>
        </div>
      )}

      {/* =====================================================
          KPI CARDS
          ===================================================== */}

      <section className="analytics-v2-kpis">
        <KpiCard
          icon="♟"
          title="Total Citizens"
          value={formatNumber(memberReport.length)}
          tone="blue"
        />

        <KpiCard
          icon="▣"
          title="Total Participations"
          value={formatNumber(totalParticipations)}
          tone="green"
        />

        <KpiCard
          icon="●"
          title="Smart Points Granted"
          value={formatNumber(
            dashboard.total_points_awarded
          )}
          tone="orange"
        />

        <KpiCard
          icon="◆"
          title="Rewards Redeemed"
          value={formatNumber(
            dashboard.total_rewards_redeemed
          )}
          tone="pink"
        />

        <KpiCard
          icon="◆"
          title="Active Partners"
          value={formatNumber(activePartners)}
          tone="blue"
        />

        <KpiCard
          icon="!"
          title="Fraud Alerts"
          value={formatNumber(
            dashboard.flagged_or_suspicious ||
              fraudReport.length
          )}
          tone="red"
        />
      </section>

      {/* =====================================================
          FIRST ROW
          ===================================================== */}

      <section className="analytics-v2-first-grid">
        {/* PARTICIPATION TREND */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="▰"
            title="Participation Trend"
            description="Approved participation submissions over time"
          />

          {participationTrends.length === 0 ? (
            <EmptyState text="No participation trend data yet." />
          ) : (
            <div className="analytics-v2-line-chart">
              <div className="analytics-v2-y-axis">
                <span>{maxTrendValue}</span>
                <span>
                  {Math.round(maxTrendValue * 0.75)}
                </span>
                <span>
                  {Math.round(maxTrendValue * 0.5)}
                </span>
                <span>
                  {Math.round(maxTrendValue * 0.25)}
                </span>
                <span>0</span>
              </div>

              <div className="analytics-v2-chart-area">
                <div className="analytics-v2-grid-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

                <svg
                  className="analytics-v2-trend-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={participationTrends
                      .map((item, index) => {
                        const count =
                          participationTrends.length;

                        const x =
                          count === 1
                            ? 50
                            : (index /
                                (count - 1)) *
                              100;

                        const value = Number(
                          item.total_participations || 0
                        );

                        const y =
                          100 -
                          (value / maxTrendValue) *
                            100;

                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {participationTrends.map(
                    (item, index) => {
                      const count =
                        participationTrends.length;

                      const x =
                        count === 1
                          ? 50
                          : (index /
                              (count - 1)) *
                            100;

                      const value = Number(
                        item.total_participations || 0
                      );

                      const y =
                        100 -
                        (value / maxTrendValue) *
                          100;

                      return (
                        <circle
                          key={
                            item.month_key || index
                          }
                          cx={x}
                          cy={y}
                          r="1.8"
                        >
                          <title>
                            {`${item.month}: ${value}`}
                          </title>
                        </circle>
                      );
                    }
                  )}
                </svg>

                <div className="analytics-v2-x-axis">
                  {participationTrends.map(
                    (item, index) => (
                      <span
                        key={
                          item.month_key || index
                        }
                      >
                        {item.month}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </article>

        {/* ACTIVITY ENGAGEMENT */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="♟"
            title="Activity Engagement Report"
            description="Participation count and completion rate per activity"
          />

          <div className="analytics-v2-engagement">
            <div className="analytics-v2-engagement-head">
              <span>Activity</span>
              <span>Participations</span>
              <span>Engagement Rate</span>
            </div>

            {topActivities.length === 0 ? (
              <EmptyState text="No activity data available." />
            ) : (
              topActivities.map((activity, index) => {
                const approved = Number(
                  activity.approved_count || 0
                );

                const percentage =
                  (approved / maxActivityCount) * 100;

                const completion =
                  getCompletionNumber(
                    activity.completion_rate
                  );

                return (
                  <div
                    className="analytics-v2-engagement-row"
                    key={activity.activity_id}
                  >
                    <div className="analytics-v2-activity-title">
                      <span
                        className={`analytics-v2-rank-dot rank-${
                          index + 1
                        }`}
                      >
                        {index + 1}
                      </span>

                      <strong>{activity.title}</strong>
                    </div>

                    <strong>{approved}</strong>

                    <div className="analytics-v2-engagement-rate">
                      <div>
                        <span
                          style={{
                            width: `${Math.min(
                              Math.max(
                                completion || percentage,
                                3
                              ),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <strong>
                        {activity.completion_rate ||
                          `${completion.toFixed(0)}%`}
                      </strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {/* CATEGORY */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="◆"
            title="Participation by Category"
            description="Distribution across activity types"
          />

          <CategoryBreakdown
            activities={activityReport}
          />
        </article>
      </section>

      {/* =====================================================
          SECOND ROW
          ===================================================== */}

      <section className="analytics-v2-second-grid">
        {/* TOP BARANGAYS */}

        <article className="analytics-v2-card analytics-v2-barangay-card">
          <CardHeading
            icon="●"
            title="Top Barangays"
            description="Participations per barangay"
          />

          <div className="analytics-v2-placeholder-note">
            Barangay data will be connected later.
          </div>

          <div className="analytics-v2-barangay-list">
            {topBarangays.map((barangay, index) => (
              <div
                className="analytics-v2-barangay-row"
                key={barangay.name}
              >
                <span>{index + 1}</span>

                <strong>{barangay.name}</strong>

                <div>
                  <i style={{ width: '0%' }} />
                </div>

                <b>—</b>
              </div>
            ))}
          </div>
        </article>

        {/* SMART POINTS */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="●"
            title="Smart Points Overview"
            description="Smart Points granted and redeemed"
          />

          <div className="analytics-v2-points-summary">
            <div>
              <span>Points Granted</span>

              <strong>
                {formatNumber(
                  dashboard.total_points_awarded
                )}
              </strong>
            </div>

            <div>
              <span>Points Redeemed</span>

              <strong>
                {formatNumber(pointsRedeemed)}
              </strong>
            </div>
          </div>

          <div className="analytics-v2-points-bars">
            <div className="analytics-v2-points-column">
              <span
                className="granted"
                style={{ height: '82%' }}
              />

              <span
                className="redeemed"
                style={{
                  height: `${
                    Number(
                      dashboard.total_points_awarded || 0
                    ) > 0
                      ? Math.max(
                          Math.min(
                            (pointsRedeemed /
                              Number(
                                dashboard.total_points_awarded
                              )) *
                              82,
                            82
                          ),
                          5
                        )
                      : 5
                  }%`,
                }}
              />
            </div>

            <div className="analytics-v2-points-numbers">
              <div>
                <span>Current Circulation</span>

                <strong>
                  {formatNumber(
                    Math.max(
                      Number(
                        dashboard.total_points_awarded || 0
                      ) - pointsRedeemed,
                      0
                    )
                  )}
                </strong>
              </div>

              <div>
                <span>Redemption Usage</span>

                <strong>
                  {Number(
                    dashboard.total_points_awarded || 0
                  ) > 0
                    ? `${(
                        (pointsRedeemed /
                          Number(
                            dashboard.total_points_awarded
                          )) *
                        100
                      ).toFixed(1)}%`
                    : '0%'}
                </strong>
              </div>
            </div>
          </div>
        </article>

        {/* REWARD REDEMPTIONS */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="◆"
            title="Rewards Redemption"
            description="Most redeemed rewards"
          />

          <div className="analytics-v2-rewards-list">
            {[...redemptionReport]
              .sort(
                (a, b) =>
                  Number(b.total_redemptions || 0) -
                  Number(a.total_redemptions || 0)
              )
              .slice(0, 5)
              .map((reward, index) => (
                <div
                  className="analytics-v2-reward-row"
                  key={reward.reward_id || index}
                >
                  <span>{index + 1}</span>

                  <div>
                    <strong>
                      {reward.reward_name}
                    </strong>

                    <small>
                      {reward.category || 'Other'}
                    </small>
                  </div>

                  <b>
                    {formatNumber(
                      reward.total_redemptions
                    )}
                  </b>
                </div>
              ))}

            {redemptionReport.length === 0 && (
              <EmptyState text="No redemption data yet." />
            )}
          </div>
        </article>
      </section>

      {/* =====================================================
          THIRD ROW
          ===================================================== */}

      <section className="analytics-v2-third-grid">
        {/* PARTNERS */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="◆"
            title="Top Partners by Activity"
            description="Partner participation and contributions"
          />

          <div className="analytics-v2-simple-table">
            <div className="analytics-v2-simple-head partners">
              <span>Partner</span>
              <span>Activities</span>
              <span>Rewards</span>
            </div>

            {topPartners.map((partner, index) => (
              <div
                className="analytics-v2-simple-row partners"
                key={partner.partner_id || index}
              >
                <strong>
                  {partner.organization_name}
                </strong>

                <span>
                  {formatNumber(
                    partner.total_activities
                  )}
                </span>

                <span>
                  {formatNumber(
                    partner.total_rewards
                  )}
                </span>
              </div>
            ))}

            {topPartners.length === 0 && (
              <EmptyState text="No partner data yet." />
            )}
          </div>
        </article>

        {/* FRAUD */}

        <article className="analytics-v2-card">
          <CardHeading
            icon="!"
            title="Recent Fraud Alerts"
            description="Recent AI-flagged participation records"
          />

          <div className="analytics-v2-simple-table fraud">
            <div className="analytics-v2-simple-head fraud">
              <span>Citizen</span>
              <span>Activity</span>
              <span>Risk</span>
              <span>Status</span>
            </div>

            {recentFraudAlerts.map(
              (record, index) => {
                const score = getRiskScore(
                  record.ai_score
                );

                const risk = getRiskLevel(
                  record.ai_score
                );

                return (
                  <div
                    className="analytics-v2-simple-row fraud"
                    key={
                      record.participation_id ||
                      index
                    }
                  >
                    <strong>
                      {record.full_name || 'N/A'}
                    </strong>

                    <span>
                      {record.activity_title || 'N/A'}
                    </span>

                    <span
                      className={`analytics-v2-risk ${risk}`}
                    >
                      {score.toFixed(2)}%
                    </span>

                    <span className="analytics-v2-status">
                      {record.status || 'Pending'}
                    </span>
                  </div>
                );
              }
            )}

            {recentFraudAlerts.length === 0 && (
              <EmptyState text="No suspicious records." />
            )}
          </div>
        </article>
      </section>

      {/* =====================================================
          FULL ACTIVITY ENGAGEMENT REPORT
          ===================================================== */}

      <section className="analytics-v2-card analytics-v2-full-report">
        <div className="analytics-v2-report-heading">
          <CardHeading
            icon="▣"
            title="Activity Engagement Report"
            description="Complete activity participation and Smart Points records"
          />

          <button
            type="button"
            className="analytics-v2-refresh no-print"
            onClick={() => fetchReports()}
          >
            ↻ Refresh Data
          </button>
        </div>

        <div className="analytics-v2-table-wrap">
          <table className="analytics-v2-report-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Category</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Completion</th>
                <th>Points</th>
              </tr>
            </thead>

            <tbody>
              {[...activityReport]
                .sort(
                  (a, b) =>
                    Number(b.approved_count || 0) -
                    Number(a.approved_count || 0)
                )
                .map((item) => (
                  <tr key={item.activity_id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>

                    <td>
                      {item.category || 'N/A'}
                    </td>

                    <td>
                      <span className="analytics-v2-table-status">
                        {item.status || 'N/A'}
                      </span>
                    </td>

                    <td>
                      {formatNumber(
                        item.total_joined
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        item.approved_count
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        item.rejected_count
                      )}
                    </td>

                    <td>
                      <span className="analytics-v2-completion">
                        {item.completion_rate ||
                          '0%'}
                      </span>
                    </td>

                    <td>
                      {formatNumber(
                        item.total_points_generated
                      )}
                    </td>
                  </tr>
                ))}

              {activityReport.length === 0 && (
                <tr>
                  <td colSpan="8">
                    <EmptyState text="No activity data available." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   KPI CARD
   ========================================================= */

function KpiCard({
  icon,
  title,
  value,
  tone = 'blue',
}) {
  return (
    <article className="analytics-v2-kpi-card">
      <div
        className={`analytics-v2-kpi-icon ${tone}`}
      >
        {icon}
      </div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

/* =========================================================
   CARD HEADING
   ========================================================= */

function CardHeading({
  icon,
  title,
  description,
}) {
  return (
    <header className="analytics-v2-card-heading">
      <div className="analytics-v2-card-icon">
        {icon}
      </div>

      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState({ text }) {
  return (
    <div className="analytics-v2-empty">
      {text}
    </div>
  );
}

/* =========================================================
   CATEGORY BREAKDOWN
   ========================================================= */

function CategoryBreakdown({ activities }) {
  const categories = useMemo(() => {
    const totals = {};

    activities.forEach((activity) => {
      const category =
        activity.category || 'Others';

      totals[category] =
        (totals[category] || 0) +
        Number(activity.approved_count || 0);
    });

    return Object.entries(totals)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [activities]);

  const total = categories.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (categories.length === 0) {
    return (
      <EmptyState text="No category data available." />
    );
  }

  const tones = [
    'green',
    'blue',
    'orange',
    'purple',
    'gray',
  ];

  let currentAngle = 0;

  const segments = categories.map(
    (category, index) => {
      const percentage =
        total > 0
          ? (category.value / total) * 100
          : 0;

      const start = currentAngle;
      const end =
        currentAngle + percentage * 3.6;

      currentAngle = end;

      return {
        ...category,
        percentage,
        tone: tones[index],
        start,
        end,
      };
    }
  );

  const colorMap = {
    green: '#20b86a',
    blue: '#2d7ff9',
    orange: '#f6b83f',
    purple: '#8b4cf6',
    gray: '#9ba9bb',
  };

  const gradient = segments
    .map(
      (segment) =>
        `${colorMap[segment.tone]} ${segment.start}deg ${segment.end}deg`
    )
    .join(', ');

  return (
    <div className="analytics-v2-category">
      <div
        className="analytics-v2-donut"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
      >
        <div>
          <strong>
            {total.toLocaleString()}
          </strong>
          <span>Total</span>
        </div>
      </div>

      <div className="analytics-v2-category-list">
        {segments.map((category) => (
          <div key={category.name}>
            <i
              className={category.tone}
            />

            <span>{category.name}</span>

            <strong>
              {category.percentage.toFixed(0)}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;