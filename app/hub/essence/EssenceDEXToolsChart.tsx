'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

const EssenceDEXToolsChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const isScriptAddedRef = useRef(false);

  useEffect(() => {
    const loadTradingViewWidget = () => {
      if (typeof window.TradingView === 'undefined' || !window.TradingView.widget) {
        console.error("TradingView widget library not loaded. Ensure dextools script is included and loaded first.");
        // Optionally, set a timeout and retry or show an error to the user.
        return;
      }

      const essPairAddress = "0x2afeaf811fe57b72cb496e841113b020a5cf0d60";
      const essChain = "ether"; // Chain name as used by DEXTools API
      const quoteCurrency = "usd"; // or "native" for WETH price, "usd" for USD price
      const dextoolsDisplaySymbol = "ESS / WETH"; // For display purposes
      const tradingViewSymbol = `UNISWAP3ETH:${essPairAddress}`;

      const timezone = "Etc/UTC";

      const dextoolsDatafeed = {
        onReady: function(callback: (config: any) => void) {
          console.log('[onReady]: DEXTools Datafeed Initialized');
          setTimeout(() => callback({
            supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
            supports_group_request: false,
            supports_marks: true,
            supports_search: true,
            supports_timescale_marks: false,
          }), 0);
        },

        searchSymbols: function(userInput: string, exchange: string, symbolType: string, onResultReadyCallback: (results: any[]) => void) {
          if (userInput.toUpperCase().includes("ESS")) {
            onResultReadyCallback([{
              symbol: tradingViewSymbol,
              full_name: tradingViewSymbol,
              description: dextoolsDisplaySymbol,
              exchange: "Uniswap V3",
              ticker: tradingViewSymbol,
              type: "crypto",
            }]);
          } else {
            onResultReadyCallback([]);
          }
        },

        resolveSymbol: function(symbolName: string, onSymbolResolvedCallback: (symbolInfo: any) => void, onResolveErrorCallback: (error: string) => void) {
          console.log('[resolveSymbol]: Resolving ' + symbolName);
          const symbolInfo = {
            name: dextoolsDisplaySymbol,
            full_name: `Uniswap V3:${dextoolsDisplaySymbol}`,
            ticker: tradingViewSymbol,
            description: "Earth 2 Essence / Wrapped Ether",
            type: "crypto",
            session: "24x7",
            exchange: "Uniswap V3",
            listed_exchange: "Uniswap V3",
            timezone: timezone,
            minmov: 1,
            pricescale: 100000000, // For price 0.02946, 10^8 might be suitable.
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
            volume_precision: 2,
            data_status: "streaming",
            chain: essChain,
            pair_address: essPairAddress,
            quote_currency: quoteCurrency
          };
          setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
        },

        getBars: async function(symbolInfo: any, resolution: string, periodParams: { from: number, to: number, firstDataRequest: boolean, countBack?: number }, onHistoryCallback: (bars: any[], meta: any) => void, onErrorCallback: (error: string) => void) {
          const { from, to, firstDataRequest, countBack } = periodParams;
          console.log(`[getBars]: Requesting ${symbolInfo.name}, Resolution: ${resolution}, From: ${new Date(from * 1000)}, To: ${new Date(to * 1000)}, CountBack: ${countBack}`);

          let apiResolution: string;
          if (resolution.endsWith('D') || resolution.endsWith('W') || resolution.endsWith('M')) {
            apiResolution = resolution.toLowerCase();
            if (resolution === "1D") apiResolution = "1d";
            if (resolution === "1W") apiResolution = "1w";
          } else {
            const numericRes = parseInt(resolution);
            if (numericRes >= 60) {
              apiResolution = (numericRes / 60) + "h";
            } else {
              apiResolution = numericRes + "m";
            }
          }
          
          let requestUrl: string;
          // DEXTools API for candles:
          // Structure: https://core-api.dextools.io/v1/pool/candles/{chain}/{pairAddress}/{quoteToken}/{resolution}?from={from}&to={to}
          // OR for latest N candles ending at 'ts': https://core-api.dextools.io/pool/candles/{chain}/{pairAddress}/{quoteToken}/{resolution}/{span}/latest?ts={timestamp}&tz=0
          // TradingView's `from` and `to` are in seconds. DEXTools `ts` in candles seems to be in milliseconds.

          if (firstDataRequest) {
            // For initial load, TradingView might send `countBack` and `to`.
            // DEXTools's `/latest` endpoint needs a `span` (like 'day', 'week') and `ts` (end time).
            // We need to estimate an appropriate span or try a `from`/`to` if available.
            // Let's try the from/to approach primarily. If countBack is heavily relied upon, we might need to adjust.
            const calculatedFrom = to - (countBack && countBack > 0 ? (parseTVResolutionToSeconds(resolution) * countBack) : parseTVResolutionToSeconds(resolution) * 300); // Default to 300 bars
            requestUrl = `https://core-api.dextools.io/v1/pool/candles/${symbolInfo.chain}/${symbolInfo.pair_address}/${symbolInfo.quote_currency}/${apiResolution}?from=${calculatedFrom}&to=${to}`;
             console.log(`[getBars] First data request. Calculated 'from': ${new Date(calculatedFrom * 1000)}. Requesting URL: ${requestUrl}`);
          } else {
            // Historical data request
            requestUrl = `https://core-api.dextools.io/v1/pool/candles/${symbolInfo.chain}/${symbolInfo.pair_address}/${symbolInfo.quote_currency}/${apiResolution}?from=${from}&to=${to}`;
            console.log(`[getBars] Historical data request. Requesting URL: ${requestUrl}`);
          }

          console.log(`[getBars] Fetching: ${requestUrl}`);

          try {
            const response = await fetch(requestUrl);
            if (!response.ok) {
              onErrorCallback(`Failed to fetch DEXTools candle data: ${response.status} ${response.statusText} from ${requestUrl}`);
              return;
            }
            const jsonResponse = await response.json();

            // DEXTools API v1 returns data directly in an array `jsonResponse.data.candles` (if structure is `v1/pool/candles`)
            // or `jsonResponse.candles` if it's another endpoint. Let's check `jsonResponse.data.candles` first as per v1 spec.
            // Also, DEXTools main API sometimes wraps good responses in `data` object and has `statusCode: 200`
            
            let candlesData = jsonResponse.data?.candles || jsonResponse.candles;

            if (!candlesData || (jsonResponse.statusCode && jsonResponse.statusCode !== 200) ) {
                console.warn('[getBars] No data or error in response structure:', jsonResponse);
                // Try to check for common DEXTools error/empty structures
                if (jsonResponse.message === "Not found" || (Array.isArray(candlesData) && candlesData.length === 0)) {
                     onHistoryCallback([], { noData: true });
                } else {
                     onErrorCallback(`Error in DEXTools API response: ${jsonResponse.message || 'Unexpected structure'}`);
                }
                return;
            }


            const bars = candlesData.map((c: any) => ({
              time: parseInt(c.ts || c.time), // DEXTools API 'ts' is in ms
              open: parseFloat(c.open),
              high: parseFloat(c.high),
              low: parseFloat(c.low),
              close: parseFloat(c.close),
              volume: parseFloat(c.volume)
            })).sort((a: { time: number }, b: { time: number }) => a.time - b.time);

            if (bars.length > 0) {
              console.log(`[getBars] Fetched ${bars.length} bars. First: ${new Date(bars[0].time)}, Last: ${new Date(bars[bars.length - 1].time)}`);
              onHistoryCallback(bars, { noData: false });
            } else {
              console.log('[getBars] No bars returned from API after processing.');
              onHistoryCallback([], { noData: true });
            }
          } catch (error: any) {
            console.error('[getBars] Error fetching or parsing data:', error);
            onErrorCallback("Exception in getBars: " + error.message);
          }
        },

        subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: () => void, subscriberUID: string, onResetCacheNeededCallback: () => void) => {
          console.log(`[subscribeBars]: Listener ${subscriberUID} subscribing to ${symbolInfo.full_name} resolution ${resolution}`);
          // Placeholder: DEXTools widget likely handles its own subscriptions.
          // For custom, would connect to WebSocket or poll.
        },

        unsubscribeBars: (subscriberUID: string) => {
          console.log(`[unsubscribeBars]: Listener ${subscriberUID} unsubscribing`);
        },
      };
      
      // Helper function to parse TradingView resolution to seconds (approximate for month/week)
      function parseTVResolutionToSeconds(resolution: string): number {
        const numericRes = parseInt(resolution);
        if (resolution.endsWith('D')) return numericRes * 24 * 60 * 60;
        if (resolution.endsWith('W')) return numericRes * 7 * 24 * 60 * 60;
        if (resolution.endsWith('M')) return numericRes * 30 * 24 * 60 * 60; // Approximation
        if (!isNaN(numericRes)) return numericRes * 60; // Minutes
        return 24 * 60 * 60; // Default to 1 day
      }


      if (chartContainerRef.current && chartContainerRef.current.id === "dextools-chart-container") {
         new window.TradingView.widget({
            container_id: "dextools-chart-container",
            symbol: tradingViewSymbol,
            interval: "1", // Default: 1 minute
            locale: "en",
            theme: "dark",
            datafeed: dextoolsDatafeed,
            library_path: "https://www.dextools.io/widget-chart/assets/vendors/charting_library/",
            autosize: true,
            overrides: {
              "paneProperties.background": "#131722",
              "paneProperties.vertGridProperties.color": "rgba(54, 60, 78, 0.5)",
              "paneProperties.horzGridProperties.color": "rgba(54, 60, 78, 0.5)",
              "scalesProperties.textColor": "#b2b5be",
              "scalesProperties.lineColor": "#363c4e",
              "mainSeriesProperties.style": 2, // Line chart
              "mainSeriesProperties.lineStyle.color": "#2962FF",
              "mainSeriesProperties.lineStyle.linewidth": 2,
              "mainSeriesProperties.showCountdown": false,
              "mainSeriesProperties.priceLineColor": "", // Hide price line
            },
            studies_overrides: {
              "volume.volume.color.0": "rgba(239, 83, 80, 0.5)",
              "volume.volume.color.1": "rgba(38, 166, 154, 0.5)",
              "volume.volume.transparency": 50,
            },
            disabled_features: [
              "header_symbol_search",
              "header_chart_type",
              "header_settings",
              "header_compare",
              "header_undo_redo",
              "header_screenshot",
              "header_fullscreen_button",
              "left_toolbar",
              "control_bar", 
              // "timeframes_toolbar" // Keep this enabled as per instructions
            ],
            enabled_features: [
               "timeframes_toolbar"
            ],
            time_frames: [
                { text: "5y", resolution: "1W", description: "5 Years" },
                { text: "1y", resolution: "1W", description: "1 Year" },
                { text: "6m", resolution: "1D", description: "6 Months" },
                { text: "3m", resolution: "1D", description: "3 Months" },
                { text: "1m", resolution: "4H", description: "1 Month" }, // 4H is 240
                { text: "5d", resolution: "15m", description: "5 Days" },
                { text: "1d", resolution: "1m", description: "1 Day" }
            ],
          });
      } else {
          console.error("Chart container not found or ID mismatch.");
      }
    };

    if (!isScriptAddedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://www.dextools.io/widget-chart/scripts-P3OMZZB2.js';
      script.async = true;
      script.onload = () => {
        console.log("DEXTools script loaded.");
        // Small delay to ensure TradingView object is available globally
        setTimeout(loadTradingViewWidget, 100); 
      };
      script.onerror = () => {
        console.error("Failed to load DEXTools script.");
      };
      document.body.appendChild(script);
      isScriptAddedRef.current = true;

      return () => {
        // Clean up script if component unmounts
        // Be cautious with removing scripts that might be shared or expected by other components
        // document.body.removeChild(script);
        // also, TradingView widgets might leave global state or listeners.
        // Proper cleanup would involve widget.remove() if the API supports it.
        if (chartContainerRef.current) {
            // Attempt to clean up by removing the widget instance if possible,
            // or at least clearing the container.
            // The TradingView library doesn't offer a straightforward 'destroy' for widgets
            // loaded this way without direct access to the widget instance.
            // Clearing innerHTML is a basic cleanup.
            chartContainerRef.current.innerHTML = '';
        }
      };
    } else if (window.TradingView) {
        // If script is already added (e.g., due to fast refresh), try to load widget directly
        loadTradingViewWidget();
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div 
      id="dextools-chart-container" 
      ref={chartContainerRef} 
      style={{ width: '100%', height: '550px' }}
    >
      {/* TradingView Chart will be rendered here */}
    </div>
  );
};

export default EssenceDEXToolsChart; 