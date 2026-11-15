import React from "react";

export function Logo({ small = false }) {
  return (
    <span className={"logo " + (small ? "small" : "")}>
      <svg viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="9"
          fill="currentColor"
        />

        <ellipse
          cx="22"
          cy="22"
          rx="21"
          ry="8"
          transform="rotate(-42 22 22)"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />

        <path
          d="M6 7l3 1-1 3-2-4Z"
          fill="currentColor"
        />
      </svg>

      {!small && (
        <b>
          SOL
          <span>HEALTH INTELLIGENCE</span>
        </b>
      )}
    </span>
  );
}


export function LineChart({
  rows = [],
  metric = "hip_angle_deg",
  deviation = 20,
  minConfidence = 0.75,
  compact = false,
}) {
  const values = rows
    .map((row) => row[metric])
    .filter(Number.isFinite);

  if (!values.length) {
    return (
      <div className="empty-chart">
        No measurements for this metric
      </div>
    );
  }

  const references =
    metric === "hip_angle_deg"
      ? rows
          .map((row) => row.baseline_angle_deg)
          .filter(Number.isFinite)
      : [];

  const min =
    metric === "heart_rate"
      ? Math.min(45, ...values) - 5
      : Math.max(
          0,
          Math.min(90, ...values, ...references) - 5
        );

  const max =
    metric === "heart_rate"
      ? Math.max(110, ...values) + 5
      : 180;

  // Convert observation indices and values to SVG coordinates.
  const x = (index) =>
    48 + (index / Math.max(rows.length - 1, 1)) * 650;

  const y = (value) =>
    195 - ((value - min) / (max - min)) * 155;

  // Keep gaps where measurements are missing.
  const segments = [];
  let part = [];

  rows.forEach((row, index) => {
    if (Number.isFinite(row[metric])) {
      part.push(`${x(index)},${y(row[metric])}`);
    } else {
      if (part.length) {
        segments.push(part);
      }

      part = [];
    }
  });

  if (part.length) {
    segments.push(part);
  }

  return (
    <svg
      className={"line-chart " + (compact ? "compact" : "")}
      viewBox="0 0 730 235"
      role="img"
      aria-label={
        metric === "heart_rate"
          ? "Heart rate across observations"
          : "Hip angle observations compared with baseline"
      }
    >
      {/* Area shading */}
      <defs>
        <linearGradient
          id={"shade" + metric}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop
            stopColor="#257d67"
            stopOpacity=".16"
          />

          <stop
            offset="1"
            stopColor="#257d67"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      {/* Horizontal grid and value labels */}
      {[0, 1, 2, 3].map((index) => {
        const value = min + ((max - min) / 3) * index;

        return (
          <g key={index}>
            <line
              x1="48"
              x2="700"
              y1={y(value)}
              y2={y(value)}
              stroke="#e9ece8"
              strokeDasharray="3 4"
            />

            <text
              x="34"
              y={y(value) + 4}
              textAnchor="end"
              fill="#909993"
              fontSize="11"
            >
              {Math.round(value)}
              {metric === "hip_angle_deg" ? "°" : ""}
            </text>
          </g>
        );
      })}

      {/* Personal reference line */}
      {metric === "hip_angle_deg" &&
        rows.map((row, index) => {
          const hasReference =
            index > 0 &&
            Number.isFinite(row.baseline_angle_deg) &&
            Number.isFinite(
              rows[index - 1].baseline_angle_deg
            );

          if (!hasReference) {
            return null;
          }

          return (
            <line
              key={index}
              x1={x(index - 1)}
              x2={x(index)}
              y1={y(rows[index - 1].baseline_angle_deg)}
              y2={y(row.baseline_angle_deg)}
              stroke="#adb8af"
              strokeDasharray="5 5"
            />
          );
        })}

      {/* Observed values */}
      {segments.map((segment, index) => (
        <g key={index}>
          <polygon
            points={
              `${segment[0].split(",")[0]},196 ` +
              `${segment.join(" ")} ` +
              `${segment.at(-1).split(",")[0]},196`
            }
            fill={"url(#shade" + metric + ")"}
          />

          <polyline
            points={segment.join(" ")}
            fill="none"
            stroke="#257d67"
            strokeWidth="2.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Observations outside the reference band */}
      {rows.map((row, index) => {
        const isFlagged =
          metric === "hip_angle_deg" &&
          Number.isFinite(row[metric]) &&
          row.confidence >= minConfidence &&
          Number.isFinite(row.baseline_angle_deg) &&
          Math.abs(
            row[metric] - row.baseline_angle_deg
          ) > deviation;

        if (!isFlagged) {
          return null;
        }

        return (
          <circle
            key={index}
            cx={x(index)}
            cy={y(row[metric])}
            r="3"
            fill="#d98b4c"
          />
        );
      })}

      {/* Time labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction, index) => {
        const row =
          rows[Math.round((rows.length - 1) * fraction)];

        return (
          <text
            key={index}
            x={48 + 650 * fraction}
            y="224"
            textAnchor="middle"
            fill="#8d9690"
            fontSize="11"
          >
            {row?.timestamp?.slice(11, 16) || "—"}
          </text>
        );
      })}
    </svg>
  );
}


export function BodyFigure({ small = false }) {
  const landmarks = [
    [140, 96],
    [105, 109],
    [176, 109],
    [92, 154],
    [193, 154],
    [71, 197],
    [213, 197],
    [122, 228],
    [159, 228],
    [124, 301],
    [164, 301],
  ];

  return (
    <svg
      viewBox="0 0 280 350"
      className={"body-figure " + (small ? "small" : "")}
      role="img"
      aria-label="Illustrative body pose showing tracked landmarks, not a live camera feed"
    >
      {/* Body shading and highlight gradients */}
      <defs>
        <linearGradient id="body" x1="0" x2="1">
          <stop
            stopColor="#c9dccf"
            stopOpacity=".1"
          />

          <stop
            offset=".5"
            stopColor="#d4e4da"
            stopOpacity=".34"
          />

          <stop
            offset="1"
            stopColor="#c9dccf"
            stopOpacity=".1"
          />
        </linearGradient>

        <radialGradient id="spine">
          <stop
            stopColor="#f6c687"
            stopOpacity=".6"
          />

          <stop
            offset="1"
            stopColor="#e0a365"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>

      {/* Background guides */}
      <g stroke="#b8d3c5" strokeOpacity=".15">
        <path
          d="M40 40h200v270H40Z"
          fill="none"
          strokeDasharray="4 6"
        />

        <path
          d="M140 15v320M20 175h240"
          strokeDasharray="3 7"
        />
      </g>

      {/* Ground shadow */}
      <ellipse
        cx="140"
        cy="320"
        rx="72"
        ry="10"
        fill="#a8cebc"
        opacity=".06"
      />

      {/* Head and body outline */}
      <g
        fill="url(#body)"
        stroke="#b9d1c3"
        strokeOpacity=".55"
        strokeWidth="1"
      >
        <ellipse
          cx="140"
          cy="53"
          rx="21"
          ry="26"
        />

        <path
          d="M128 78l-3 13-26 11-16 52-17 41 10 7 27-45 10-29-3 60-9 24 11 21 6 75 13 4 8-75 7-1 9 75 13-4 3-78 10-18-10-25-1-62 13 35 25 42 11-7-20-43-17-47-27-12-3-13Z"
        />
      </g>

      {/* Central guide and review-area glow */}
      <path
        d="M140 94v105"
        stroke="#b4d8c6"
        strokeWidth="2"
        strokeDasharray="3 4"
      />

      <ellipse
        cx="140"
        cy="172"
        rx="33"
        ry="44"
        fill="url(#spine)"
      />

      {/* Landmark connections */}
      <g
        fill="none"
        stroke="#6ba58b"
        strokeWidth="1.3"
      >
        <path
          d="M105 109l34-13 37 13M105 109l-13 45-21 43M176 109l17 45 20 43M139 96v100l-17 32 2 73M139 196l20 32 5 73M105 109l17 119h37l17-119"
        />
      </g>

      {/* Landmark points */}
      {landmarks.map(([x, y], index) => (
        <g key={index}>
          <circle
            cx={x}
            cy={y}
            r="5"
            fill="#6ac197"
            opacity=".15"
          />

          <circle
            cx={x}
            cy={y}
            r="2.6"
            fill="#a7d5bb"
          />
        </g>
      ))}

      {/* Review-area marker */}
      <circle
        cx="140"
        cy="173"
        r="5"
        fill="#e7b276"
      />

      <circle
        cx="140"
        cy="173"
        r="10"
        fill="none"
        stroke="#e7b276"
        opacity=".5"
      />

      <path
        d="M151 173h45l13-12h30"
        fill="none"
        stroke="#e7b276"
        strokeWidth=".7"
      />

      <text
        x="203"
        y="153"
        fill="#e9c594"
        fontSize="9"
      >
        REVIEW AREA
      </text>

      {/* Figure labels */}
      <text
        x="40"
        y="27"
        fill="#8eafa0"
        fontSize="8"
        letterSpacing="2"
      >
        ANTERIOR VIEW
      </text>

      <text
        x="40"
        y="336"
        fill="#8eafa0"
        fontSize="8"
        letterSpacing="1.5"
      >
        ILLUSTRATIVE POSE
      </text>
    </svg>
  );
}