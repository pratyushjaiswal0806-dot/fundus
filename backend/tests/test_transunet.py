"""
Unit tests for smp.Unet(miT_b2) segmentation pipeline.
"""

import base64
import os

import cv2
import numpy as np
import torch
from models.transunet import SegmentationPipeline

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_mask.png")


def test_vcdr_range():
    """VCDR must be a float between 0.0 and 1.0."""
    pipeline = SegmentationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    masks = pipeline.predict_mask(fake_image)
    vcdr = SegmentationPipeline.compute_vcdr(masks)
    assert isinstance(vcdr, float), f"VCDR should be float, got {type(vcdr)}"
    assert 0.0 <= vcdr <= 1.0, f"VCDR {vcdr} out of range [0.0, 1.0]"


def test_mask_overlay_base64():
    """Mask overlay must start with data:image/png;base64,"""
    pipeline = SegmentationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    masks = pipeline.predict_mask(fake_image)
    b64 = SegmentationPipeline.encode_mask_overlay(fake_image, masks)
    assert b64.startswith("data:image/png;base64,"), "Base64 string has wrong prefix"


def test_full_pipeline():
    """End-to-end: random image -> VCDR + overlay."""
    pipeline = SegmentationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    result = pipeline.run(fake_image)

    assert "vcdr_value" in result
    assert "mask_overlay" in result
    assert isinstance(result["vcdr_value"], float)
    assert 0.0 <= result["vcdr_value"] <= 1.0
    assert result["mask_overlay"].startswith("data:image/png;base64,")


def test_save_mask_overlay():
    """Save overlay to disk for visual inspection."""
    pipeline = SegmentationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    masks = pipeline.predict_mask(fake_image)
    b64 = SegmentationPipeline.encode_mask_overlay(fake_image, masks)

    header, data = b64.split(",", 1)
    img_bytes = base64.b64decode(data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    cv2.imwrite(OUTPUT_DIR, img)
    assert os.path.exists(OUTPUT_DIR), f"Output file not written to {OUTPUT_DIR}"


def test_crop_disc_from_image():
    """Crop returns 224x224 BGR ndarray from a larger image."""
    pipeline = SegmentationPipeline(model_path=None)
    fake_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    masks = pipeline.predict_mask(fake_image)
    crop = SegmentationPipeline.crop_disc_from_image(fake_image, masks)

    assert crop.ndim == 3, f"Crop should be 3D, got {crop.ndim}"
    assert crop.shape == (224, 224, 3), f"Crop shape should be (224,224,3), got {crop.shape}"


def test_crop_fallback_empty_mask():
    """Crop falls back to center-resized image when disc mask is empty."""
    fake_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    empty_masks = torch.zeros(2, 256, 256)
    crop = SegmentationPipeline.crop_disc_from_image(fake_image, empty_masks)

    assert crop.shape == (224, 224, 3), f"Crop shape should be (224,224,3), got {crop.shape}"
