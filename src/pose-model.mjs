
export async function createLocalPoseModel() {

  const probe = document.createElement("canvas");

  const gl =
    probe.getContext("webgl2") ||
    probe.getContext("webgl");


  if (gl) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    try {
      const {
        FilesetResolver,
        PoseLandmarker,
      } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );

      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

          delegate: "CPU",
        },

        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    } catch {
      
    }
  }

  const tf = await import("@tensorflow/tfjs");

  await tf.setBackend("cpu");
  await tf.ready();

  const detection = await import(
    "@tensorflow-models/pose-detection"
  );

  const detector = await detection.createDetector(
    detection.SupportedModels.MoveNet,
    {
      modelType:
        detection.movenet.modelType.SINGLEPOSE_LIGHTNING,

      enableSmoothing: true,
    }
  );

  
  const map = [
    [0, 0],
    [5, 11],
    [6, 12],
    [7, 13],
    [8, 14],
    [9, 15],
    [10, 16],
    [11, 23],
    [12, 24],
    [13, 25],
    [14, 26],
    [15, 27],
    [16, 28],
  ];

  
  return {
    async detectForVideo(video, timestamp) {
      const poses = await detector.estimatePoses(
        video,
        {
          flipHorizontal: false,
        },
        timestamp
      );

      if (!poses[0]) {
        return {
          landmarks: [],
        };
      }

      const points = Array.from(
        { length: 33 },
        () => ({
          x: 0,
          y: 0,
          visibility: 0,
        })
      );

      for (const [from, to] of map) {
        const p = poses[0].keypoints[from];

        points[to] = {
          x: p.x / video.videoWidth,
          y: p.y / video.videoHeight,
          visibility: p.score ?? 0,
        };
      }

      return {
        landmarks: [points],
      };
    },

    close() {
      detector.dispose();
    },
  };
}