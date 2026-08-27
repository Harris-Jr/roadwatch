# Model file goes here

Drop your trained classifier at `ai/model/cct_modelcnn.h5` (or update
`MODEL_PATH` in the repo's `.env` to point wherever you'd rather keep it).

Expected contract, matched exactly to your original prototype
(`Binry_Classifier/app.py`) — don't change this without retraining:

- Input: RGB image, resized to 224x224
- Normalization: pixel values divided by 255.0
- Output: single sigmoid unit — a value above 0.5 means "pothole"

If no model file is found at `MODEL_PATH`, `ai/inference.py` logs a warning
and falls back to a mock classifier so the rest of the API still runs
end-to-end (routes, database writes, frontend wiring) while you're setting
things up. Check your server logs for that warning if predictions look
random — it means the file isn't being found at the path you expect.
