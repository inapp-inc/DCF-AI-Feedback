import { useEffect, useRef } from "react";
import { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  title: string;
  items: BarItem[];
  unit?: string;
  horizontal?: boolean;
  height?: number;
  maxValue?: number;
}

export function BarChart({ title, items, unit = "", horizontal = false, height = 200, maxValue }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: items.map((i) => i.label),
        datasets: [
          {
            data: items.map((i) => i.value),
            backgroundColor: items.map((i) => i.color ?? "#1b3054cc"),
            borderRadius: 6,
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed[horizontal ? "x" : "y"]}${unit}`,
            },
          },
        },
        scales: {
          x: {
            max: horizontal ? (maxValue ?? undefined) : undefined,
            grid: { display: !horizontal, color: "rgba(0,0,0,0.05)" },
            ticks: { font: { size: 11 } },
          },
          y: {
            max: !horizontal ? (maxValue ?? undefined) : undefined,
            beginAtZero: true,
            grid: { display: horizontal, color: "rgba(0,0,0,0.05)" },
            ticks: { font: { size: 11 } },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), horizontal]);

  if (!items.length) {
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
      </div>
      <div style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
