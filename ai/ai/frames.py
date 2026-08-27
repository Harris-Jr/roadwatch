"""Samples frames out of an uploaded video at a fixed time interval, so a
multi-minute dashcam clip doesn't mean running the classifier on every single
frame. Adjust FRAME_SAMPLE_INTERVAL_SECONDS in .env to trade off coverage vs.
processing time."""

from collections.abc import Iterator

import cv2
from PIL import Image


def extract_frames(
    video_path: str, interval_seconds: float
) -> Iterator[tuple[Image.Image, float]]:
    """Yields (frame_as_PIL_image, timestamp_seconds) pairs."""
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = max(1, int(round(fps * interval_seconds)))

    frame_index = 0
    while True:
        success, frame_bgr = capture.read()
        if not success:
            break

        if frame_index % frame_interval == 0:
            timestamp = frame_index / fps
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            yield Image.fromarray(frame_rgb), timestamp

        frame_index += 1

    capture.release()
