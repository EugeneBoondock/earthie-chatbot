import { ChartOptions } from 'chart.js';

export const chartOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  color: '#fff',
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: '#94A3B8',
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: '#94A3B8',
      },
    },
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: '#fff',
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(80, 227, 193, 0.3)',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }).format(context.parsed.y);
            label += ' ESS';
          }
          return label;
        }
      }
    },
  },
}; 