'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Bar
} from 'recharts';
import { supabase } from '../../../lib/supabaseClient';

const UNISWAP_SUBGRAPH_URL = 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
const RATE_LIMIT_DELAY = 200;  // 5 calls/sec max
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const ESSENCE_TOKEN_ADDRESS = '0x2c0687215Aca7F5e2792d956E170325e92A02aCA';
const UNISWAP_POOL_ADDRESS = '0x2afeaf811fe57b72cb496e841113b020a5cf0d60'.toLowerCase();

interface PricePoint {
  time: string;
  price: number;
}

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

const COLORS = ['#3bc9db', '#ff6b6b'];

// Custom SVG candlestick chart using recharts primitives
function CandlestickChart({ data }: { data: any[] }) {
  // Custom candle shape
  const renderCandle = (props: any) => {
    if (!props.yAxis || !props.payload) return <g />;
    const { x, width, payload } = props;
    const centerX = x + width / 2;
    const color = payload.close >= payload.open ? '#3bc9db' : '#ff6b6b';
    // Calculate y positions for high, low, open, close
    const yHigh = props.yAxis.scale(payload.high);
    const yLow = props.yAxis.scale(payload.low);
    const yOpen = props.yAxis.scale(payload.open);
    const yClose = props.yAxis.scale(payload.close);
    return (
      <g>
        {/* Wick */}
        <rect x={centerX - 1} y={Math.min(yHigh, yLow)} width={2} height={Math.abs(yLow - yHigh)} fill={color} />
        {/* Body */}
        <rect x={centerX - 7} y={Math.min(yOpen, yClose)} width={14} height={Math.max(2, Math.abs(yOpen - yClose))} rx={3} fill={color} opacity={0.85} />
      </g>
    );
  };

  return (
    <ComposedChart data={data} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="#333" strokeDasharray="3 3" />
      <XAxis dataKey="time" tick={{ fill: '#ccc', fontSize: 10 }} />
      <YAxis tick={{ fill: '#ccc', fontSize: 10 }} width={80} domain={['dataMin', 'dataMax']} />
      <Tooltip content={({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        return (
          <div style={{ background: '#181a28', borderRadius: 10, color: '#3bc9db', padding: 12, border: '1px solid #3bc9db', boxShadow: '0 2px 12px #3bc9db33' }}>
            <div><strong>{d.time}</strong></div>
            <div>Open: <span style={{ color: '#fff' }}>{d.open.toFixed(4)}</span></div>
            <div>High: <span style={{ color: '#fff' }}>{d.high.toFixed(4)}</span></div>
            <div>Low: <span style={{ color: '#fff' }}>{d.low.toFixed(4)}</span></div>
            <div>Close: <span style={{ color: '#fff' }}>{d.close.toFixed(4)}</span></div>
          </div>
        );
      }} />
      <Bar dataKey="close" shape={renderCandle} isAnimationActive={false} />
    </ComposedChart>
  );
}

export default function EssenceTrackerPage() {
  const [chartType, setChartType] = useState<'area' | 'candles'>('area');
  // Candle data type for recharts custom rendering
  interface CandlePoint {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }
  const [candleData, setCandleData] = useState<CandlePoint[]>([]);

  const [timeframe, setTimeframe] = useState<'1H' | '2H' | '3H' | '1D' | '7D' | '30D'>('1D');
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [cookingDots, setCookingDots] = useState(1);

  useEffect(() => {
    if (!isPriceLoading) {
      setCookingDots(1);
      return;
    }
    const interval = setInterval(() => {
      setCookingDots(prev => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, [isPriceLoading]);
  const [stats, setStats] = useState({ current_price: 0, price_change_percentage_24h: 0, total_volume: 0, market_cap: 0, circulating_supply: 0 });
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [transactions, setTransactions] = useState<EtherscanTx[]>([]);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [buySellVolume, setBuySellVolume] = useState<{ name: string; value: number }[]>([]);

  // Fetch volume, market cap, and circulating supply
  const fetchStats = async () => {
  try {
    const statsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ESSENCE_TOKEN_ADDRESS}`
    );
    if (!statsRes.ok) {
      throw new Error(`Dexscreener stats fetch failed: ${statsRes.statusText}`);
    }
    const statsJson = await statsRes.json();
    // Find the main Uniswap v3 pair
    const mainPair = statsJson.pairs.find((p: any) => p.pairAddress.toLowerCase() === '0x2afeaf811fe57b72cb496e841113b020a5cf0d60');
    if (!mainPair) throw new Error('Main Uniswap v3 pair not found in Dexscreener response');
    setStats(prev => ({
      ...prev,
      total_volume: mainPair.volume?.h24 ?? 0,
      market_cap: mainPair.marketCap ?? 0,
      circulating_supply: 0, // Dexscreener does not provide this
    }));
  } catch (err) {
    console.error('Error fetching stats from Dexscreener:', err);
  }
};

  // Generate candle data from priceData when priceData changes
  useEffect(() => {
    if (priceData.length < 4) {
      setCandleData([]);
      return;
    }
    // Simulate OHLC candles from priceData (group every 4 points for demo)
    const candles: CandlePoint[] = [];
    for (let i = 0; i < priceData.length; i += 4) {
      const group = priceData.slice(i, i + 4);
      if (group.length < 1) continue;
      const open = group[0].price;
      const close = group[group.length - 1].price;
      const high = Math.max(...group.map(p => p.price));
      const low = Math.min(...group.map(p => p.price));
      candles.push({
        time: group[0].time,
        open,
        high,
        low,
        close,
      });
    }
    setCandleData(candles);
  }, [priceData]);

  useEffect(() => { fetchPrice(); }, [timeframe]);
  useEffect(() => { if (address) fetchWallet(); }, [address]);
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchPrice = async () => {
    setIsPriceLoading(true);
    try {
      // For 7D/30D use Supabase, for all others use Moralis
      let pointsCount = 30;
      let intervalMs = 24 * 60 * 60 * 1000;
      if (timeframe === '1D') { pointsCount = 24; intervalMs = 60 * 60 * 1000; }
      else if (timeframe === '7D') { pointsCount = 7; intervalMs = 24 * 60 * 60 * 1000; }
      else if (timeframe === '30D') { pointsCount = 30; intervalMs = 24 * 60 * 60 * 1000; }
      else if (timeframe === '1H') { pointsCount = 12; intervalMs = 5 * 60 * 1000; }
      else if (timeframe === '2H') { pointsCount = 24; intervalMs = 5 * 60 * 1000; }
      else if (timeframe === '3H') { pointsCount = 36; intervalMs = 5 * 60 * 1000; }
      if (timeframe === '7D' || timeframe === '30D') {
        const { data: rows, error } = await supabase
          .from('essence_daily_prices')
          .select('date, price')
          .order('date', { ascending: true })
          .limit(pointsCount);
        if (error) {
          console.error('Supabase error fetching daily prices:', error);
          throw new Error(error.message);
        }
        const pricePoints = rows.map(r => ({ time: r.date, price: r.price }));
        setPriceData(pricePoints);
        const currentPrice = pricePoints[pricePoints.length - 1].price;
        const firstPrice = pricePoints[0]?.price ?? currentPrice;
        const changePct = firstPrice === 0 ? 0 : ((currentPrice - firstPrice) / firstPrice) * 100;
        setStats(prev => ({
          ...prev,
          current_price: currentPrice,
          price_change_percentage_24h: parseFloat(changePct.toFixed(2)),
        }));
        return;
      }

      const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
      if (!moralisKey) {
        throw new Error('NEXT_PUBLIC_MORALIS_API_KEY environment variable is not set');
      }
      const now = new Date();
      const pricePoints: PricePoint[] = [];

      for (let i = pointsCount - 1; i >= 0; i--) {
        const dt = new Date(now.getTime() - i * intervalMs);
        const iso = dt.toISOString();
        // Get block number at the timestamp
        const blockRes = await fetch(
          `https://deep-index.moralis.io/api/v2/dateToBlock?chain=eth&date=${iso}`,
          { headers: { 'X-API-Key': moralisKey } }
        );
        const blockJson = await blockRes.json();
        const blockNumber = blockJson.block;
        await sleep(RATE_LIMIT_DELAY);
        // Get token price at block
        const priceRes = await fetch(
          `https://deep-index.moralis.io/api/v2/erc20/${ESSENCE_TOKEN_ADDRESS}/price?chain=eth&to_block=${blockNumber}`,
          { headers: { 'X-API-Key': moralisKey } }
        );
        const priceJson = await priceRes.json();
        const usdPrice = priceJson.usdPrice as number;
        const formattedPrice = parseFloat(usdPrice.toFixed(6));
        pricePoints.push({
          time:
            ['1H','2H','3H','1D'].includes(timeframe)
              ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
              : dt.toLocaleDateString(),
          price: formattedPrice,
        });
        await sleep(RATE_LIMIT_DELAY);
      }

      setPriceData(pricePoints);
      setIsPriceLoading(false);
      const currentPrice = pricePoints[pricePoints.length - 1]?.price || 0;
      const firstPrice = pricePoints[0]?.price || currentPrice;
      const changePct = firstPrice === 0 ? 0 : ((currentPrice - firstPrice) / firstPrice) * 100;
      setStats((prev) => ({
        ...prev,
        current_price: currentPrice,
        price_change_percentage_24h: parseFloat(changePct.toFixed(2)),
      }));
    } catch (err) {
      console.error('Error fetching price data with Moralis:', err);
      setPriceData([]);
      setIsPriceLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const balRes = await fetch(
        `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
      );
      const balJson = await balRes.json();
      setBalance((parseInt(balJson.result, 10) / 1e18).toFixed(4));
      await sleep(RATE_LIMIT_DELAY);

      const txRes = await fetch(
        `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${ESSENCE_TOKEN_ADDRESS}&address=${address}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`
      );
      const txJson = await txRes.json();
      if (Array.isArray(txJson.result)) {
        const txs = txJson.result.slice(0, 50);
        setTransactions(txs);
        // compute buy vs sell volume (token amounts)
        const addrLower = address.toLowerCase();
        let buy = 0, sell = 0;
        txs.forEach((t: any) => {
          const amt = parseFloat((parseInt(t.value, 10) / 1e18).toFixed(4));
          if (t.to.toLowerCase() === addrLower) buy += amt; else if (t.from.toLowerCase() === addrLower) sell += amt;
        });
        setBuySellVolume([
          { name: 'Buys', value: buy },
          { name: 'Sells', value: sell },
        ]);
      } else {
        console.error('Etherscan txlist result not array:', txJson.result);
        setTransactions([]);
        setBuySellVolume([]);
      }
      await sleep(RATE_LIMIT_DELAY);
      const tokenRes = await fetch(
        `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${ESSENCE_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
      );
      const tokenJson = await tokenRes.json();
      const raw = tokenJson.result;
      setTokenBalance((parseInt(raw || '0', 10) / 1e18).toFixed(4));
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    }
  };

  return (
    <div className="p-6 space-y-8 rounded-2xl bg-[#0b0e13]/80 backdrop-blur-lg border border-[#1d1f24] text-white">
      {/* Essence Price Chart */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Essence Price Chart</h2>
        <div className="flex space-x-2 mb-4">
          {['1D', '7D', '30D'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as any)}
              className={`px-3 py-1 rounded ${timeframe === tf ? 'bg-earthie-mint text-black' : 'bg-gray-700/50'}`}
            >
              {tf}
            </button>
          ))}
        </div>
        {/* Chart type toggle */}
        <div className="flex gap-2 mb-4">
          {/* Timeline buttons */}
          {['1H', '2H', '3H', '1D', '7D', '30D'].map(tf => (
            <button
              key={tf}
              className={`px-3 py-1 rounded transition-all ${timeframe === tf ? 'bg-earthie-mint text-black shadow-lg' : 'bg-gray-800/70 text-gray-300'}`}
              onClick={() => setTimeframe(tf as any)}
            >
              {tf}
            </button>
          ))}
          {/* Chart type toggle */}
          <button
            className={`px-3 py-1 rounded transition-all ${chartType === 'area' ? 'bg-earthie-mint text-black shadow-lg' : 'bg-gray-800/70 text-gray-300'}`}
            onClick={() => setChartType('area')}
          >
            Area
          </button>
          <button
            className={`px-3 py-1 rounded transition-all ${chartType === 'candles' ? 'bg-purple-500 text-white shadow-lg' : 'bg-gray-800/70 text-gray-300'}`}
            onClick={() => setChartType('candles')}
          >
            Candles
          </button>
        </div> 
        <div style={{ width: '100%', minHeight: 400, height: '60vh', maxHeight: 700, position: 'relative', borderRadius: '1.5rem', boxShadow: isPriceLoading ? '0 0 24px 8px #3bc9db88' : '0 1px 12px #000a', border: '2px solid #3bc9db', background: 'linear-gradient(135deg, rgba(59,201,219,0.08) 0%, rgba(90,24,154,0.08) 100%)', overflow: 'hidden', transition: 'box-shadow 0.3s' }}> 
          {isPriceLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15,17,24,0.85)',
              zIndex: 10,
            }}>
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-earthie-mint mb-4"></div>
              <div className="text-lg font-bold text-earthie-mint">Cooking{'.'.repeat(cookingDots)}</div>
            </div>
          )}
          <ResponsiveContainer>
            {(!isPriceLoading && priceData.length === 0) ? (
              <div className="flex items-center justify-center h-full text-lg text-gray-400">No data available for this timeframe.</div>
            ) : chartType === 'area' ? (
              <AreaChart data={priceData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3bc9db" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3bc9db" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: '#ccc', fontSize: 10 }} />
                <YAxis tick={{ fill: '#ccc', fontSize: 10 }} domain={['dataMin - (dataMax-dataMin)*0.1', 'dataMax + (dataMax-dataMin)*0.1']} width={80} />
                <Tooltip contentStyle={{ backgroundColor: '#1d1f24', border: 'none' }} />
                <Area type="monotone" dataKey="price" stroke="#3bc9db" fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            ) : (
              <CandlestickChart data={candleData} />
            )}
          </ResponsiveContainer> 
        </div>
      </section>

      {/* Mini Stat Panels */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-[#1f1f2a]/70 rounded-lg backdrop-blur-md">
            <div className="text-sm text-gray-400">Essence Price</div>
            <div className="text-xl font-semibold">${stats.current_price.toFixed(4)}</div>
          </div>
          <div className="p-4 bg-[#1f1f2a]/70 rounded-lg backdrop-blur-md">
            <div className="text-sm text-gray-400">24H Change</div>
            <div className={`text-xl font-semibold ${stats.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.price_change_percentage_24h.toFixed(2)}%</div>
          </div>
          <div className="p-4 bg-[#1f1f2a]/70 rounded-lg backdrop-blur-md">
            <div className="text-sm text-gray-400">Volume (24H)</div>
            <div className="text-xl font-semibold">${(stats.total_volume / 1e6).toFixed(2)}M</div>
          </div>
          <div className="p-4 bg-[#1f1f2a]/70 rounded-lg backdrop-blur-md">
            <div className="text-sm text-gray-400">Market Cap</div>
            <div className="text-xl font-semibold">${(stats.market_cap / 1e6).toFixed(2)}M</div>
          </div>
          <div className="p-4 bg-[#1f1f2a]/70 rounded-lg backdrop-blur-md">
            <div className="text-sm text-gray-400">Circulating</div>
            <div className="text-xl font-semibold">{(stats.circulating_supply / 1e6).toFixed(2)}M</div>
          </div>
        </div>
      </section>

      {/* Essence Wallet Tracker */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Essence Wallet Tracker</h2>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            placeholder="Enter wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="flex-1 p-2 rounded bg-[#1f1f2a]/70 backdrop-blur-md"
          />
          <button onClick={fetchWallet} className="px-4 bg-earthie-mint text-black rounded">
            Fetch
          </button>
        </div>
        {address && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-[#252532]/70 rounded-lg backdrop-blur-md">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-lg font-semibold">{balance} E2-E</div>
            </div>
            <div className="p-4 bg-[#252532]/70 rounded-lg backdrop-blur-md">
              <div className="text-sm text-gray-400">Essence Balance</div>
              <div className="text-lg font-semibold">{tokenBalance} E2-E</div>
            </div>
            {/* placeholders for unclaimed essence, energy, tiles */}
          </div>
        )}
        <div>
          <h3 className="text-xl font-semibold mb-2">Recent Transactions</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.map((tx) => (
              <a
                key={tx.hash}
                href={`https://etherscan.io/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 bg-[#252532]/70 rounded hover:bg-[#2c2c3a]/80"
              >
                <div className="text-sm">
                  {tx.from.toLowerCase() === address.toLowerCase() ? 'Sent' : 'Received'} {(parseInt(tx.value, 10) / 1e18).toFixed(4)} ESS
                </div>
                <div className="text-xs text-gray-500">{new Date(parseInt(tx.timeStamp, 10) * 1000).toLocaleString()}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Buy vs Sell Volume */}
      {buySellVolume.length === 2 && (
        <section>
          <h2 className="text-2xl font-bold mb-2">Buy vs Sell (Last 50 Tx)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={buySellVolume} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} label>
                {buySellVolume.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}