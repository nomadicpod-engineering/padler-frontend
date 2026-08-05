'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';
import { cn } from '@/lib/utils';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

type PadlerChartProps = {
  type?: 'line' | 'area' | 'bar' | 'donut';
  series: ApexOptions['series'];
  options?: ApexOptions;
  height?: number;
  className?: string;
};

const baseOptions: ApexOptions = {
  chart: {
    toolbar: { show: false },
    animations: {
      enabled: true,
      speed: 450,
      animateGradually: { enabled: true, delay: 80 },
      dynamicAnimation: { enabled: true, speed: 280 }
    },
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2.5 },
  grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
  colors: ['#1d4ed8', '#14b8a6', '#f59e0b', '#ef4444'],
  legend: { position: 'bottom' },
  tooltip: { theme: 'light' }
};

export function PadlerChart({
  type = 'area',
  series,
  options,
  height = 280,
  className
}: PadlerChartProps) {
  return (
    <div className={cn('w-full overflow-hidden rounded-2xl', className)}>
      <ReactApexChart
        type={type}
        series={series}
        height={height}
        options={{ ...baseOptions, ...options }}
      />
    </div>
  );
}
