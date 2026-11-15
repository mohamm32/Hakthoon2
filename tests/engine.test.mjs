import { test } from "node:test";
import assert from "node:assert/strict";

import {
  analyze,
  demoRecords,
  parseCSV,
  toCSV,
  hipAngle,
} from "../src/engine.mjs";


test("round trip retains observations and numeric values", () => {
  const records = demoRecords();

  const exportedCSV = toCSV(records);
  const importedRecords = parseCSV(exportedCSV);

  assert.deepEqual(importedRecords, records);
});


test(
  "missing measurements do not become zero or contribute to clinical conclusions",
  () => {
    const row = demoRecords()[0];

    row.hip_angle_deg = null;
    row.heart_rate = null;

    const importedRecords = parseCSV(toCSV([row]));
    const result = analyze(importedRecords);

    assert.equal(result.usable, 0);
    assert.equal(result.avgHR, null);
    assert.equal(result.within, null);
  }
);


test(
  "missing reference or low confidence excludes motion comparison",
  () => {
    const records = demoRecords().slice(0, 3);

    records[0].confidence = 0.4;
    records[1].baseline_angle_deg = null;
    records[2].hip_angle_deg = null;

    const result = analyze(records);

    assert.equal(result.usable, 0);
  }
);


test(
  "review flags respond to threshold and do not equal all observations",
  () => {
    const records = demoRecords();

    const defaultResult = analyze(records);

    const higherThresholdResult = analyze(records, {
      deviation: 45,
    });

    assert.equal(defaultResult.flagged, 7);
    assert.equal(higherThresholdResult.flagged, 0);
    assert.equal(defaultResult.excluded, 1);
  }
);


test(
  "invalid units/ranges and unknown identities are rejected",
  () => {
    const invalidValues = [
      ["confidence", 95],
      ["hip_angle_deg", 181],
      ["heart_rate", -1],
      ["astronaut_id", "unknown"],
    ];

    for (const [field, value] of invalidValues) {
      const records = demoRecords().slice(0, 1);

      records[0][field] = value;

      assert.throws(() => {
        parseCSV(toCSV(records));
      });
    }
  }
);


test("ambiguous timestamps are rejected", () => {
  const records = demoRecords().slice(0, 1);

  records[0].timestamp = "2026-11-14 08:00";

  assert.throws(
    () => parseCSV(toCSV(records)),
    /timezone/
  );
});

=

test("quoted source labels can contain comma and quotes", () => {
  const records = demoRecords().slice(0, 1);

  records[0].source = 'camera, "A"';

  const importedRecords = parseCSV(toCSV(records));

  assert.equal(
    importedRecords[0].source,
    records[0].source
  );
});



test("rule comparisons use supplied individual references", () => {
  const records = demoRecords().slice(0, 1);

  records[0].hip_angle_deg = 100;
  records[0].baseline_angle_deg = 105;

  assert.equal(analyze(records).flagged, 0);

  records[0].baseline_angle_deg = 155;

  assert.equal(analyze(records).flagged, 1);
});


test(
  "2D angle handles aspect ratio and rejects occluded landmarks",
  () => {
    const points = Array.from(
      { length: 33 },
      () => ({
        x: 0,
        y: 0,
        visibility: 1,
      })
    );

    points[11] = {
      x: 0,
      y: 0,
      visibility: 1,
    };

    points[23] = {
      x: 0,
      y: 1,
      visibility: 1,
    };

    points[25] = {
      x: 1,
      y: 1,
      visibility: 1,
    };

    const measurement = hipAngle(points, 16, 9);

    assert.equal(measurement.angle, 90);

    points[23].visibility = 0.2;

    assert.equal(hipAngle(points), null);
  }
);