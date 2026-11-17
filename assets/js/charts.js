/* ============================================================
   FlowTrack — Chart.js helpers
   All charts are destroyed and rebuilt with each page render.
   ============================================================ */

const Charts = (() => {
  const instances = new Map();
  let configured = false;

  const COLORS = {
    primary: '#4f46e5',
    primarySoft: 'rgba(79, 70, 229, 0.14)',
    primaryFaint: 'rgba(79, 70, 229, 0.04)',
    success: '#10b981',
    successSoft: 'rgba(16, 185, 129, 0.12)',
    amber: '#f59e0b',
    blue: '#3b82f6',
    slate: '#94a3b8',
    grid: '#edf1f7',
    text: '#64748b'
  };

  function available() { return typeof window.Chart !== 'undefined'; }

  function configure() {
    if (configured || !available()) return;
    configured = true;
    const defaults = window.Chart.defaults;
    defaults.font.family = getComputedStyle(document.body).fontFamily || 'Inter, sans-serif';
    defaults.font.size = 10.5;
    defaults.color = COLORS.text;
    defaults.borderColor = COLORS.grid;
    defaults.animation.duration = 480;
    defaults.animation.easing = 'easeOutQuart';
    defaults.plugins.legend.display = false;
    defaults.plugins.tooltip.backgroundColor = '#10182b';
    defaults.plugins.tooltip.titleColor = '#f8fafc';
    defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    defaults.plugins.tooltip.footerColor = '#94a3b8';
    defaults.plugins.tooltip.padding = 10;
    defaults.plugins.tooltip.cornerRadius = 8;
    defaults.plugins.tooltip.displayColors = true;
    defaults.plugins.tooltip.boxPadding = 4;
    defaults.plugins.tooltip.titleFont = { size: 11, weight: '600' };
    defaults.plugins.tooltip.bodyFont = { size: 10.5 };
    defaults.plugins.tooltip.events = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'];
    defaults.plugins.tooltip.callbacks.label = (ctx) => {
      const value = ctx.parsed.y;
      if (ctx.dataset.unit === 'hours') return `${ctx.dataset.label}: ${Utils.formatDuration(Math.round(value * 60))}`;
      if (ctx.dataset.unit === 'percent') return `${ctx.dataset.label}: ${value}%`;
      if (ctx.dataset.unit === 'tasks') return `${ctx.dataset.label}: ${value} task${value === 1 ? '' : 's'}`;
      return `${ctx.dataset.label}: ${value}`;
    };
  }

  function destroyAll() {
    instances.forEach((chart) => {
      try { chart.destroy(); } catch (_) {}
    });
    instances.clear();
  }

  function render(id, config) {
    configure();
    if (!available()) return null;
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    if (instances.has(id)) {
      try { instances.get(id).destroy(); } catch (_) {}
      instances.delete(id);
    }
    try {
      const chart = new window.Chart(canvas.getContext('2d'), config);
      instances.set(id, chart);
      return chart;
    } catch (err) {
      console.error('Chart render failed', id, err);
      return null;
    }
  }

  function labelForDay(dayKey, count) {
    return count <= 8 ? Utils.formatDate(dayKey, 'weekday-short') : Utils.formatDate(dayKey, 'short');
  }

  function baseScales(extra = {}) {
    return {
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { color: '#8794a8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, padding: 4, font: { size: 9.5 } },
        ...(extra.x || {})
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: COLORS.grid, drawTicks: false },
        ticks: { color: '#9aa6b8', padding: 6, font: { size: 9.5 }, callback: (v) => `${v}h` },
        ...(extra.y || {})
      }
    };
  }

  function hoursBar(id, days) {
    const count = days.length;
    const labels = days.map((d) => labelForDay(d.key, count));
    const working = days.map((d) => Number((d.trackedMinutes / 60).toFixed(2)));
    const productive = days.map((d) => Number((d.productiveMinutes / 60).toFixed(2)));
    const targetHours = Store.getSettings().dailyTargetHours;
    return render(id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Working hours',
            data: working,
            unit: 'hours',
            backgroundColor: 'rgba(79, 70, 229, 0.78)',
            hoverBackgroundColor: COLORS.primary,
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 23,
            order: 2
          },
          {
            label: 'Productive hours',
            data: productive,
            unit: 'hours',
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            hoverBackgroundColor: COLORS.success,
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 23,
            order: 2
          },
          {
            label: 'Daily target',
            type: 'line',
            data: days.map(() => targetHours),
            borderColor: '#cbd5e1',
            borderWidth: 1.3,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 1,
            unit: 'hours'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6 } },
        scales: baseScales({ y: { suggestedMax: Math.max(targetHours + 2, Math.ceil(Math.max(...working, 0) / 2) * 2 + 1) } }),
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === 'Daily target') return `Daily target: ${targetHours}h`;
                return `${ctx.dataset.label}: ${Utils.formatDuration(Math.round((ctx.parsed.y || 0) * 60))}`;
              }
            }
          }
        }
      }
    });
  }

  function statusDonut(id, breakdown) {
    const data = breakdown.map((item) => item.value);
    const total = data.reduce((a, b) => a + b, 0);
    const display = total ? data : [1];
    const colors = total ? breakdown.map((item) => item.color) : ['#eef1f8'];
    return render(id, {
      type: 'doughnut',
      data: {
        labels: total ? breakdown.map((item) => item.label) : ['No tasks'],
        datasets: [{
          data: display,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: total ? 5 : 0,
          spacing: total ? 2 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '73%',
        plugins: {
          tooltip: {
            enabled: Boolean(total),
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed;
                return `${ctx.label}: ${value} (${Utils.pct(value, total)}%)`;
              }
            }
          }
        }
      }
    });
  }

  function productivityLine(id, days) {
    const count = days.length;
    const labels = days.map((d) => labelForDay(d.key, count));
    const data = days.map((d) => (d.trackedMinutes > 0 ? d.productivity : null));
    return render(id, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Productivity',
          data,
          unit: 'percent',
          borderColor: COLORS.primary,
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: COLORS.primary,
          pointBorderWidth: 2,
          tension: 0.35,
          spanGaps: true,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return COLORS.primaryFaint;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(79, 70, 229, 0.20)');
            gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
            return gradient;
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: baseScales({
          y: {
            beginAtZero: true, max: 100,
            ticks: { color: '#9aa6b8', padding: 6, font: { size: 9.5 }, stepSize: 25, callback: (v) => `${v}%` }
          }
        }),
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => (ctx.parsed.y == null ? 'No tracked time' : `Productivity: ${ctx.parsed.y}%`)
            }
          }
        }
      }
    });
  }

  function projectDonut(id, projects) {
    const filtered = projects.filter((p) => p.minutes > 0);
    const total = filtered.reduce((sum, p) => sum + p.minutes, 0);
    return render(id, {
      type: 'doughnut',
      data: {
        labels: filtered.length ? filtered.map((p) => p.name) : ['No tracked time'],
        datasets: [{
          data: filtered.length ? filtered.map((p) => p.minutes) : [1],
          backgroundColor: filtered.length ? filtered.map((p) => p.color) : ['#eef1f8'],
          borderWidth: 0,
          hoverOffset: filtered.length ? 5 : 0,
          spacing: filtered.length ? 2 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          tooltip: {
            enabled: filtered.length > 0,
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed;
                return `${ctx.label}: ${Utils.formatDuration(value)} (${Utils.pct(value, total)}%)`;
              }
            }
          }
        }
      }
    });
  }

  function dailyPerformance(id, days) {
    const count = days.length;
    const labels = days.map((d) => labelForDay(d.key, count));
    return render(id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Working hours', data: days.map((d) => Number((d.trackedMinutes / 60).toFixed(2))),
            unit: 'hours', backgroundColor: 'rgba(79, 70, 229, 0.8)', hoverBackgroundColor: COLORS.primary,
            borderRadius: 5, borderSkipped: false, maxBarThickness: 24, yAxisID: 'y', order: 2
          },
          {
            label: 'Productive hours', data: days.map((d) => Number((d.productiveMinutes / 60).toFixed(2))),
            unit: 'hours', backgroundColor: 'rgba(16, 185, 129, 0.55)', hoverBackgroundColor: COLORS.success,
            borderRadius: 5, borderSkipped: false, maxBarThickness: 24, yAxisID: 'y', order: 2
          },
          {
            label: 'Tasks completed', type: 'line', data: days.map((d) => d.completedCount),
            unit: 'tasks', borderColor: COLORS.amber, backgroundColor: COLORS.amber,
            borderWidth: 2, tension: 0.35, pointRadius: 2.5, pointHoverRadius: 5,
            pointBackgroundColor: '#fff', pointBorderColor: COLORS.amber, pointBorderWidth: 2,
            yAxisID: 'y1', order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: baseScales().x,
          y: baseScales().y,
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: Math.max(3, ...days.map((d) => d.completedCount)) + 1,
            border: { display: false },
            grid: { drawOnChartArea: false },
            ticks: { color: COLORS.amber, precision: 0, padding: 6, font: { size: 9.5 }, callback: (v) => `${v}` }
          }
        }
      }
    });
  }

  function dailyArea(id, days) {
    const labels = days.map((d) => Utils.formatDate(d.key, 'short'));
    const target = Store.getSettings().dailyTargetHours;
    const grad = (colorTop, colorBottom) => (context) => {
      const { ctx, chartArea } = context.chart;
      if (!chartArea) return colorTop;
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      gradient.addColorStop(0, colorTop);
      gradient.addColorStop(1, colorBottom);
      return gradient;
    };
    return render(id, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Working hours', unit: 'hours',
            data: days.map((d) => Number((d.trackedMinutes / 60).toFixed(2))),
            borderColor: COLORS.primary, borderWidth: 2,
            pointRadius: days.length > 20 ? 0 : 2.5, pointHoverRadius: 5,
            pointBackgroundColor: '#fff', pointBorderColor: COLORS.primary, pointBorderWidth: 2,
            tension: 0.35, fill: true,
            backgroundColor: grad('rgba(79,70,229,.18)', 'rgba(79,70,229,0)'),
            order: 2
          },
          {
            label: 'Productive hours', unit: 'hours',
            data: days.map((d) => Number((d.productiveMinutes / 60).toFixed(2))),
            borderColor: COLORS.success, borderWidth: 1.8,
            borderDash: [5, 4],
            pointRadius: 0, pointHoverRadius: 4,
            tension: 0.35, fill: false, order: 1
          },
          {
            label: 'Daily target', unit: 'hours',
            data: days.map(() => target),
            borderColor: '#cbd5e1', borderWidth: 1.2, borderDash: [4, 4],
            pointRadius: 0, pointHoverRadius: 0, fill: false, order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: baseScales({
          x: { ticks: { color: '#8794a8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12, padding: 4, font: { size: 9 } } },
          y: { suggestedMax: Math.max(target + 3, ...days.map((d) => (d.trackedMinutes / 60))) }
        }),
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === 'Daily target') return `Daily target: ${target}h`;
                return `${ctx.dataset.label}: ${Utils.formatDuration(Math.round((ctx.parsed.y || 0) * 60))}`;
              }
            }
          }
        }
      }
    });
  }

  function weeklyPerformance(id, buckets) {
    const labels = buckets.map((b) => `W${b.index}`);
    const productivity = buckets.map((b) => b.stats.productivity);
    const hours = buckets.map((b) => Number((b.stats.trackedMinutes / 60).toFixed(2)));
    return render(id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Productivity', unit: 'percent', data: productivity,
            backgroundColor: 'rgba(79, 70, 229, 0.75)', hoverBackgroundColor: COLORS.primary,
            borderRadius: 6, borderSkipped: false, maxBarThickness: 38, yAxisID: 'y', order: 2
          },
          {
            label: 'Hours tracked', type: 'line', unit: 'hours', data: hours,
            borderColor: COLORS.success, backgroundColor: COLORS.success,
            borderWidth: 2, tension: 0.35, pointRadius: 3, pointHoverRadius: 5,
            pointBackgroundColor: '#fff', pointBorderColor: COLORS.success, pointBorderWidth: 2,
            yAxisID: 'y1', order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: baseScales().x,
          y: {
            beginAtZero: true, max: 100,
            border: { display: false }, grid: { color: COLORS.grid, drawTicks: false },
            ticks: { color: '#9aa6b8', padding: 6, font: { size: 9.5 }, callback: (v) => `${v}%` }
          },
          y1: {
            position: 'right', beginAtZero: true,
            border: { display: false }, grid: { drawOnChartArea: false },
            ticks: { color: COLORS.success, padding: 6, font: { size: 9.5 }, callback: (v) => `${v}h` }
          }
        }
      }
    });
  }

  return { available, destroyAll, render, hoursBar, statusDonut, productivityLine, projectDonut, dailyPerformance, dailyArea, weeklyPerformance, COLORS };
})();

window.Charts = Charts;
