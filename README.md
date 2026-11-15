# SOL — Astronaut Health Intelligence

A React / Vite research prototype for SOL Team. Built around task-specific movement references, astronaut and ground-team workspaces, and published musculoskeletal research.

## Run

Requires Node.js 20+.

```sh
npm install
npm run dev
```

```sh
npm run check
npm run build
```

## Implemented

- Ground-team overview, three fictional astronaut profiles, adjustable review thresholds, inspectable observations, and JSON reports.
- Simplified astronaut workspace with daily reminders and session completion controls.
- Optional local MediaPipe pose estimation with a MoveNet CPU fallback from webcam/video. A visible 2D shoulder–hip–knee angle is compared with an explicitly calibrated reference, with confidence filtering. No video upload.
- Validated CSV imports; see the downloadable sample inside Data connections. Imported observations replace the selected astronaut's simulated movement data. Missing values remain missing.
- Manual clinical records with measurement method, unit, date, and mission phase; clinician notes and plan review states.
- Source-linked evidence library and transparent template-generated research hypotheses. These are not LLM-derived clinical conclusions or validated ergonomic standards.
- English UI with Arabic navigation and primary headings. Clinical detail and technical descriptions remain English.

## Important boundaries

This is an independent demo, not a NASA integration, clinical device, or decision system. Initial data and identities are fictional. There are no active spacecraft/suit APIs, backend identity/authorization, shared records, or durable medical-data storage. All user-entered records stay in browser memory until refresh; export reports to retain them. Role switching demonstrates different views, not access control. Model and font assets require external network access. Pose estimation is unvalidated in microgravity, suits, and occlusion; it cannot measure spinal curvature, joint loading, bone density, or muscle tissue quality. Calibration is a single-frame prototype reference. Rule deviations do not establish injury, unsafe behavior, or a causal health relationship.

## Next integration layer

Production work requires authorized camera and sensor endpoints, clock synchronization, clinician-approved task/gravity baseline protocols, validated multi-view/IMU fusion, medical record mapping, encrypted storage, audit logs, role-based access, and clinical validation. Human-factors research should build on NASA-STD-3001 rather than claim no spaceflight standards exist.

## Evidence

The application links the four supplied studies, NASA's kinematic sensor evaluation, and NASA-STD-3001 Vol. 2. Research-library summaries do not substitute for full papers.
