"""
Wraps the trained pothole classifier.

Preprocessing here is ported EXACTLY from the original Binry_Classifier/app.py
prototype: resize to (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), convert to array,
add a batch dimension, normalize by /255.0. If this drifts from how the model
was trained, predictions will be wrong in ways that are hard to debug — don't
"improve" this preprocessing without retraining, keep it matched to training.

The model is a single-sigmoid binary classifier (pothole / no pothole). There
is no separate severity model. Severity is derived from the confidence score
using the same three thresholds shown on the admin Settings page (minor 60%,
moderate 75%, severe 85% by default) — that page IS this logic's config.
"""

import logging
import os
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# The ai package is standalone — it doesn't import anything from backend/,
# so it reads its own environment variable directly rather than sharing
# backend's config module. The default path is resolved relative to this
# file (not the process's working directory), so it finds the model
# correctly whether it's run from Docker, from backend/, or from the repo
# root. Set MODEL_PATH in .env only if you want to override this location.
_DEFAULT_MODEL_PATH = str(Path(__file__).parent / "model" / "cct_modelcnn.h5")
MODEL_PATH = os.environ.get("MODEL_PATH") or _DEFAULT_MODEL_PATH
MODEL_INPUT_SIZE = int(os.environ.get("MODEL_INPUT_SIZE", "224"))


@dataclass
class ClassificationResult:
    is_pothole: bool
    confidence: float  # 0.0 - 1.0
    severity: str | None  # None if not a pothole / below minor_threshold


class PotholeClassifier:
    def __init__(self):
        self._model = None
        self._load_attempted = False

    def _load(self):
        self._load_attempted = True
        try:
            from tensorflow.keras.models import load_model

            self._model = load_model(MODEL_PATH)
            logger.info("Loaded pothole classifier from %s", MODEL_PATH)
        except (OSError, ImportError) as exc:
            logger.warning(
                "Could not load model at %s (%s). Falling back to a mock "
                "classifier so the API still runs — drop your trained .h5 "
                "file at that path and restart to use the real model.",
                MODEL_PATH,
                exc,
            )
            self._model = None

    def _predict_raw(self, image: Image.Image) -> float:
        """Returns a raw sigmoid confidence in [0, 1] that the image contains
        a pothole. Falls back to a mock score if no model is loaded, so the
        rest of the pipeline (routes, DB writes, frontend wiring) can be
        tested end-to-end before the real model file is in place."""
        if not self._load_attempted:
            self._load()

        size = MODEL_INPUT_SIZE

        if self._model is None:
            # Deterministic-ish mock so repeated calls on the same image
            # don't jump around wildly during manual testing.
            random.seed(hash(image.tobytes()[:1000]))
            return random.uniform(0.3, 0.97)

        img = image.convert("RGB").resize((size, size))
        img_array = np.array(img, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = img_array / 255.0

        prediction = self._model.predict(img_array, verbose=0)
        return float(prediction[0][0])

    def classify(
        self,
        image: Image.Image,
        minor_threshold: float,
        moderate_threshold: float,
        severe_threshold: float,
    ) -> ClassificationResult:
        raw = self._predict_raw(image)
        is_pothole = raw > 0.5

        if not is_pothole:
            return ClassificationResult(
                is_pothole=False, confidence=1 - raw, severity=None
            )

        if raw >= severe_threshold:
            severity = "severe"
        elif raw >= moderate_threshold:
            severity = "moderate"
        elif raw >= minor_threshold:
            severity = "minor"
        else:
            # Detected a pothole-like feature but below the confidence floor
            # for auto-publish — treat as not confident enough to report.
            return ClassificationResult(
                is_pothole=False, confidence=raw, severity=None
            )

        return ClassificationResult(is_pothole=True, confidence=raw, severity=severity)


# Singleton so the model is only loaded once per process.
classifier = PotholeClassifier()
