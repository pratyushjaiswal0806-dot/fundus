"""
Unit tests for DenseNet-121 classification pipeline with Grad-CAM.
"""

import base64
import os

import cv2
import numpy as np

from models.densenet import ClassificationPipeline

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_gradcam.png")


def test_p_glaucoma_range():
    """P(Glaucoma) must be a float between 0.0 and 1.0."""
    pipeline = ClassificationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    p_glaucoma = pipeline.predict(fake_image)
    assert isinstance(p_glaucoma, float), f"P(Glaucoma) should be float, got {type(p_glaucoma)}"
    assert 0.0 <= p_glaucoma <= 1.0, f"P(Glaucoma) {p_glaucoma} out of range [0.0, 1.0]"


def test_gradcam_base64():
    """Grad-CAM heatmap must start with data:image/png;base64,"""
    pipeline = ClassificationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    b64 = pipeline.generate_gradcam(fake_image)
    assert b64.startswith("data:image/png;base64,"), "Base64 string has wrong prefix"


def test_full_pipeline():
    """End-to-end: random image -> P(Glaucoma) + Grad-CAM overlay."""
    pipeline = ClassificationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    result = pipeline.run(fake_image)

    assert "p_glaucoma" in result
    assert "gradcam_heatmap" in result
    assert isinstance(result["p_glaucoma"], float)
    assert 0.0 <= result["p_glaucoma"] <= 1.0
    assert result["gradcam_heatmap"].startswith("data:image/png;base64,")


def test_save_gradcam_overlay():
    """Save Grad-CAM overlay to disk for visual inspection."""
    pipeline = ClassificationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    b64 = pipeline.generate_gradcam(fake_image)

    header, data = b64.split(",", 1)
    img_bytes = base64.b64decode(data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    cv2.imwrite(OUTPUT_DIR, img)
    assert os.path.exists(OUTPUT_DIR), f"Output file not written to {OUTPUT_DIR}"
