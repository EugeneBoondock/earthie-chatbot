'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LineChart,
  BarChart,
  PieChart,
  FileText,
  Download,
  Mail,
  Globe,
  TrendingUp,
  ArrowUpDown,
  Filter,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface TotalStats {
  total_minted: number;
  total_burned: number;
  total_withdrawn: number;
  total_deposited: number;
  total_bought: number;
  total_sold: number;
  unique_buyers_all_time: number;
  unique_sellers_all_time: number;
  total_transactions: number;
}

interface DailyStats {
  date: string;
  total_minted: number;
  total_burned: number;
  total_withdrawn: number;
  total_deposited: number;
  total_bought: number;
  total_sold: number;
  unique_buyers: number;
  unique_sellers: number;
  transaction_count: number;
}

const EssenceReport = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchData();
  }, [selectedTimeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch total stats from materialized view
      const { data: totalStatsData, error: totalStatsError } = await supabase
        .from('essence_total_stats')
        .select('*')
        .single();

      if (totalStatsError) throw totalStatsError;
      setTotalStats(totalStatsData);

      // Calculate date range based on selected timeRange
      const endDate = new Date();
      const startDate = new Date();
      switch (selectedTimeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setDate(endDate.getDate() - 365);
          break;
      }

      // Fetch daily stats for the selected range
      const { data: dailyStatsData, error: dailyStatsError } = await supabase
        .from('essence_stats_daily')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (dailyStatsError) throw dailyStatsError;
      setDailyStats(dailyStatsData);

      // Fetch last sync status
      const { data: syncData, error: syncError } = await supabase
        .from('essence_sync_status')
        .select('last_sync')
        .eq('id', 1)
        .single();

      if (!syncError && syncData) {
        setLastSync(syncData.last_sync);
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // TODO: Implement newsletter subscription
      setIsSubscribed(true);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Prepare chart data
  const lineChartData = {
    labels: dailyStats.map(stat => new Date(stat.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Minted',
        data: dailyStats.map(stat => stat.total_minted),
        borderColor: '#50E3C1',
        backgroundColor: 'rgba(80, 227, 193, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Burned',
        data: dailyStats.map(stat => stat.total_burned),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const barChartData = {
    labels: dailyStats.map(stat => new Date(stat.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Withdrawals',
        data: dailyStats.map(stat => stat.total_withdrawn),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
      {
        label: 'Deposits',
        data: dailyStats.map(stat => stat.total_deposited),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
      },
    ],
  };

  const pieChartData = {
    labels: ['Minted', 'Burned', 'Withdrawn', 'Deposited'],
    datasets: [{
      data: totalStats ? [
        totalStats.total_minted,
        totalStats.total_burned,
        totalStats.total_withdrawn,
        totalStats.total_deposited,
      ] : [],
      backgroundColor: [
        'rgba(80, 227, 193, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
      ],
    }],
  };

  const chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#fff',
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(80, 227, 193, 0.2)',
        borderWidth: 1,
        padding: 12,
      },
    },
  };

  return (
    <div className="min-h-screen space-y-6 p-6 lg:p-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl p-6 backdrop-blur-lg bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text mb-3">
              Earth2 Essence Report
            </h1>
            <p className="text-cyan-200/90 max-w-2xl">
              Live & Historical Tracking of Essence's Journey
            </p>
          </div>
          {lastSync && (
            <div className="flex items-center gap-2 text-sm text-cyan-200/70">
              <RefreshCw className="h-4 w-4" />
              Last updated: {new Date(lastSync).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert className="bg-rose-500/10 text-rose-200 border border-rose-500/20">
          {error}
        </Alert>
      )}

      {/* Time Range Selector */}
      <div className="flex justify-end">
        <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
          <SelectTrigger className="w-[180px] bg-earthie-dark-light/50 border-earthie-mint/20">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-earthie-mint/20">
              <Coins className="h-5 w-5 text-earthie-mint" />
            </div>
            <div>
              <p className="text-sm text-cyan-200/70">Total Minted</p>
              <p className="text-xl font-semibold text-white">
                {loading ? '...' : formatNumber(totalStats?.total_minted || 0)} ESS
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-earthie-mint/20">
              <Flame className="h-5 w-5 text-earthie-mint" />
            </div>
            <div>
              <p className="text-sm text-cyan-200/70">Total Burned</p>
              <p className="text-xl font-semibold text-white">
                {loading ? '...' : formatNumber(totalStats?.total_burned || 0)} ESS
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-earthie-mint/20">
              <ArrowDownToLine className="h-5 w-5 text-earthie-mint" />
            </div>
            <div>
              <p className="text-sm text-cyan-200/70">Total Withdrawn</p>
              <p className="text-xl font-semibold text-white">
                {loading ? '...' : formatNumber(totalStats?.total_withdrawn || 0)} ESS
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-earthie-mint/20">
              <ArrowUpFromLine className="h-5 w-5 text-earthie-mint" />
            </div>
            <div>
              <p className="text-sm text-cyan-200/70">Total Deposited</p>
              <p className="text-xl font-semibold text-white">
                {loading ? '...' : formatNumber(totalStats?.total_deposited || 0)} ESS
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mint/Burn Chart */}
        <Card className="p-6 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <h3 className="text-lg font-semibold text-white mb-4">Mint & Burn Activity</h3>
          <div className="h-[300px]">
            <Line data={lineChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  display: true,
                  text: 'Daily Mint & Burn Activity',
                  color: '#fff',
                  font: { size: 14 }
                }
              }
            }} />
          </div>
        </Card>

        {/* Withdrawal/Deposit Chart */}
        <Card className="p-6 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <h3 className="text-lg font-semibold text-white mb-4">Withdrawal & Deposit Activity</h3>
          <div className="h-[300px]">
            <Bar data={barChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  display: true,
                  text: 'Daily Withdrawal & Deposit Activity',
                  color: '#fff',
                  font: { size: 14 }
                }
              }
            }} />
          </div>
        </Card>

        {/* Distribution Pie Chart */}
        <Card className="p-6 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <h3 className="text-lg font-semibold text-white mb-4">Token Distribution</h3>
          <div className="h-[300px]">
            <Pie data={pieChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  display: true,
                  text: 'Overall Token Distribution',
                  color: '#fff',
                  font: { size: 14 }
                }
              }
            }} />
          </div>
        </Card>

        {/* Stats Summary */}
        <Card className="p-6 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Unique Buyers</p>
                <p className="text-lg font-semibold text-white">
                  {loading ? '...' : formatNumber(totalStats?.unique_buyers_all_time || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Unique Sellers</p>
                <p className="text-lg font-semibold text-white">
                  {loading ? '...' : formatNumber(totalStats?.unique_sellers_all_time || 0)}
                </p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
              <p className="text-sm text-cyan-200/70 mb-1">Total Transactions</p>
              <p className="text-lg font-semibold text-white">
                {loading ? '...' : formatNumber(totalStats?.total_transactions || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Newsletter Signup */}
      <Card className="p-6 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border-earthie-mint/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Subscribe to Weekly Reports</h3>
            <p className="text-cyan-200/70">Get detailed Essence analytics delivered to your inbox</p>
          </div>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 min-w-[300px]">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-earthie-dark-light/50 border-earthie-mint/20"
            />
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[120px] bg-earthie-dark-light/50 border-earthie-mint/20">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90">
              <Mail className="h-4 w-4 mr-2" />
              Subscribe
            </Button>
          </form>
        </div>
        {error && (
          <Alert className="mt-4 bg-rose-500/10 text-rose-200 border border-rose-500/20">
            {error}
          </Alert>
        )}
        {isSubscribed && (
          <Alert className="mt-4 bg-emerald-500/10 text-emerald-200 border border-emerald-500/20">
            Successfully subscribed! Check your email for confirmation.
          </Alert>
        )}
      </Card>

      {/* Export Options */}
      <div className="flex flex-wrap gap-4">
        <Button variant="outline" className="bg-earthie-dark-light/50 border-earthie-mint/20 text-earthie-mint hover:bg-earthie-mint/10">
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </Button>
        <Button variant="outline" className="bg-earthie-dark-light/50 border-earthie-mint/20 text-earthie-mint hover:bg-earthie-mint/10">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>
    </div>
  );
};

export default EssenceReport; 