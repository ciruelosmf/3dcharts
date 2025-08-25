// src/app/page.tsx
'use client'; // This directive is necessary for components using hooks like useState and useEffect

import { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import axios from 'axios';

// --- TYPE DEFINITIONS ---
// We define the shape of our data for TypeScript to help us avoid errors.

// The raw data format from the Binance API
// New, correct type
type BinanceRawCandle = [
  number,   // 0: Open time
  string,   // 1: Open price
  string,   // 2: High price
  string,   // 3: Low price
  string,   // 4: Close price
  string,   // 5: Volume
  number,   // 6: Close time
  string,   // 7: Quote asset volume
  number,   // 8: Number of trades
  string,   // 9: Taker buy base asset volume
  string,   // 10: Taker buy quote asset volume
  string    // 11: Ignore
];

// The processed candle data we'll use in our components
type ProcessedCandle = {
  openingPrice: number;
  closingPrice: number;
  lowestPrice: number;
  highestPrice: number;
  dayOfMonth: number;
  month: number;
};

// The data to be displayed in the UI when hovering over a candle
type HoverData = {
  open: number;
  close: number;
  high: number;
  low: number;
} | null;


// --- CONSTANTS ---
const API_BASE_URL = 'https://api.binance.com/api/v1/klines';
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1d';
const LIMIT = 122;
const SCALE_OF_CANDLES = 4;
const CANDLE_SPACING = 1.8;
const FONT_URL = '/MPLUSCodeLatin-VariableFont_wdth,wght.ttf'; // Path to font in the `public` folder


// --- 3D COMPONENTS ---
// We define our 3D objects as separate components for clarity, even within the same file.

interface CandlestickProps {
  data: ProcessedCandle;
  refPrice: number;
  scale: number;
  xPos: number;
}

/**
 * A single Candlestick component representing one day.
 * It contains the complex positioning logic from your original code.
 */
function Candlestick({ data, refPrice, scale, xPos }: CandlestickProps) {
  const { openingPrice, closingPrice, highestPrice, lowestPrice } = data;
  const isGreen = closingPrice > openingPrice;

  // useMemo is a React hook that optimizes performance by caching the result of a calculation.
  // This calculation will only re-run if one of its dependencies (the values in the array) changes.
  const { bodyHeight, bodyY, wickHeight, wickY } = useMemo(() => {
    const bodyH = Math.abs(openingPrice - closingPrice);
    const wickH = highestPrice - lowestPrice;
    
    // Y position of the center of the body relative to the reference price
    const bodyCenter = isGreen ? openingPrice + bodyH / 2 : closingPrice + bodyH / 2;
    const bodyYPos = (bodyCenter - refPrice) * scale;
    
    // Y position of the center of the wick relative to the reference price
    const wickCenter = lowestPrice + wickH / 2;
    const wickYPos = (wickCenter - refPrice) * scale;

    return {
      bodyHeight: bodyH * scale,
      bodyY: bodyYPos,
      wickHeight: wickH * scale,
      wickY: wickYPos,
    };
  }, [openingPrice, closingPrice, highestPrice, lowestPrice, refPrice, scale, isGreen]);

  return (
    <group position-x={xPos}>
      {/* Wick */}
      <mesh position-y={wickY}>
        <boxGeometry args={[0.23, wickHeight, 0.23]} />
        <meshPhongMaterial color={isGreen ? 0xe0ff99 : 0xff8981} />
      </mesh>
      {/* Body */}
      <mesh position-y={bodyY}>
        <boxGeometry args={[1, bodyHeight, 1]} />
        <meshPhongMaterial color={isGreen ? 0xb1ff00 : 0xff1100} />
      </mesh>
    </group>
  );
}


interface CryptoChartProps {
  candles: ProcessedCandle[];
  refPrice: number;
  onHover: (data: HoverData) => void;
}

/**
 * The main 3D chart component that arranges all the candles, grids, and labels.
 */
function CryptoChart({ candles, refPrice, onHover }: CryptoChartProps) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <group>
      {/* Render all candlesticks by mapping over the data */}
      {candles.map((candle, i) => (
        <Candlestick
          key={`candle-${i}`}
          data={candle}
          refPrice={refPrice}
          scale={SCALE_OF_CANDLES}
          xPos={-i * CANDLE_SPACING}
        />
      ))}

      {/* Grid and Hover Interaction Plane */}
      <group>
        {/* We use invisible vertical planes for hover detection, which is more efficient */}
        {candles.map((candle, i) => (
          <mesh
            key={`hover-${i}`}
            position={[-i * CANDLE_SPACING, 0, 0]}
            onPointerMove={() => onHover({
              open: candle.openingPrice, close: candle.closingPrice,
              high: candle.highestPrice, low: candle.lowestPrice,
            })}
            onPointerOut={() => onHover(null)}
          >
            <planeGeometry args={[CANDLE_SPACING, 160]} />
            <meshBasicMaterial visible={false} /> {/* This mesh is invisible */}
          </mesh>
        ))}
        {/* Horizontal grid lines */}
        {Array.from({ length: 50 }).map((_, i) => (
          <mesh key={`grid-h-${i}`} position={[-LIMIT * CANDLE_SPACING / 2, ((i - 20) * SCALE_OF_CANDLES), 0]}>
            <boxGeometry args={[LIMIT * CANDLE_SPACING, 0.02, 0.02]} />
            <meshBasicMaterial color="#444a69" />
          </mesh>
        ))}
      </group>

      {/* Text Labels using <Text> from @react-three/drei */}
      <group>
        {/* Main Reference Price Label */}
        <Text position={[1, 0, 0]} fontSize={1.7} color="white" anchorX="left" font={FONT_URL}>
          {`${(refPrice * 1000).toFixed(0)} USD`}
        </Text>

        {/* Dynamic Price Labels above and below */}
        {Array.from({ length: 15 }).map((_, i) => (
          <group key={`price-labels-${i}`}>
            <Text position={[1, (i + 1) * SCALE_OF_CANDLES, -1]} fontSize={0.7} color="white" anchorX="left" font={FONT_URL}>
              {`${(refPrice * 1000 + (i + 1) * 1000).toFixed(0)} USD`}
            </Text>
            <Text position={[1, -(i + 1) * SCALE_OF_CANDLES, -1]} fontSize={0.7} color="white" anchorX="left" font={FONT_URL}>
              {`${(refPrice * 1000 - (i + 1) * 1000).toFixed(0)} USD`}
            </Text>
          </group>
        ))}

        {/* Date Labels on the X-Axis */}
        {candles.map((candle, i) => (
          <group key={`date-${i}`} position={[-i * CANDLE_SPACING, -20, 1]}>
            <Text fontSize={0.7} color="white" font={FONT_URL}>
              {candle.dayOfMonth.toString()}
            </Text>
            {candle.dayOfMonth === 1 && (
              <Text position={[0, 2, 0]} fontSize={0.7} color="white" font={FONT_URL}>
                {monthNames[candle.month]}
              </Text>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}


// --- MAIN PAGE COMPONENT ---
// This is the default component that Next.js will render for this page.
export default function HomePage() {
  // --- STATE MANAGEMENT ---
  // We use React's `useState` hook to manage the component's state.
  const [processedCandles, setProcessedCandles] = useState<ProcessedCandle[]>([]);
  const [refPrice, setRefPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverData, setHoverData] = useState<HoverData>(null);

  // --- DATA FETCHING ---
  // `useEffect` runs code after the component mounts.
  // The empty array `[]` at the end means it will only run once.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - LIMIT);
        const url = `${API_BASE_URL}?symbol=${SYMBOL}&interval=${INTERVAL}&limit=${LIMIT}&startTime=${startTime.getTime()}`;
        const response = await axios.get<BinanceRawCandle[]>(url);
        
        // --- Data Processing Logic ---
        const pricesScaled = response.data.map((candle) => {
          const date = new Date(candle[0]);
          return {
            openingPrice: parseFloat(candle[1]) / 1000,
            closingPrice: parseFloat(candle[4]) / 1000,
            lowestPrice: parseFloat(candle[3]) / 1000,
            highestPrice: parseFloat(candle[2]) / 1000,
            dayOfMonth: date.getDate(),
            month: date.getMonth(),
          };
        });

        // Calculate average reference price
        const totalOpeningPrice = pricesScaled.reduce((sum, c) => sum + c.openingPrice, 0);
        const averagePrice = Math.round(totalOpeningPrice / pricesScaled.length);
        
        setRefPrice(averagePrice);
        setProcessedCandles(pricesScaled.reverse()); // Reverse to have the latest candle on the left
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch cryptocurrency data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- RENDER ---
  // This is the JSX that gets rendered to the screen.
  return (
    <main className="relative w-screen h-screen bg-[#2b2b2b]">
      {/* UI Overlay (HUD) for displaying information */}
      <div className="absolute top-4 left-4 z-10 p-4 bg-black bg-opacity-50 rounded-lg text-white font-mono shadow-lg">
        <h1 className="text-xl font-bold mb-2">{SYMBOL} 3D Chart</h1>
        {hoverData ? (
          <div>
            <p>Open: <span className="text-gray-300">${(hoverData.open * 1000).toFixed(2)}</span></p>
            <p>Close: <span className="text-gray-300">${(hoverData.close * 1000).toFixed(2)}</span></p>
            <p>High: <span className="text-green-400">${(hoverData.high * 1000).toFixed(2)}</span></p>
            <p>Low: <span className="text-red-400">${(hoverData.low * 1000).toFixed(2)}</span></p>
          </div>
        ) : (
          <p className="text-gray-400">Hover over a candle for details</p>
        )}
      </div>

      {isLoading && <div className="flex items-center justify-center h-full text-white text-2xl">Loading Chart Data...</div>}
      {error && <div className="flex items-center justify-center h-full text-red-500 text-2xl">{error}</div>}
      
      {/* The 3D Canvas. We only render it when data is ready. */}
      {!isLoading && !error && (
        <Canvas camera={{ fov: 75, near: 0.1, far: 1000, position: [0, -9, 30] }}>
          <color attach="background" args={['#2b2b2b']} />
          
          {/* Lighting setup from your original code */}
          <ambientLight intensity={0.1} />
          <directionalLight intensity={0.7} position={[1, 42, 0]} />
          <directionalLight intensity={0.7} position={[66, 0, 1]} />
          <directionalLight intensity={0.7} position={[-166, 0, 1]} />
          <directionalLight intensity={1.2} position={[1, 0, 71]} />
          <directionalLight intensity={1.2} position={[1, 0, -71]} />

          {/* Render the chart component */}
          <CryptoChart 
            candles={processedCandles} 
            refPrice={refPrice}
            onHover={setHoverData}
          />
          
          <OrbitControls enableDamping dampingFactor={0.1} rotateSpeed={0.2} />
        </Canvas>
      )}
    </main>
  );
}