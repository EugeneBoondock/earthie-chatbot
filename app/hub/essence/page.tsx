'use client';

import React, { useState, useEffect } from 'react';
import { Alert } from '@mui/material';
import { BarChart3, TrendingUp, Wallet, Users, Search, ChevronLeft, ChevronRight, ArrowUpDown, AlertCircle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  Scale,
  ScriptableContext,
  CoreScaleOptions
} from 'chart.js';
import { createClient } from '@supabase/supabase-js';
import { usePriceContext } from '@/contexts/PriceContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ESSENCE_TOKEN_ADDRESS = "0x2c0687215aca7f5e2792d956e170325e92a02aca";
const PAIR_ADDRESS = "0x2afeaf811fe57b72cb496e841113b020a5cf0d60";

interface StatsData {
  priceUsd?: string;
  priceChange24h?: number;
  total_volume?: number;
  market_cap?: number;
  holders?: number;
  circulating_supply?: number;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

const TRANSACTIONS_PER_PAGE = 5;
const EARTH2_WITHDRAWAL_ADDRESS = "0x68d332EC97800Aa1a112160195cc281978eC8Eea";
const WALLET_STORAGE_KEY = 'last_essence_wallet_address';

interface TransactionTotals {
  totalWithdrawn: number;
  totalDeposited: number;
  totalSold: number;
  totalBought: number;
  fiatTotalWithdrawn: number;
  fiatTotalDeposited: number;
  fiatTotalSold: number;
  fiatTotalBought: number;
}

// Add interface for latest transaction
interface LatestTransaction {
  type: 'BOUGHT' | 'SOLD' | 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;
  value: number;
  address: string;
  timestamp: number;
}

const EssenceTracker: React.FC = () => {
  const { selectedCurrency, currentPrice: currentEssencePrice } = usePriceContext();
  const [stats, setStats] = useState<StatsData>({ holders: undefined });
  const [error, setError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [transactionTotals, setTransactionTotals] = useState<TransactionTotals>({
    totalWithdrawn: 0,
    totalDeposited: 0,
    totalSold: 0,
    totalBought: 0,
    fiatTotalWithdrawn: 0,
    fiatTotalDeposited: 0,
    fiatTotalSold: 0,
    fiatTotalBought: 0,
  });
  
  // Wallet tracking states
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [latestTransaction, setLatestTransaction] = useState<LatestTransaction | null>(null);
  const [latestGlobalTransaction, setLatestGlobalTransaction] = useState<LatestTransaction | null>(null);
  const [lastCheckedBlock, setLastCheckedBlock] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  useEffect(() => {
  const fetchStats = async () => {
      setLoadingStats(true);
      setError(null);
  try {
      // Fetch Dexscreener stats
    const statsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ESSENCE_TOKEN_ADDRESS}`
    );
    if (!statsRes.ok) {
      throw new Error(`Dexscreener stats fetch failed: ${statsRes.statusText}`);
    }
    const statsJson = await statsRes.json();
        
    // Find the main Uniswap v3 pair
        const mainPair = statsJson.pairs.find((p: any) => p.pairAddress.toLowerCase() === PAIR_ADDRESS.toLowerCase());
    if (!mainPair) throw new Error('Main Uniswap v3 pair not found in Dexscreener response');

        // Set initial stats from DexScreener
    setStats(prev => ({
      ...prev,
          priceUsd: mainPair.priceUsd,
          priceChange24h: mainPair.priceChange?.h24,
      total_volume: mainPair.volume?.h24 ?? 0,
      market_cap: mainPair.marketCap ?? 0,
      }));

        // Fetch Earth2 metrics
      const metricsRes = await fetch('/api/e2/metrics');
      if (!metricsRes.ok) {
        throw new Error(`E2 metrics fetch failed: ${metricsRes.statusText}`);
      }
      const metricsJson = await metricsRes.json();
      const metrics = metricsJson?.data?.attributes;
      
      if (metrics && metrics.essMinted && metrics.essBurnt) {
        const circulatingSupply = Number(metrics.essMinted) - Number(metrics.essBurnt);
        
          // Fetch holders count from Etherscan using the correct endpoint
          const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
          const holdersRes = await fetch(
            `https://api.etherscan.io/api?module=token&action=tokenholdercount&contractaddress=${ESSENCE_TOKEN_ADDRESS}&apikey=${etherscanApiKey}`
          );
          const holdersData = await holdersRes.json();
          
          const holdersCount = holdersData.status === '1' ? parseInt(holdersData.result) : (metrics.holders || 0);
          
          // Update with E2 metrics data and holders count
        setStats(prev => ({
          ...prev,
          circulating_supply: circulatingSupply,
            holders: holdersCount,
        }));
      }
      } catch (err: any) {
      console.error('Error fetching stats:', err);
        setError(`Failed to load market data: ${err.message}`);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ETH price in USD from Coingecko
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        if (data?.ethereum?.usd) {
          setEthPrice(data.ethereum.usd);
        }
      } catch (err) {
        console.error('Error fetching ETH price:', err);
      }
    };
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  // Function to fetch latest global transactions using Dexscreener
  const fetchLatestGlobalTransactions = async () => {
    try {
      // Use Dexscreener API to get pair info
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/ethereum/${PAIR_ADDRESS}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch from Dexscreener: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.pairs?.[0]?.txns?.h1) {
      return;
    }

      const pair = data.pairs[0];
      const recentTxns = pair.txns.h1;
      
      // Calculate total volume in the last hour
      const totalVolume = recentTxns.buys + recentTxns.sells;
      
      if (totalVolume > 0) {
        // Determine if latest transaction was buy or sell based on which has more volume
        const isBuy = recentTxns.buys > recentTxns.sells;
        
        setLatestGlobalTransaction({
          type: isBuy ? 'BOUGHT' : 'SOLD',
          amount: totalVolume,
          value: totalVolume * parseFloat(pair.priceUsd),
          address: 'Recent',
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    } catch (err) {
      console.error('Error fetching latest global transactions:', err);
    }
  };

  // Calculate transaction totals using current price
  const calculateTransactionTotals = (transactions: Transaction[]) => {
    const totals = transactions.reduce((acc, tx) => {
      // Use value as ESS directly (no division)
      const value = parseFloat(tx.value);
      const fiatValue = value * Number(currentEssencePrice || 0);
      const txType = getTransactionType(tx).type;

      switch (txType) {
        case 'WITHDRAWAL':
          acc.totalWithdrawn += value;
          acc.fiatTotalWithdrawn += fiatValue;
          break;
        case 'DEPOSIT':
          acc.totalDeposited += value;
          acc.fiatTotalDeposited += fiatValue;
          break;
        case 'SOLD':
          acc.totalSold += value;
          acc.fiatTotalSold += fiatValue;
          break;
        case 'BOUGHT':
          acc.totalBought += value;
          acc.fiatTotalBought += fiatValue;
          break;
      }
      return acc;
    }, {
      totalWithdrawn: 0,
      totalDeposited: 0,
      totalSold: 0,
      totalBought: 0,
      fiatTotalWithdrawn: 0,
      fiatTotalDeposited: 0,
      fiatTotalSold: 0,
      fiatTotalBought: 0,
    });

    setTransactionTotals(totals);
  };

  // Update totals when transactions or price changes
  useEffect(() => {
    if (transactions.length > 0) {
      calculateTransactionTotals(transactions);
    }
  }, [transactions, currentEssencePrice, selectedCurrency]);

  // Fetch transactions from Supabase
  const fetchTransactions = async (addressToFetch: string) => {
    const { data: txData, error: txError } = await supabase
      .from('essence_transactions')
      .select('*')
      .eq('wallet_address', addressToFetch.toLowerCase())
      .order('timestamp', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return;
    }

          if (txData) {
        const formattedTxs = txData.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timeStamp: tx.timestamp.toString(),
          type: tx.transaction_type
        }));
      setTransactions(formattedTxs);
      calculateTransactionTotals(formattedTxs);

      // Set latest transaction for activity
      if (formattedTxs.length > 0) {
        const latest = formattedTxs[0];
        const txType = getTransactionType(latest);
        const value = parseFloat(latest.value);
        
        setLatestTransaction({
          type: txType.type as any,
          amount: value,
          value: value * (currentEssencePrice || 0),
          address: latest.from.slice(0, 6),
          timestamp: parseInt(latest.timeStamp)
        });
      }
    }
  };

  const fetchWallet = async (addressToFetch: string = address) => {
    if (!addressToFetch) return;
    setLoadingWallet(true);
    setWalletError(null);

    try {
      // Save address to localStorage
      localStorage.setItem(WALLET_STORAGE_KEY, addressToFetch);

      // Fetch ETH and ESS balances
      const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
      const [balanceRes, tokenBalanceRes] = await Promise.all([
        fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${addressToFetch}&tag=latest&apikey=${apiKey}`),
        fetch(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${ESSENCE_TOKEN_ADDRESS}&address=${addressToFetch}&tag=latest&apikey=${apiKey}`)
      ]);

      const [balanceData, tokenBalanceData] = await Promise.all([
        balanceRes.json(),
        tokenBalanceRes.json()
      ]);

      if (balanceData.status === '1') {
        setBalance((parseInt(balanceData.result) / 1e18).toFixed(4));
      }
      if (tokenBalanceData.status === '1') {
        setTokenBalance((parseInt(tokenBalanceData.result) / 1e18).toFixed(4));
      }

      // Fetch transactions
      await fetchTransactions(addressToFetch);

    } catch (err: any) {
      console.error('Error fetching wallet data:', err);
      setWalletError(err.message);
    } finally {
      setLoadingWallet(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getTransactionType = (tx: Transaction) => {
    const isFromEarth2 = tx.from.toLowerCase() === EARTH2_WITHDRAWAL_ADDRESS.toLowerCase();
    const isFromEssenceContract = tx.from.toLowerCase() === ESSENCE_TOKEN_ADDRESS.toLowerCase();
    const isToEssenceContract = tx.to.toLowerCase() === ESSENCE_TOKEN_ADDRESS.toLowerCase();

    if (isFromEarth2) {
      return { text: 'Withdrew from Earth2', color: 'text-blue-400', type: 'WITHDRAWAL' };
    }

    if (!isToEssenceContract && !isFromEarth2 && !isFromEssenceContract) {
      return { text: 'Sold', color: 'text-rose-400', type: 'SOLD' };
    }

    if (!isFromEarth2 && !isFromEssenceContract) {
      return { text: 'Bought', color: 'text-emerald-400', type: 'BOUGHT' };
    }

    return { text: 'Transfer', color: 'text-gray-400', type: 'TRANSFER' };
  };

  // Process transactions for the bar chart with proper decimal handling
  const processTransactionsForGraph = (txs: Transaction[]) => {
    // Group by month
    const monthlyData = new Map<string, { withdrawals: number, bought: number, sold: number }>();
    
    txs.forEach(tx => {
      const date = new Date(parseInt(tx.timeStamp) * 1000);
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { withdrawals: 0, bought: 0, sold: 0 });
      }
      
      const data = monthlyData.get(monthKey)!;
      const amount = parseFloat(tx.value); // Already in ESS
      
      if (tx.from.toLowerCase() === EARTH2_WITHDRAWAL_ADDRESS.toLowerCase()) {
        data.withdrawals += amount;
      } else if (tx.from.toLowerCase() === address.toLowerCase()) {
        data.sold += amount;
      } else {
        data.bought += amount;
      }
    });

    const months = Array.from(monthlyData.keys()).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      labels: months,
      datasets: [
        {
          label: 'Bought',
          data: months.map(month => monthlyData.get(month)!.bought),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderRadius: 4,
          stack: 'stack0',
        },
        {
          label: 'Withdrew from Earth2',
          data: months.map(month => monthlyData.get(month)!.withdrawals),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 4,
          stack: 'stack0',
        },
        {
          label: 'Sold',
          data: months.map(month => -monthlyData.get(month)!.sold),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderRadius: 4,
          stack: 'stack1',
        }
      ]
    };
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          callback: function(this: Scale<CoreScaleOptions>, tickValue: string | number) {
            return `${Math.abs(Number(tickValue)).toFixed(0)} ESS`;
          },
          font: {
            size: 11
          }
        },
        stacked: true
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#fff',
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            const value = Math.abs(context.raw as number);
            return `${context.dataset.label}: ${value.toFixed(2)} ESS`;
          }
        }
      },
    },
  };

  // Get paginated transactions
  const getPaginatedTransactions = () => {
    const sorted = [...transactions].sort((a, b) => {
      const timeA = parseInt(a.timeStamp);
      const timeB = parseInt(b.timeStamp);
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    
    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    return sorted.slice(startIndex, startIndex + TRANSACTIONS_PER_PAGE);
  };

  const totalPages = Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE);

  // Format fiat values using the global currency
  const formatFiat = (value: number) => {
    const convertedValue = selectedCurrency === 'usd' 
      ? value 
      : value * (currentEssencePrice || 0);
      
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: selectedCurrency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedValue);
  };

  // Update transaction value rendering
  const renderTransactionValue = (tx: Transaction) => {
    const essValue = parseFloat(tx.value); // Already in ESS
    const fiatValue = essValue * Number(currentEssencePrice || 0);
    
    return (
      <div className="text-right">
        <div className="text-sm text-white font-medium">
          {essValue.toFixed(4)} ESS
        </div>
        <div className="text-xs text-gray-400">
          {formatFiat(fiatValue)}
        </div>
      </div>
    );
  };

  // Add function to format wallet address
  const formatAddress = (address: string) => {
    return `${address.slice(-4)}`;
  };

  // Add function to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Load last used wallet address and fetch data
  useEffect(() => {
    const savedAddress = localStorage.getItem(WALLET_STORAGE_KEY);
    if (savedAddress) {
      setAddress(savedAddress);
      fetchWallet(savedAddress);
      
      // Poll for new transactions every 10 seconds
      const transactionInterval = setInterval(() => {
        fetchTransactions(savedAddress);
      }, 10000);

      return () => {
        clearInterval(transactionInterval);
      };
    }
  }, []);

  // --- UNISWAP V3 SUBGRAPH ACTIVITY FEED ---
  const fetchLatestUniswapTrade = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY;
      if (!apiKey || apiKey.includes('<YOUR_API_KEY>')) {
        console.error('The Graph API key is missing or malformed. Please set THE_GRAPH_API_KEY in your .env.local file.');
        return;
      }
      const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            pool(id: "0x2afeaf811fe57b72cb496e841113b020a5cf0d60") {
              swaps(first: 1, orderBy: timestamp, orderDirection: desc) {
                amount1
                amountUSD
                sender
                timestamp
              }
            }
          }`
        })
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.errors) {
        console.error('The Graph API error:', data.errors);
        return;
      }
      const swap = data?.data?.pool?.swaps?.[0];
      if (
        swap &&
        swap.sender &&
        Math.abs(parseFloat(swap.amount1)) > 0 &&
        ethPrice &&
        stats?.priceUsd
      ) {
        const isBuy = parseFloat(swap.amount1) > 0;
        const ethAmount = Math.abs(parseFloat(swap.amount1));
        const usdValue = ethAmount * ethPrice;
        const essencePrice = parseFloat(stats.priceUsd);
        const essenceAmount = usdValue / essencePrice;
        setLatestGlobalTransaction({
          type: isBuy ? 'BOUGHT' : 'SOLD',
          amount: essenceAmount,
          value: usdValue,
          address: swap.sender.slice(-4),
          timestamp: parseInt(swap.timestamp)
        });
      }
    } catch (err) {
      console.error('Error fetching from The Graph:', err);
    }
  };

  // Poll for latest Uniswap trade every 10s, but only if ethPrice and stats?.priceUsd are available
  useEffect(() => {
    if (!ethPrice || !stats?.priceUsd) return;
    fetchLatestUniswapTrade();
    const interval = setInterval(fetchLatestUniswapTrade, 10000);
    return () => clearInterval(interval);
  }, [ethPrice, stats?.priceUsd]);

  // Fetch holders count from Supabase
  const fetchHoldersCountFromSupabase = async () => {
    const { data, error } = await supabase
      .from('essence_holders')
      .select('count')
      .eq('id', 1)
      .maybeSingle(); // Use maybeSingle to allow null if not found

    if (error || !data) {
      return null;
    }
    // data.count may be 0, so check for undefined/null, not falsy
    return typeof data.count === 'number' ? data.count : null;
  };

  // Fetch holders count from Ethplorer and upsert to Supabase
  const fetchAndUpsertHoldersCountFromEthplorer = async () => {
    try {
      const response = await fetch('https://api.ethplorer.io/getTokenInfo/0x2c0687215aca7f5e2792d956e170325e92a02aca?apiKey=freekey');
      if (!response.ok) return null;
      const data = await response.json();
      if (data && typeof data.holdersCount === 'number' && data.holdersCount > 0) {
        // Upsert to Supabase
        await supabase.from('essence_holders').upsert([
          {
            id: 1,
            count: data.holdersCount,
            updated_at: new Date().toISOString(),
          }
        ], { onConflict: 'id' });
        return data.holdersCount;
      }
    } catch (err) {
      console.error('Error fetching holders from Ethplorer:', err);
    }
    return null;
  };

  // On mount and every 12 hours, fetch from Supabase and display. In the background, update from Ethplorer and upsert to Supabase, but do not update UI from Ethplorer.
  useEffect(() => {
    const fetchAndDisplay = async () => {
      const supabaseCount = await fetchHoldersCountFromSupabase();
      if (supabaseCount !== undefined) {
        setStats(prev => ({ ...prev, holders: supabaseCount as number }));
      }
      // In the background, update from Ethplorer and upsert to Supabase
      fetchAndUpsertHoldersCountFromEthplorer();
    };
    fetchAndDisplay();
    const interval = setInterval(fetchAndDisplay, 43200000);
    return () => clearInterval(interval);
  }, []);

  const ActivityBanner = ({ transaction }: { transaction: LatestTransaction | null }) => {
    if (!transaction) return null;

    const formattedAmount = formatNumber(transaction.amount);
    const formattedValue = formatCurrency(transaction.value);
    const isPositive = transaction.type === 'BOUGHT';
    const actionText = isPositive ? 'bought' : 'sold';
    const textColor = isPositive ? 'text-green-500' : 'text-red-500';

  return (
      <div className="flex items-center justify-end px-4 py-2 text-sm bg-black/20 backdrop-blur-sm rounded-lg">
        <span className={`${textColor} font-medium`}>
          {transaction.address} {actionText} {formattedAmount} ESS for {formattedValue}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl p-4 sm:p-6 backdrop-blur-lg bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text mb-2 sm:mb-3">
            Essence Token Tracker
          </h1>
          <p className="text-sm sm:text-base text-cyan-200/90 max-w-2xl">
            Real-time DEX price chart and statistics for the ESS token on Ethereum network
          </p>
        </div>
        {latestGlobalTransaction && (
          <div className="flex-shrink-0 px-4 py-3 rounded-xl backdrop-blur-sm bg-white/10 border border-earthie-mint/20 flex items-center gap-3 min-w-[260px] justify-end">
            <AlertCircle className="h-4 w-4 text-earthie-mint" />
            <span className={`text-sm font-medium ${
              latestGlobalTransaction.type === 'BOUGHT' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {latestGlobalTransaction.address} has {latestGlobalTransaction.type === 'BOUGHT' ? 'bought' : 'sold'} {latestGlobalTransaction.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} Essence for ${latestGlobalTransaction.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {error && (
        <Alert 
          severity="error" 
          className="bg-rose-500/10 text-rose-200 border border-rose-500/20 rounded-lg text-sm sm:text-base"
        >
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Price Card */}
        <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-earthie-mint/20">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-earthie-mint" />
        </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-cyan-200/70">Price (USD)</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base sm:text-xl font-semibold text-white truncate">
                  {loadingStats ? '...' : `$${stats?.priceUsd}`}
                </p>
                {!loadingStats && stats?.priceChange24h && (
                  <span className={`text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 rounded ${
                    Number(stats.priceChange24h) >= 0 
                      ? 'bg-emerald-500/20 text-emerald-200' 
                      : 'bg-rose-500/20 text-rose-200'
                  }`}>
                    {Number(stats.priceChange24h).toFixed(2)}%
                  </span>
                )}
        </div> 
            </div>
                              </div>
                </div>

        {/* Volume Card */}
        <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-earthie-mint/20">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-earthie-mint" />
                </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-cyan-200/70">24h Volume</p>
              <p className="text-base sm:text-xl font-semibold text-white truncate">
                {loadingStats ? '...' : `$${formatNumber(stats?.total_volume || 0)}`}
              </p>
        </div>
          </div>
        </div>

        {/* Market Cap Card */}
        <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-earthie-mint/20">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-earthie-mint" />
          </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-cyan-200/70">Market Cap</p>
              <p className="text-base sm:text-xl font-semibold text-white truncate">
                {loadingStats ? '...' : `$${formatNumber(stats?.market_cap || 0)}`}
              </p>
          </div>
          </div>
          </div>

        {/* Holders Card */}
        <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-earthie-mint/20">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-earthie-mint" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-cyan-200/70">Holders</p>
              <p className="text-base sm:text-xl font-semibold text-white truncate">
                {stats?.holders !== undefined && stats?.holders !== null ? formatNumber(stats.holders) : '...'}
              </p>
          </div>
        </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 overflow-hidden backdrop-blur-sm">
        <iframe
          src="https://dexscreener.com/ethereum/0x2afeaf811fe57b72cb496e841113b020a5cf0d60?embed=1&theme=dark&trades=0&info=0"
          style={{
            width: '100%',
            height: '500px',
            border: 'none',
          }}
          className="sm:h-[600px] md:h-[700px] lg:h-[800px]"
        />
      </div>

      {/* Wallet Tracker Section */}
      <div className="rounded-xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 p-4 sm:p-6 backdrop-blur-sm">
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text mb-4">
          Essence Wallet Tracker
        </h2>

        {walletError && (
          <Alert 
            severity="error" 
            className="mb-4 bg-rose-500/10 text-rose-200 border border-rose-500/20 rounded-lg text-sm"
          >
            {walletError}
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
          <div className="relative flex-1">
          <input
            type="text"
            placeholder="Enter wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20 text-white placeholder-gray-400 focus:outline-none focus:border-earthie-mint/50"
            />
          </div>
          <button
            onClick={() => fetchWallet()}
            disabled={loadingWallet}
            className={`px-6 py-2.5 rounded-lg bg-earthie-mint text-earthie-dark font-medium flex items-center justify-center gap-2 transition-colors ${
              loadingWallet ? 'opacity-70 cursor-not-allowed' : 'hover:bg-earthie-mint/90'
            }`}
          >
            {loadingWallet ? (
              <>Loading...</>
            ) : (
              <>
                <Search className="w-4 h-4" />
            Fetch
              </>
            )}
          </button>
        </div>

        {address && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">ETH Balance</p>
                <p className="text-lg font-semibold text-white">{balance} ETH</p>
            </div>
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">ESS Balance</p>
                <p className="text-lg font-semibold text-white">{tokenBalance} ESS</p>
            </div>
            </div>

            {/* Transaction History Graph */}
            {transactions.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Transaction History</h3>
                <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20" style={{ height: '400px' }}>
                  <Bar data={processTransactionsForGraph(transactions)} options={chartOptions} />
                </div>
          </div>
        )}

            {/* Add Transaction Totals Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Total Withdrawn</p>
                <p className="text-lg font-semibold text-white">{transactionTotals.totalWithdrawn.toFixed(2)} ESS</p>
                <p className="text-sm text-cyan-200/70">{formatFiat(transactionTotals.fiatTotalWithdrawn)}</p>
              </div>
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Total Deposited</p>
                <p className="text-lg font-semibold text-white">{transactionTotals.totalDeposited.toFixed(2)} ESS</p>
                <p className="text-sm text-cyan-200/70">{formatFiat(transactionTotals.fiatTotalDeposited)}</p>
              </div>
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Total Sold</p>
                <p className="text-lg font-semibold text-white">{transactionTotals.totalSold.toFixed(2)} ESS</p>
                <p className="text-sm text-cyan-200/70">{formatFiat(transactionTotals.fiatTotalSold)}</p>
              </div>
              <div className="p-4 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20">
                <p className="text-sm text-cyan-200/70 mb-1">Total Bought</p>
                <p className="text-lg font-semibold text-white">{transactionTotals.totalBought.toFixed(2)} ESS</p>
                <p className="text-sm text-cyan-200/70">{formatFiat(transactionTotals.fiatTotalBought)}</p>
              </div>
            </div>

        <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
                <button
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-earthie-dark-light/50 border border-earthie-mint/20 text-sm text-cyan-200/70 hover:bg-earthie-dark-light/70 transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
              
              <div className="rounded-lg border border-earthie-mint/20 overflow-hidden">
                {getPaginatedTransactions().map((tx) => (
              <a
                key={tx.hash}
                href={`https://etherscan.io/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                    className="block p-4 hover:bg-earthie-dark-light/30 transition-colors border-b border-earthie-mint/10 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${getTransactionType(tx).color}`}>
                        {getTransactionType(tx).text}
                      </span>
                      {renderTransactionValue(tx)}
                </div>
                    <div className="text-xs text-gray-400">
                      {new Date(parseInt(tx.timeStamp) * 1000).toLocaleString()}
                    </div>
              </a>
            ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-earthie-mint/10 bg-earthie-dark-light/30">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                        currentPage === 1 
                          ? 'text-gray-500 cursor-not-allowed' 
                          : 'text-cyan-200/70 hover:bg-earthie-dark-light/50'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <span className="text-sm text-cyan-200/70">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                        currentPage === totalPages 
                          ? 'text-gray-500 cursor-not-allowed' 
                          : 'text-cyan-200/70 hover:bg-earthie-dark-light/50'
                      }`}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
          </div>
                )}
        </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EssenceTracker;