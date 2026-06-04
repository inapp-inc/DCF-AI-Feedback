import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from "chart.js";
import { C } from "../../theme/tokens";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

type Point = { bucket: string; submissions: number; avgScore: number };

export function TrendsChart({ points }: { points: Point[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sorted = [...points].sort((a, b) => a.bucket.localeCompare(b.bucket));
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: sorted.map((p) => p.bucket),
        datasets: [
          {
            label: "Submissions",
            data: sorted.map((p) => p.submissions),
            borderColor: C.teal,
            backgroundColor: "rgba(10, 138, 133, 0.12)",
            tension: 0.3,
            fill: true,
          },
          {
            label: "Avg sentiment",
            data: sorted.map((p) => p.avgScore),
            borderColor: C.purple,
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Submissions" } },
          y1: {
            position: "right",
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Sentiment" },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [points]);

  return (
    <div style={{ height: 260 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
