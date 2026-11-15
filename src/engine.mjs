
export const crew = [
  {
    id: "SOL-01",
    name: "Alex Morgan",
    initials: "AM",
    role: "Flight engineer",
    day: 142,
    color: "#dce9df",
    baselineHR: 64,
  },
  {
    id: "SOL-02",
    name: "Maya Chen",
    initials: "MC",
    role: "Mission specialist",
    day: 142,
    color: "#f1e4d2",
    baselineHR: 68,
  },
  {
    id: "SOL-03",
    name: "Adam Noor",
    initials: "AN",
    role: "Commander",
    day: 142,
    color: "#e2e6f2",
    baselineHR: 62,
  },
];



export const studies = [
  {
    year: "2016",
    tag: "SPINE · MRI",

    title:
      "Lumbar spine paraspinal muscle and intervertebral disc height changes in astronauts",

    n: "6 crew members",

    finding:
      "Lean paraspinal muscle fraction fell from 86% to 72%. Post-flight disc heights were not appreciably different.",

    use:
      "Track muscle quality separately from spinal dimensions. Camera estimates cannot measure either.",

    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025/",
  },
  {
    year: "2022",
    tag: "MUSCLE · MRI",

    title:
      "Change in Lumbar Muscle Size and Composition on MRI with Long-Duration Spaceflight",

    n: "6 crew members",

    finding:
      "Paraspinal cross-sectional area decreased by 9.0% on average, with substantial variation between individuals.",

    use:
      "Compare each astronaut with their own baseline. Association with exercise does not establish a prescription.",

    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9167780/",
  },
  {
    year: "2023 / 24",
    tag: "BONE · CT",

    title:
      "Changes in Vertebral Bone Density and Paraspinal Muscle Morphology Following Spaceflight and 1 Year Readaptation on Earth",

    n: "17 crew · 15 follow-up",

    finding:
      "Regional vertebral bone loss and changes in muscle morphology persisted into readaptation.",

    use:
      "Use dated clinical imaging for bone and muscle tissue metrics; never infer bone density from video.",

    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10731107/",
  },
  {
    year: "2023",
    tag: "NASA · SENSORIMOTOR",

    title:
      "Field Assessment of Sensorimotor Function Following Long-Duration Spaceflight",

    n: "19 crew members",

    finding:
      "Early post-flight testing showed slower stabilization and poorer walking performance, with task-dependent recovery.",

    use:
      "Keep pre-flight and post-flight balance assessments separate from in-flight movement.",

    url: "https://ntrs.nasa.gov/citations/20220016680",
  },
  {
    year: "2024",
    tag: "NASA · MOTION CAPTURE",

    title:
      "Kinematic Sensors Evaluation for Spaceflight Exercise Data Collections",

    n: "Technology evaluation",

    finding:
      "NASA describes marker-based in-flight capture and evaluates camera and wearable approaches for exercise data.",

    use:
      "Motivates multimodal capture. This prototype’s single-camera pose model is not validated for microgravity.",

    url: "https://ntrs.nasa.gov/citations/20240001089",
  },
  {
    year: "2026",
    tag: "NASA · HUMAN FACTORS",

    title:
      "NASA-STD-3001, Volume 2 — Human Factors, Habitability, and Environmental Health",

    n: "Existing spaceflight standard",

    finding:
      "NASA already defines human-system requirements for spaceflight, including physical capabilities and equipment accommodation.",

    use:
      "Map research hypotheses to existing standards. Proposed adaptations require expert review and validation.",

    url: "https://www.nasa.gov/reference/nasa-std-3001v2/",
  },
];

export function demoRecords(id = "SOL-01") {
  const person = crew.find((p) => p.id === id) || crew[0];
  const offset = crew.indexOf(person);

  return Array.from({ length: 48 }, (_, i) => ({
    astronaut_id: id,

    timestamp: new Date(
      Date.UTC(2026, 10, 14, 8, i * 5)
    ).toISOString(),

    phase: "in-flight",
    gravity: "microgravity",
    task: "restrained-work",
    source: "demo-fused",

    hip_angle_deg: Math.round(
      151 +
        Math.sin(i * 0.63) * 5 -
        (i > 22 && i < 30 ? 30 : 0) +
        offset * 3
    ),

    heart_rate: Math.round(
      person.baselineHR +
        7 +
        Math.sin(i * 0.5) * 4 +
        (i > 22 && i < 30 ? 11 : 0)
    ),

    confidence:
      i === 18
        ? 0.48
        : 0.88 + (i % 4) * 0.025,

    baseline_angle_deg: 155,
  }));
}

export const CSV_HEADER =
  "astronaut_id,timestamp,phase,gravity,task,source," +
  "hip_angle_deg,baseline_angle_deg,heart_rate,confidence";

export function toCSV(rows) {
  const cell = (value) => {
    const text = String(value ?? "");

    if (/[",\r\n]/.test(text)) {
      return '"' + text.replaceAll('"', '""') + '"';
    }

    return text;
  };

  const columns = CSV_HEADER.split(",");

  const lines = rows.map((row) =>
    columns
      .map((column) => cell(row[column]))
      .join(",")
  );

  return CSV_HEADER + "\n" + lines.join("\n");
}


function csvCells(line) {
  const cells = [];

  let cell = "";
  let quote = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];

    if (character === '"') {
      if (quote && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quote = !quote;
      }
    } else if (character === "," && !quote) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quote) {
    throw new Error("Unclosed quote in CSV.");
  }

  cells.push(cell.trim());

  return cells;
}



export function parseCSV(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error(
      "Add a header and at least one observation."
    );
  }

  if (lines.length > 10001) {
    throw new Error(
      "Maximum 10,000 observations per file."
    );
  }

  const header = csvCells(lines[0]);

  if (new Set(header).size !== header.length) {
    throw new Error("Duplicate CSV column names.");
  }

  const required = [
    "astronaut_id",
    "timestamp",
    "phase",
    "gravity",
    "task",
    "source",
  ];

  for (const column of required) {
    if (!header.includes(column)) {
      throw new Error("Missing column: " + column);
    }
  }

  const timestampPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  const validPhases = [
    "pre-flight",
    "in-flight",
    "post-flight",
  ];

  const validGravity = [
    "earth",
    "microgravity",
    "lunar",
    "mars",
  ];

  const numericFields = [
    ["hip_angle_deg", 0, 180],
    ["baseline_angle_deg", 0, 180],
    ["heart_rate", 20, 250],
    ["confidence", 0, 1],
  ];

  return lines
    .slice(1)
    .map((line, index) => {
      const rowNumber = index + 2;
      const cells = csvCells(line);

      if (cells.length !== header.length) {
        throw new Error(
          "Column count differs on row " + rowNumber
        );
      }

      const row = Object.fromEntries(
        header.map((column, i) => [
          column,
          cells[i],
        ])
      );

      for (const column of required) {
        if (!row[column]) {
          throw new Error(
            "Missing " +
              column +
              " on row " +
              rowNumber
          );
        }
      }

      
      const knownAstronaut = crew.some(
        (person) => person.id === row.astronaut_id
      );

      if (!knownAstronaut) {
        throw new Error(
          "Unknown astronaut_id on row " +
            rowNumber +
            ". Use SOL-01, SOL-02, or SOL-03."
        );
      }

     
      if (
        !timestampPattern.test(row.timestamp) ||
        !Number.isFinite(Date.parse(row.timestamp))
      ) {
        throw new Error(
          "Use ISO 8601 timestamps with timezone on row " +
            rowNumber
        );
      }

     
      if (!validPhases.includes(row.phase)) {
        throw new Error(
          "Invalid phase on row " + rowNumber
        );
      }

    
      if (!validGravity.includes(row.gravity)) {
        throw new Error(
          "Invalid gravity on row " + rowNumber
        );
      }

      for (const [column, min, max] of numericFields) {
        if (
          row[column] !== undefined &&
          row[column] !== ""
        ) {
          row[column] = Number(row[column]);

          if (
            !Number.isFinite(row[column]) ||
            row[column] < min ||
            row[column] > max
          ) {
            throw new Error(
              "Invalid " +
                column +
                " on row " +
                rowNumber
            );
          }
        } else {
          row[column] = null;
        }
      }

      return row;
    })
    .sort(
      (a, b) =>
        Date.parse(a.timestamp) -
        Date.parse(b.timestamp)
    );
}


export function analyze(
  rows,
  {
    deviation = 20,
    minConfidence = 0.75,
  } = {}
) {
  const usable = rows.filter(
    (row) =>
      Number.isFinite(row.hip_angle_deg) &&
      Number.isFinite(row.confidence) &&
      row.confidence >= minConfidence &&
      Number.isFinite(row.baseline_angle_deg)
  );

  const flagged = usable.filter(
    (row) =>
      Math.abs(
        row.hip_angle_deg -
          row.baseline_angle_deg
      ) > deviation
  );

  const heart = rows.filter((row) =>
    Number.isFinite(row.heart_rate)
  );

  return {
    total: rows.length,

    usable: usable.length,

    flagged: flagged.length,

    flaggedRows: flagged,

    excluded: rows.length - usable.length,

    coverage: rows.length
      ? Math.round(
          (usable.length / rows.length) * 100
        )
      : 0,

    within: usable.length
      ? Math.round(
          ((usable.length - flagged.length) /
            usable.length) *
            100
        )
      : null,

    avgHR: heart.length
      ? Math.round(
          heart.reduce(
            (sum, row) => sum + row.heart_rate,
            0
          ) / heart.length
        )
      : null,

    maxDeviation: usable.length
      ? Math.round(
          Math.max(
            ...usable.map((row) =>
              Math.abs(
                row.hip_angle_deg -
                  row.baseline_angle_deg
              )
            )
          )
        )
      : null,

    avgConfidence: usable.length
      ? Math.round(
          (usable.reduce(
            (sum, row) => sum + row.confidence,
            0
          ) /
            usable.length) *
            100
        )
      : null,
  };
}



export function hipAngle(
  points,
  width = 1,
  height = 1
) {
  const indices =
    points[11]?.visibility >= points[12]?.visibility
      ? [11, 23, 25]
      : [12, 24, 26];

  const selectedPoints = indices.map(
    (index) => points[index]
  );

  const missingOrLowConfidence =
    selectedPoints.some(
      (point) =>
        !point ||
        (point.visibility ?? 0) < 0.6
    );

  if (missingOrLowConfidence) {
    return null;
  }

  const [shoulder, hip, knee] = selectedPoints;

  const a = {
    x: (shoulder.x - hip.x) * width,
    y: (shoulder.y - hip.y) * height,
  };

  const b = {
    x: (knee.x - hip.x) * width,
    y: (knee.y - hip.y) * height,
  };

  const denominator =
    Math.hypot(a.x, a.y) *
    Math.hypot(b.x, b.y);

  if (denominator < 0.00001) {
    return null;
  }

  const cosine =
    (a.x * b.x + a.y * b.y) /
    denominator;

  const clampedCosine = Math.max(
    -1,
    Math.min(1, cosine)
  );

  const angle =
    (Math.acos(clampedCosine) * 180) /
    Math.PI;

  const confidence = Math.min(
    ...selectedPoints.map(
      (point) => point.visibility
    )
  );

  return {
    angle,
    confidence,
  };
}