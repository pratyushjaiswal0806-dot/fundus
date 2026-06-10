"""
smp.Unet(miT_b2)-based optic disc and cup segmentation model.
Stage 1 of the Glaucoma Screening ML pipeline.

Architecture: smp.Unet(encoder_name="mit_b2", classes=2)
Matches the Kaggle pipeline exactly.
"""

import base64
import io
import logging
from typing import Optional

import cv2
import numpy as np
import torch
import segmentation_models_pytorch as smp
from PIL import Image

logger = logging.getLogger(__name__)

MODEL_INPUT_SIZE = (256, 256)
CROP_OUTPUT_SIZE = (224, 224)


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class SegmentationPipeline:
    def __init__(self, model_path: Optional[str] = None):
        self.device = get_device()
        self.model = smp.Unet(
            encoder_name="mit_b2",
            encoder_weights=None,
            in_channels=3,
            classes=2,
        ).to(self.device)
        self.model_loaded = False

        if model_path:
            self.load_weights(model_path)

    def load_weights(self, path: str) -> bool:
        try:
            state_dict = torch.load(path, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state_dict)
            self.model.eval()
            self.model_loaded = True
            logger.info("Loaded smp.Unet(miT_b2) weights from %s onto %s", path, self.device)
            return True
        except FileNotFoundError:
            logger.warning("Weights file not found at %s — running with random weights.", path)
            self.model.eval()
            return False
        except Exception as exc:
            logger.warning("Failed to load weights from %s: %s — running with random weights.", path, exc)
            self.model.eval()
            return False

    def preprocess(self, image: np.ndarray) -> torch.Tensor:
        """Resize to 256x256, convert BGR->RGB, ToTensor only — no ImageNet normalization."""
        img = cv2.resize(image, MODEL_INPUT_SIZE, interpolation=cv2.INTER_LINEAR)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        img = img.transpose(2, 0, 1)
        return torch.tensor(img, dtype=torch.float32).unsqueeze(0).to(self.device)

    @torch.no_grad()
    def predict_mask(self, image: np.ndarray) -> torch.Tensor:
        tensor = self.preprocess(image)
        logits = self.model(tensor)
        probs = torch.sigmoid(logits)
        masks = (probs > 0.5).float().squeeze(0)
        return masks.cpu()

    @staticmethod
    def compute_vcdr(masks: torch.Tensor) -> float:
        disc_mask = masks[0]
        cup_mask = masks[1]

        disc_rows = torch.any(disc_mask, dim=1)
        cup_rows = torch.any(cup_mask, dim=1)
        disc_indices = torch.where(disc_rows)[0]
        cup_indices = torch.where(cup_rows)[0]

        disc_height = (disc_indices[-1] - disc_indices[0]).item() if len(disc_indices) > 0 else 0
        cup_height = (cup_indices[-1] - cup_indices[0]).item() if len(cup_indices) > 0 else 0

        if disc_height == 0:
            return 0.0
        return round(cup_height / disc_height, 4)

    @staticmethod
    def encode_mask_overlay(image: np.ndarray, masks: torch.Tensor) -> str:
        disc_mask = masks[0].numpy().astype(np.uint8)
        cup_mask = masks[1].numpy().astype(np.uint8)

        img = cv2.resize(image, MODEL_INPUT_SIZE)
        overlay = img.copy()

        disc_color = np.array([0, 255, 0], dtype=np.uint8)  # green in BGR
        cup_color = np.array([0, 0, 255], dtype=np.uint8)  # red in BGR
        alpha = 0.4

        disc_bool = disc_mask.astype(bool)
        cup_bool = cup_mask.astype(bool)

        overlay[disc_bool] = (overlay[disc_bool] * (1 - alpha) + disc_color * alpha).astype(np.uint8)
        overlay[cup_bool] = (overlay[cup_bool] * (1 - alpha) + cup_color * alpha).astype(np.uint8)

        overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(overlay_rgb)

        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    @staticmethod
    def crop_disc_from_image(image: np.ndarray, masks: torch.Tensor, padding: float = 0.1) -> np.ndarray:
        """
        Crop the optic disc region from the original high-res image using the predicted mask.

        1. Find bounding box of disc pixels at mask resolution (256x256).
        2. Add fractional padding around the box.
        3. Scale coordinates to original image dimensions.
        4. Crop from original high-res image, resize to 224x224 for DenseNet.
        """
        disc_mask = masks[0].numpy().astype(np.uint8)

        rows = np.any(disc_mask, axis=1)
        cols = np.any(disc_mask, axis=0)

        if not (rows.any() and cols.any()):
            return cv2.resize(image, CROP_OUTPUT_SIZE, interpolation=cv2.INTER_LINEAR)

        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        pad_y = int((rmax - rmin) * padding)
        pad_x = int((cmax - cmin) * padding)

        orig_h, orig_w = image.shape[:2]
        scale_y = orig_h / MODEL_INPUT_SIZE[1]
        scale_x = orig_w / MODEL_INPUT_SIZE[0]

        top = max(0, int((rmin - pad_y) * scale_y))
        bottom = min(orig_h, int((rmax + pad_y) * scale_y))
        left = max(0, int((cmin - pad_x) * scale_x))
        right = min(orig_w, int((cmax + pad_x) * scale_x))

        crop = image[top:bottom, left:right]
        return cv2.resize(crop, CROP_OUTPUT_SIZE, interpolation=cv2.INTER_LINEAR)

    def run(self, image: np.ndarray) -> dict:
        masks = self.predict_mask(image)
        vcdr = self.compute_vcdr(masks)
        mask_b64 = self.encode_mask_overlay(image, masks)
        return {
            "vcdr_value": vcdr,
            "mask_overlay": mask_b64,
            "device": str(self.device),
        }
