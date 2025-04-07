'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createNoise2D } from 'simplex-noise';

const TopographicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Adjust these parameters to change the look of the lines
  const noiseScale = 0.025; // Further increased for even smaller features
  const numLevels = 20; // More levels for finer detail
  const levelSpacing = 0.04; // Closer spacing for denser lines
  const lineColor = 'rgba(80, 227, 193, 0.25)'; // #50E3C1 slightly lower opacity
  const lineWidth = 0.75; // Even thinner lines
  const gridResolution = 4; // Sample more points

  // Update dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateSize);
    updateSize(); // Initial size
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size explicitly
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const noise2D = createNoise2D();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827'; // bg-gray-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configure line style
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round'; // Smoother joins
    ctx.lineCap = 'round'; // Smoother ends

    // --- Drawing Logic --- 
    // This is a simplified approach iterating through pixels
    // More advanced methods use marching squares algorithm for smoother contours
    // Let's sample noise at grid points
    const noiseValues: number[][] = [];
    for (let y = 0; y < canvas.height; y += gridResolution) {
        noiseValues[y / gridResolution] = [];
        for (let x = 0; x < canvas.width; x += gridResolution) {
            // Map pixel coordinates to noise space
            const nx = x * noiseScale;
            const ny = y * noiseScale;
            // Get noise value in range [-1, 1], shift to [0, 1]
            const noiseVal = (noise2D(nx, ny) + 1) / 2;
            noiseValues[y / gridResolution][x / gridResolution] = noiseVal;
        }
    }

    // Draw contour lines
    for (let level = 0; level < numLevels; level++) {
        const threshold = (level / numLevels) * levelSpacing + 0.4; // Adjust starting offset (0.4)
        ctx.beginPath();
        for (let gy = 0; gy < noiseValues.length - 1; gy++) {
            for (let gx = 0; gx < (noiseValues[gy]?.length ?? 0) - 1; gx++) {
                const val = noiseValues[gy][gx];
                // Simple check: If noise value crosses threshold between neighbors
                // Draw small line segments (very basic contouring)
                const neighbors = [
                    noiseValues[gy+1]?.[gx],    // Below
                    noiseValues[gy]?.[gx+1]     // Right
                ];

                neighbors.forEach((neighborVal, i) => {
                    if (neighborVal === undefined) return;
                    const crossesThreshold = (val >= threshold && neighborVal < threshold) || (val < threshold && neighborVal >= threshold);
                    if (crossesThreshold) {
                        const x1 = gx * gridResolution;
                        const y1 = gy * gridResolution;
                        // Approximate midpoint or edge for line segment
                        if (i === 0) { // Below
                             ctx.moveTo(x1, y1 + gridResolution / 2);
                             ctx.lineTo(x1 + gridResolution / 2, y1 + gridResolution / 2);
                        } else { // Right
                             ctx.moveTo(x1 + gridResolution / 2, y1);
                             ctx.lineTo(x1 + gridResolution / 2, y1 + gridResolution / 2);
                        }
                    }
                });
            }
        }
        ctx.stroke(); // Stroke lines for this level
    }

  }, [dimensions, noiseScale, numLevels, levelSpacing, lineColor, lineWidth, gridResolution]); // Added gridResolution to deps

  return (
    <canvas 
      ref={canvasRef}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: -1, // Position behind everything
        opacity: 0.6 // Increase opacity slightly to compensate for thinner lines
      }}
    />
  );
};

export default TopographicBackground; 