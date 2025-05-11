'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Bar,
  Rectangle,
  Line,
  Legend,
  ReferenceDot,
  ReferenceArea,
  Scatter,
  PieChart,
  Pie,
  Cell,
  BarChart
} from 'recharts';
import { supabase } from '../../../lib/supabaseClient';

const UNISWAP_SUBGRAPH_URL = 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
const RATE_LIMIT_DELAY = 200;  // 5 calls/sec max
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const ESSENCE_TOKEN_ADDRESS = '0x2c0687215Aca7F5e2792d956E170325e92A02aCA';
const UNISWAP_POOL_ADDRESS = '0x2afeaf811fe57b72cb496e841113b020a5cf0d60'.toLowerCase();

// Helper function to format source dates robustly
const formatSourceDateToYYYYMMDD = (sourceDate: string | number | Date): string => {
  const dateObj = new Date(sourceDate);
  if (isNaN(dateObj.getTime())) {
    // console.warn('formatSourceDateToYYYYMMDD: Invalid source date encountered:', sourceDate);
    return "BAD_DATE_INPUT"; // Specific placeholder for bad source dates
  }
  // Use en-CA locale for YYYY-MM-DD format preference
  return dateObj.toLocaleDateString('en-CA');
};

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

// Simple candlestick chart component
function CandlestickChart({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-lg text-gray-400">
        No data available for candlestick chart.
      </div>
    );
  }

  // Calculate yDomain to correctly scale candles
  let yMin = Infinity;
  let yMax = -Infinity;
  data.forEach(item => {
    yMin = Math.min(yMin, item.low);
    yMax = Math.max(yMax, item.high);
  });

  // Add some padding to yDomain for better visualization
  const padding = (yMax - yMin) * 0.05; // 5% padding
  yMin = yMin - padding;
  yMax = yMax + padding;
  
  const yDomainRange = yMax - yMin;
  if (yDomainRange === 0) { // Avoid division by zero
    yMin = yMin * 0.99;
    yMax = yMax * 1.01;
  }

  // Calculate candle width based on data length
  const candleWidth = Math.min(Math.max(6, 70 / data.length), 16);
  
  let chartData = data;

  // Prepare additional technical indicators
  (() => {
    // Compute SMA(7) and Bollinger(20)
    const closes = data.map((d: any) => d.close);
    const sma7Arr: (number|null)[] = [];
    const bbUpper: (number|null)[] = [];
    const bbLower: (number|null)[] = [];
    const bbMid: (number|null)[] = [];
    const smaPeriod = 7;
    const bbPeriod = 20;
    closes.forEach((close, idx) => {
      // SMA
      if (idx >= smaPeriod - 1) {
        const slice = closes.slice(idx - smaPeriod + 1, idx + 1);
        sma7Arr.push(slice.reduce((a, b) => a + b, 0) / smaPeriod);
      } else sma7Arr.push(null);

      // Bollinger
      if (idx >= bbPeriod - 1) {
        const slice = closes.slice(idx - bbPeriod + 1, idx + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / bbPeriod;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / bbPeriod;
        const std = Math.sqrt(variance);
        bbMid.push(mean);
        bbUpper.push(mean + 2 * std);
        bbLower.push(mean - 2 * std);
      } else {
        bbMid.push(null);
        bbUpper.push(null);
        bbLower.push(null);
      }
    });

    // Attach indicators & synthetic volume
    chartData = data.map((d: any, i: number) => ({
      ...d,
      sma7: sma7Arr[i],
      bb_upper: bbUpper[i],
      bb_lower: bbLower[i],
      volume: Math.abs(d.high - d.low)
    }));
  })();

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden" style={{ background: 'linear-gradient(180deg, #13162a 0%, #090c18 100%)' }}> 
      <ResponsiveContainer width="100%" height="78%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis 
            dataKey="time" 
            tick={{ fill: 'rgba(255,255,255,0.6)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(time) => {
              const date = new Date(time);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
          />
          <YAxis 
            domain={[yMin, yMax]}
            orientation="right"
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tick={{ fill: 'rgba(255,255,255,0.6)' }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(5) : ''}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const isUp = data.close > data.open;
                const priceChangePercent = ((data.close - data.open) / data.open * 100).toFixed(2);
                
                return (
                  <div style={{ 
                    background: 'rgba(23, 27, 46, 0.95)', 
                    padding: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    color: '#fff',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    minWidth: '180px'
                  }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px', fontWeight: 'bold' }}>
                      {new Date(data.time).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Open</span>
                      <span style={{ fontFamily: 'monospace' }}>{data.open.toFixed(5)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>High</span>
                      <span style={{ fontFamily: 'monospace' }}>{data.high.toFixed(5)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Low</span>
                      <span style={{ fontFamily: 'monospace' }}>{data.low.toFixed(5)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Close</span>
                      <span style={{ fontFamily: 'monospace', color: isUp ? '#0ecb81' : '#f6465d' }}>{data.close.toFixed(5)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                      <span>Change</span>
                      <span style={{ fontFamily: 'monospace', color: isUp ? '#0ecb81' : '#f6465d' }}>{isUp ? '+' : ''}{priceChangePercent}%</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Indicators */}
          <Line type="monotone" dataKey="sma7" stroke="#ffaa00" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="bb_upper" stroke="#aaaafc" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="bb_lower" stroke="#aaaafc" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          {/* Hidden areas for scaling */}
          <Area type="monotone" dataKey="high" stroke="transparent" fill="transparent" />
          <Area type="monotone" dataKey="low" stroke="transparent" fill="transparent" />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Connecting line between candle closes */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {data.slice(1).map((curr: any, idx: number) => {
          const prev = data[idx];
          const isUpSeg = curr.close > prev.close;
          const segColor = isUpSeg ? '#0ecb81' : '#f6465d';
          const x1 = ((idx + 0.5) / data.length) * 100;
          const x2 = ((idx + 1.5) / data.length) * 100;
          const y1 = ((yMax - prev.close) / yDomainRange) * 100;
          const y2 = ((yMax - curr.close) / yDomainRange) * 100;
          return (
            <line
              key={`price-line-${idx}`}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke={segColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.9"
            />
          );
        })}
      </svg>
      
      {/* Draw candles using absolute positioning and CSS */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {data.map((item: any, index: number) => {
          const isUp = item.close > item.open;
          // Professional trading chart colors - Binance style
          const color = isUp ? '#0ecb81' : '#f6465d';
          
          // Calculate x position based on data index to evenly space candles across width
          const xPositionPercent = ((index + 0.5) / data.length) * 100;

          // Calculate y position based purely on price domain (top=0%, bottom=100%)
          const yPercent = (value: number) => ((yMax - value) / yDomainRange) * 100;

          const bodyTop = yPercent(Math.max(item.open, item.close));
          const bodyBottom = yPercent(Math.min(item.open, item.close));
          const bodyHeight = Math.abs(bodyBottom - bodyTop);

          const wickTop = yPercent(item.high);
          const wickBottom = yPercent(item.low);
          
          return (
            <div 
              key={`candle-container-${index}`} 
              className="absolute" 
              style={{ 
                left: `${xPositionPercent}%`, 
                top: '0', 
                height: '100%', 
                width: `${candleWidth}px`,
                transform: 'translateX(-50%)'
              }}
            >
              {/* Wick (rendered as a single line) */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: `${wickTop}%`,
                  width: '1px',
                  height: `${wickBottom - wickTop}%`,
                  backgroundColor: color,
                  transform: 'translateX(-50%)',
                  opacity: 0.8
                }}
              />
              {/* Candle Body */}
              <div 
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: `${bodyTop}%`,
                  width: `${candleWidth}px`,
                  height: `${Math.max(1, bodyHeight)}%`, // Minimum height of 1%
                  backgroundColor: color,
                  transform: 'translateX(-50%)',
                  boxShadow: isUp ? '0 0 4px rgba(14, 203, 129, 0.3)' : '0 0 4px rgba(246, 70, 93, 0.3)',
                  borderRadius: '1px'
                }}
              />
            </div>
          );
        })}
      </div>
      
      {/* Volume bars */}
      <div className="w-full" style={{ height: '22%', marginTop: '6px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 2, left: 20, right: 30, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Bar dataKey="volume" fill="rgba(255,255,255,0.2)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
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

  // Prepare area chart data with indicators
  const areaData = useMemo(() => {
    if (priceData.length === 0) return [];
    const closes = priceData.map(p => p.price);
    const sma7Arr: (number|null)[] = [];
    const sma20Arr: (number|null)[] = [];
    const bbUpper: (number|null)[] = [];
    const bbLower: (number|null)[] = [];
    const sma7Period = 7;
    const sma20Period = 20;
    const bbPeriod = 20;
    closes.forEach((close, idx) => {
      if (idx >= sma7Period - 1) {
        const slice = closes.slice(idx - sma7Period + 1, idx + 1);
        sma7Arr.push(slice.reduce((a, b) => a + b, 0) / sma7Period);
      } else sma7Arr.push(null);

      if (idx >= sma20Period - 1) {
        const slice = closes.slice(idx - sma20Period + 1, idx + 1);
        sma20Arr.push(slice.reduce((a, b) => a + b, 0) / sma20Period);
      } else sma20Arr.push(null);

      if (idx >= bbPeriod - 1) {
        const slice = closes.slice(idx - bbPeriod + 1, idx + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / bbPeriod;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / bbPeriod;
        const std = Math.sqrt(variance);
        bbUpper.push(mean + 2 * std);
        bbLower.push(mean - 2 * std);
      } else {
        bbUpper.push(null);
        bbLower.push(null);
      }
    });

    return priceData.map((d, i) => ({
      ...d,
      sma7: sma7Arr[i],
      sma20: sma20Arr[i],
      bb_upper: bbUpper[i],
      bb_lower: bbLower[i],
      volume: i === 0 ? 0 : Math.abs(priceData[i].price - priceData[i - 1].price)
    }));
  }, [priceData]);

  // Fetch volume, market cap, and circulating supply
  const fetchStats = async () => {
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
    const mainPair = statsJson.pairs.find((p: any) => p.pairAddress.toLowerCase() === '0x2afeaf811fe57b72cb496e841113b020a5cf0d60');
    if (!mainPair) throw new Error('Main Uniswap v3 pair not found in Dexscreener response');

      // Set volume and market cap from Dexscreener
    setStats(prev => ({
      ...prev,
      total_volume: mainPair.volume?.h24 ?? 0,
      market_cap: mainPair.marketCap ?? 0,
      }));

      // Fetch Earth2 metrics via internal API route (same as profile page)
      const metricsRes = await fetch('/api/e2/metrics');
      if (!metricsRes.ok) {
        throw new Error(`E2 metrics fetch failed: ${metricsRes.statusText}`);
      }
      const metricsJson = await metricsRes.json();
      const metrics = metricsJson?.data?.attributes;
      
      if (metrics && metrics.essMinted && metrics.essBurnt) {
        const circulatingSupply = Number(metrics.essMinted) - Number(metrics.essBurnt);
        
        // Update only the circulating supply
        setStats(prev => ({
          ...prev,
          circulating_supply: circulatingSupply,
        }));
      }
  } catch (err) {
      console.error('Error fetching stats:', err);
  }
};

  // Generate candle data from priceData when priceData changes
  useEffect(() => {
    console.log('priceData for candles:', priceData);
    if (!priceData.length) {
      setCandleData([]);
      return;
    }

    // Create proper candles from price data
    if (chartType === 'candles') {
      // Create candles based on real price data
      const candles: CandlePoint[] = [];
      const sortedPriceData = [...priceData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      // Group data by day or hour based on timeframe
      const groupedData: Record<string, PricePoint[]> = {};
      
      sortedPriceData.forEach(point => {
        const date = new Date(point.time);
        let key: string;
        
        if (timeframe === '1H' || timeframe === '2H' || timeframe === '3H') {
          // Group by hour for short timeframes
          key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}-${date.getHours()}`;
        } else {
          // Group by day for longer timeframes
          key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        }
        
        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        
        groupedData[key].push(point);
      });
      
      // Create OHLC data for each group
      Object.keys(groupedData).forEach(key => {
        const group = groupedData[key];
        if (group.length === 0) return;
        
        // Sort group by time
        group.sort((a: PricePoint, b: PricePoint) => new Date(a.time).getTime() - new Date(b.time).getTime());
        
        // For proper candlestick chart, we need first price as open and last as close
        const open = group[0].price;
        const close = group[group.length - 1].price;
        const high = Math.max(...group.map((p: PricePoint) => p.price));
        const low = Math.min(...group.map((p: PricePoint) => p.price));
        
        // Make sure high and low are at least a bit different from open/close
        // This ensures candles are visible even when price doesn't change much
        const adjustedHigh = Math.max(high, open * 1.005, close * 1.005);
        const adjustedLow = Math.min(low, open * 0.995, close * 0.995);
        
        // Create more variation between open and close for visibility
        // Ensure at least 0.5% difference between open and close
        let adjustedOpen = open;
        let adjustedClose = close;
        if (Math.abs(open - close) < open * 0.005) {
          if (close > open) {
            adjustedClose = open * 1.005;
          } else {
            adjustedClose = open * 0.995;
          }
        }
        
        candles.push({
          time: group[0].time,
          open: adjustedOpen,
          high: adjustedHigh,
          low: adjustedLow,
          close: adjustedClose
        });
      });
      
      // Sort candles by time
      candles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      console.log('Created candles from price data:', candles);
      setCandleData(candles);
      return;
    }

    // Group data points into intervals based on timeframe
    const candles: CandlePoint[] = [];
    let currentGroup: PricePoint[] = [];
    let currentInterval = '';

    // Sort price data by time
    const sortedPriceData = [...priceData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    console.log('Sorted price data:', sortedPriceData);

    // Determine interval format based on timeframe
    const getInterval = (time: string) => {
      const date = new Date(time);
      if (timeframe === '1H' || timeframe === '2H' || timeframe === '3H') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    };

    sortedPriceData.forEach((point) => {
      const interval = getInterval(point.time);

      if (!currentInterval) {
        currentInterval = interval;
        currentGroup = [point];
      } else if (interval === currentInterval) {
        currentGroup.push(point);
      } else {
        // Process the current group
        if (currentGroup.length > 0) {
          const open = currentGroup[0].price;
          const close = currentGroup[currentGroup.length - 1].price;
          const high = Math.max(...currentGroup.map(p => p.price));
          const low = Math.min(...currentGroup.map(p => p.price));
          candles.push({
            time: currentGroup[0].time,
            open,
            high,
            low,
            close,
          });
        }
        // Start new group
        currentInterval = interval;
        currentGroup = [point];
      }
    });

    // Process the last group
    if (currentGroup.length > 0) {
      const open = currentGroup[0].price;
      const close = currentGroup[currentGroup.length - 1].price;
      const high = Math.max(...currentGroup.map(p => p.price));
      const low = Math.min(...currentGroup.map(p => p.price));
      candles.push({
        time: currentGroup[0].time,
        open,
        high,
        low,
        close,
      });
    }

    console.log('Generated candles:', candles);
    setCandleData(candles);
  }, [priceData, timeframe, chartType]);

  useEffect(() => { fetchPrice(); }, [timeframe]);
  useEffect(() => { if (address) fetchWallet(); }, [address]);
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchPrice = async () => {
    setIsPriceLoading(true);
    let sortedPricePoints: PricePoint[] = [];
    let pointsCount = 30;
    let intervalMs = 24 * 60 * 60 * 1000;
    let hours = 1;
    if (timeframe === '1D') { pointsCount = 24; intervalMs = 60 * 60 * 1000; hours = 24; }
    else if (timeframe === '7D') { pointsCount = 7; intervalMs = 24 * 60 * 60 * 1000; hours = 168; }
    else if (timeframe === '30D') { pointsCount = 30; intervalMs = 24 * 60 * 60 * 1000; hours = 720; }
    else if (timeframe === '1H') { pointsCount = 12; intervalMs = 5 * 60 * 1000; hours = 1; }
    else if (timeframe === '2H') { pointsCount = 24; intervalMs = 5 * 60 * 1000; hours = 2; }
    else if (timeframe === '3H') { pointsCount = 36; intervalMs = 5 * 60 * 1000; hours = 3; }

    try {
      // 1. Try /api/cache-essence-price
      try {
        const res = await fetch(`/api/cache-essence-price?hours=${hours}`);
        if (res.ok) {
          const json = await res.json();
          if (json.prices && Array.isArray(json.prices) && json.prices.length > 0) {
            sortedPricePoints = (json.prices as {timestamp: string, price: number}[])
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map((p) => ({
                time: formatSourceDateToYYYYMMDD(p.timestamp),
                price: p.price,
              }));
          }
        }
      } catch (err) { /* ignore, try next fallback */ }

      // 2. Try supabase for 7D/30D if still no data
      if ((timeframe === '7D' || timeframe === '30D') && sortedPricePoints.length === 0) {
        try {
          const { data: rows, error } = await supabase
            .from('essence_daily_prices')
            .select('date, price')
            .order('date', { ascending: true })
            .limit(pointsCount);
          if (!error && rows && rows.length > 0) {
            sortedPricePoints = rows.map((r: {date: string, price: number}) => ({ time: formatSourceDateToYYYYMMDD(r.date), price: r.price }));
          }
        } catch (err) { /* ignore, try next fallback */ }
      }

      // 3. Try Moralis if still no data
      if (sortedPricePoints.length === 0) {
        try {
          const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
          if (!moralisKey) throw new Error('NEXT_PUBLIC_MORALIS_API_KEY not set');
          const now = new Date();
          const pricePoints: PricePoint[] = [];
          let moralisUnauthorized = false;
          for (let i = pointsCount - 1; i >= 0; i--) {
            const dt = new Date(now.getTime() - i * intervalMs);
            const iso = dt.toISOString();
            // Get block number at the timestamp
            const blockRes = await fetch(
              `https://deep-index.moralis.io/api/v2/dateToBlock?chain=eth&date=${iso}`,
              { headers: { 'X-API-Key': moralisKey } }
            );
            if (blockRes.status === 401) {
              moralisUnauthorized = true;
              break;
            }
            const blockJson = await blockRes.json();
            const blockNumber = blockJson.block;
            await sleep(RATE_LIMIT_DELAY);
            // Get price at block
            const priceRes = await fetch(
              `https://deep-index.moralis.io/api/v2/erc20/${ESSENCE_TOKEN_ADDRESS}/price?chain=eth&to_block=${blockNumber}`,
              { headers: { 'X-API-Key': moralisKey } }
            );
            if (priceRes.status === 401) {
              moralisUnauthorized = true;
              break;
            }
            const priceJson = await priceRes.json();
            if (priceJson.usdPrice) {
              pricePoints.push({
                time: formatSourceDateToYYYYMMDD(dt),
                price: priceJson.usdPrice
              });
            }
            await sleep(RATE_LIMIT_DELAY);
          }
          if (!moralisUnauthorized && pricePoints.length > 0) {
            sortedPricePoints = pricePoints;
          } else if (moralisUnauthorized || pricePoints.length === 0) {
            // Fallback to GoldRush if Moralis fails or is unauthorized
            try {
              const goldrushKey = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY;
              const essenceAddress = ESSENCE_TOKEN_ADDRESS;
              let goldrushUrl = '';
              let parseGoldrush: (data: any) => PricePoint[] = () => [];
              if (['1H','2H','3H','1D','7D','30D'].includes(timeframe)) {
                // Use internal API route to proxy GoldRush
                goldrushUrl = `/api/goldrush-prices?address=${essenceAddress}&pointsCount=${pointsCount}`;
                parseGoldrush = (data) => {
                  if (!data || !Array.isArray(data.prices)) return [];
                  // For candlestick chart, we need OHLC data
                  // Since we only have closing prices, we'll create synthetic OHLC data
                  // by using small variations around the actual price
                  const pricePoints = data.prices.map((item: any) => {
                    const basePrice = item.price;
                    const variation = basePrice * 0.02; // 2% variation
                    return {
                      time: formatSourceDateToYYYYMMDD(item.time),
                      price: basePrice,
                      open: basePrice - (variation/2),
                      high: basePrice + variation,
                      low: basePrice - variation,
                      close: basePrice
                    };
                  });
                  return pricePoints;
                };
              }
              if (goldrushUrl) {
                const goldrushRes = await fetch(goldrushUrl);
                if (goldrushRes.ok) {
                  const goldrushJson = await goldrushRes.json();
                  sortedPricePoints = parseGoldrush(goldrushJson);
                }
              }
            } catch (goldrushErr) { /* if all fail, sortedPricePoints stays empty */ }
          }
        } catch (moralisErr) {
          // 4. Fallback to GoldRush if Moralis fails
          try {
            const goldrushKey = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY;
            const essenceAddress = ESSENCE_TOKEN_ADDRESS;
            let goldrushUrl = '';
            let parseGoldrush: (data: any) => PricePoint[] = () => [];
            if (['1H','2H','3H','1D','7D','30D'].includes(timeframe)) {
              goldrushUrl = `https://api.goldrush.dev/v1/pricing/historical_by_address_v2/1/${essenceAddress}/`;
              parseGoldrush = (data) => {
                if (!data || !data.data || !Array.isArray(data.data.prices)) return [];
                const pricePoints = data.data.prices.slice(-pointsCount).map((item: any) => {
                  const basePrice = item.close;
                  const variation = basePrice * 0.02; // 2% variation
                  return {
                    time: formatSourceDateToYYYYMMDD(item.date),
                    price: basePrice,
                    open: basePrice - (variation/2),
                    high: basePrice + variation,
                    low: basePrice - variation,
                    close: basePrice
                  };
                });
                return pricePoints;
              };
            }
            if (goldrushUrl && goldrushKey) {
              const goldrushRes = await fetch(goldrushUrl, { headers: { 'x-api-key': goldrushKey } });
              if (goldrushRes.ok) {
                const goldrushJson = await goldrushRes.json();
                sortedPricePoints = parseGoldrush(goldrushJson);
              }
            }
          } catch (goldrushErr) { /* if all fail, sortedPricePoints stays empty */ }
        }
      }

      setPriceData(sortedPricePoints);
      const statCurrentPrice = sortedPricePoints[sortedPricePoints.length - 1]?.price || 0;
      const statFirstPrice = sortedPricePoints[0]?.price || statCurrentPrice;
      const statChangePct = statFirstPrice === 0 ? 0 : ((statCurrentPrice - statFirstPrice) / statFirstPrice) * 100;
      setStats(prev => ({
        ...prev,
        current_price: statCurrentPrice,
        price_change_percentage_24h: parseFloat(statChangePct.toFixed(2)),
      }));
      setIsPriceLoading(false);
    } catch (err) {
      setIsPriceLoading(false);
      setPriceData([]);
      setStats(prev => ({ ...prev, current_price: 0, price_change_percentage_24h: 0 }));
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

        {/* Sub timeframes */}
        <div className="flex gap-2 mb-2">
          {['1H', '2H', '3H', '1D', '7D', '30D'].map(tf => (
            <button
              key={tf}
              className={`px-3 py-1 rounded ${timeframe === tf ? 'bg-earthie-mint text-black' : 'bg-gray-800/70 text-gray-300'}`}
              onClick={() => setTimeframe(tf as any)}
            >
              {tf}
            </button>
          ))}
        </div>
        {/* Chart type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1 rounded ${chartType === 'area' ? 'bg-earthie-mint text-black' : 'bg-gray-800/70 text-gray-300'}`}
            onClick={() => setChartType('area')}
          >
            Area
          </button>
          <button
            className={`px-3 py-1 rounded ${chartType === 'candles' ? 'bg-earthie-mint text-black' : 'bg-gray-800/70 text-gray-300'}`}
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
              <>
                {/* Price Area */}
                <div className="w-full" style={{ height: '78%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3bc9db" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3bc9db" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fill: '#ccc', fontSize: 10 }} 
                        interval="preserveStartEnd"
                        tickFormatter={(timeStr) => {
                          if (typeof timeStr === 'string' && timeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const parts = timeStr.split('-');
                            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                            if (!isNaN(date.getTime())) {
                              return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                            }
                          }
                          return '';
                        }}
                      />
                      <YAxis tick={{ fill: '#ccc', fontSize: 10 }} width={80} domain={['dataMin', 'dataMax']} />
                      <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const dataPoint = payload[0].payload;
                            const displayDate = dataPoint.time;
                            return (
                              <div style={{ background: '#181a28', borderRadius: 10, color: '#3bc9db', padding: '10px', border: '1px solid #3bc9db33', boxShadow: '0 2px 12px #3bc9db33' }}>
                                <p style={{ margin: '0 0 5px 0' }}>{`Date: ${displayDate}`}</p>
                                <p style={{ margin: 0 }}>{`Price: ${dataPoint.price.toFixed(4)}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                      {/* Indicator Lines */}
                      <Line type="monotone" dataKey="sma7" stroke="#ffaa00" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="sma20" stroke="#ff7f50" strokeWidth={1} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="bb_upper" stroke="#aaaafc" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="bb_lower" stroke="#aaaafc" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="price" stroke="#3bc9db" fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Volume Bars */}
                <div className="w-full" style={{ height: '22%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaData} margin={{ top: 0, left: 0, right: 20, bottom: 0 }}>
                      <XAxis dataKey="time" hide />
                      <YAxis hide />
                      <Bar dataKey="volume" fill="rgba(59,201,219,0.2)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
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
            <div className="text-xl font-semibold">
              {stats.circulating_supply > 0 
                ? `${(stats.circulating_supply / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
                : '---'}
            </div>
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