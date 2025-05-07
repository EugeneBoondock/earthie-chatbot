'use client';

import { useState } from 'react';
import { SearchIcon, SlidersHorizontal, TrendingDown, Tag, MapPin, Building, Dices, RefreshCw, ArrowDownCircle } from 'lucide-react';

export default function FiresalesPage() {
  // State for firesale data, filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minDiscount, setMinDiscount] = useState(30); // Default 30% off
  const [tileClassFilter, setTileClassFilter] = useState('all');
  
  // Sample firesales data
  const sampleFiresales = [
    {
      id: 'fs-001',
      propertyName: 'Beachfront Paradise',
      location: 'Hawaii, USA',
      tileCount: 750,
      tileClass: 2,
      originalPrice: 5600,
      currentPrice: 3360,
      discount: 40,
      timeRemaining: '23h 45m',
      thumbnail: '/img/beach-property.jpg',
    },
    {
      id: 'fs-002',
      propertyName: 'Urban District',
      location: 'Tokyo, Japan',
      tileCount: 420,
      tileClass: 1,
      originalPrice: 8900,
      currentPrice: 4895,
      discount: 45,
      timeRemaining: '16h 30m',
      thumbnail: '/img/urban-property.jpg',
    },
    {
      id: 'fs-003',
      propertyName: 'Mountain Retreat',
      location: 'Alps, Switzerland',
      tileCount: 1250,
      tileClass: 3,
      originalPrice: 3800,
      currentPrice: 2470,
      discount: 35,
      timeRemaining: '2d 8h',
      thumbnail: '/img/mountain-property.jpg',
    },
  ];

  // Filter options
  const discountOptions = [10, 20, 30, 40, 50];
  const tileClassOptions = [
    { value: 'all', label: 'All Classes' },
    { value: '1', label: 'Class 1' },
    { value: '2', label: 'Class 2' },
    { value: '3', label: 'Class 3' },
  ];
  
  return (
    <div className="space-y-8">
      {/* Header Section with Glassmorphic Effect */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-400/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 inline-block text-transparent bg-clip-text mb-4">
            Firesales Tracker
          </h1>
          <p className="text-lg text-cyan-200/90 max-w-3xl">
            Monitor Earth2 properties with significant discounts. Find opportunities and track potential firesales in real-time.
          </p>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-emerald-400/20 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          {/* Search Box */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-emerald-500/30 rounded-lg bg-earthie-dark-light/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 backdrop-blur-sm"
              placeholder="Search by property name, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Minimum Discount Selector */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                <TrendingDown className="h-4 w-4 mr-1 text-emerald-400" />
                Min. Discount
              </label>
              <select 
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full py-2 px-3 border border-emerald-500/30 rounded-lg bg-earthie-dark-light/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {discountOptions.map(option => (
                  <option key={option} value={option}>{option}% off</option>
                ))}
              </select>
            </div>

            {/* Tile Class Filter */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                <Building className="h-4 w-4 mr-1 text-emerald-400" />
                Tile Class
              </label>
              <select 
                value={tileClassFilter}
                onChange={(e) => setTileClassFilter(e.target.value)}
                className="w-full py-2 px-3 border border-emerald-500/30 rounded-lg bg-earthie-dark-light/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {tileClassOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <button className="self-end md:self-center py-2.5 px-4 border border-emerald-500/40 rounded-lg bg-emerald-600/30 text-white hover:bg-emerald-600/40 transition-colors flex items-center justify-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Firesales Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sampleFiresales.map((property) => (
          <div 
            key={property.id}
            className="group backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-emerald-400/20 hover:border-emerald-400/40 rounded-xl overflow-hidden shadow-lg transition-all hover:shadow-emerald-500/10 hover:-translate-y-1"
          >
            {/* Property Image */}
            <div className="h-48 w-full relative overflow-hidden bg-earthie-dark-light">
              {property.thumbnail ? (
                <div 
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${property.thumbnail})` }}
                ></div>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-earthie-dark-light/80">
                  <Building className="h-16 w-16 text-emerald-600/30" />
                </div>
              )}
              {/* Discount Badge */}
              <div className="absolute top-3 right-3 flex items-center px-3 py-1.5 rounded-full bg-red-600/80 text-white font-bold shadow-md">
                <ArrowDownCircle className="h-4 w-4 mr-1" />
                {property.discount}% OFF
              </div>
            </div>
            
            {/* Property Details */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white truncate">{property.propertyName}</h3>
                <p className="text-sm text-gray-300 flex items-center mt-1">
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> {property.location}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-400">Original Price</span>
                  <span className="text-gray-300 line-through">${property.originalPrice.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400">Current Price</span>
                  <span className="text-emerald-400 font-medium">${property.currentPrice.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400">Tile Count</span>
                  <span className="text-white">{property.tileCount.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400">Class</span>
                  <span className="text-white">Class {property.tileClass}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-emerald-700/20">
                <div className="flex items-center text-amber-400">
                  <Dices className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">{property.timeRemaining} left</span>
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-emerald-600/40 text-white text-sm hover:bg-emerald-600/60 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Development Notice - will be removed once real data is available */}
      <div className="backdrop-blur-md bg-gray-900/50 border border-emerald-400/10 rounded-lg p-5 text-center">
        <p className="text-cyan-300/70 text-sm">The Firesales Tracker is currently in development. Sample data shown.</p>
        <p className="text-xs text-cyan-400/60 mt-1">Real-time data will be integrated with Earth2's marketplace.</p>
      </div>
    </div>
  );
}