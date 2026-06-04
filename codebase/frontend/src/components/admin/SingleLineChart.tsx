import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

function detectTrend(values: number[]): {
  color: string;
  fill: string;
  icon: string;
  label: string;
} {
  if (values.length < 2) {
    return { color: "#1565c0", fill: "rgba(21,101,192,0.08)", icon: "→", label: "Stable" };
  }
  const nonZero = values.find((v) => v !== 0) ?? values[0];
  const last = values[values.length - 1];
  const pct = (last - nonZero) / Math.max(Math.abs(nonZero), 0.001);
  if (pct > 0.05) {
    return { color: "#2e7d32", fill: "rgba(46,125,50,0.09)", icon: "↑", label: "Upward trend" };
  }
  if (pct < -0.05) {
    return { color: "#c62828", fill: "rgba(198,40,40,0.09)", icon: "↓", label: "Downward trend" };
  }
  return { color: "#1565c0", fill: "rgba(21,101,192,0.08)", icon: "→", label: "Stable" };
}

interface Props {
  title: string;
  points: number[];
  labels: string[];
  unit?: string;
  height?: number;
}

export function SingleLineChart({ title, points, labels, unit = "", height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const trend = detectTrend(points);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: points,
            borderColor: trend.color,
            backgroundColor: trend.fill,
            fill: true,
            tension: 0.38,
            pointRadius: labels.length > 12 ? 2 : 4,
            pointBackgroundColor: trend.color,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.parsed.y}${unit}` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxTicksLimit: 8 },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { font: { size: 11 } },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.join(","), labels.join(","), trend.color]);

  if (!points.length) {
    return (
      <div className="dash-chart-card card">
        <div className="dash-chart-header">
          <span className="dash-chart-title">{title}</span>
        </div>
        <p style={{ fontSize: 13, color: "#9aa5b4", padding: "20px 0" }}>No data yet.</p>
      </div>
    );
  }

  return (
    <div className="dash-chart-card card">
      <div className="dash-chart-header">
        <span className="dash-chart-title">{title}</span>
        <span className="dash-trend-badge" style={{ color: trend.color, borderColor: `${trend.color}55` }}>
          {trend.icon}&nbsp;{trend.label}
        </span>
      </div>
      <div style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
