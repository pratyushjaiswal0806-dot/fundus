"""
DenseNet-121 binary classifier with Grad-CAM explanation.
Stage 2 of the Glaucoma Screening ML pipeline.
"""

import base64
import io
import logging
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
from PIL import Image

logger = logging.getLogger(__name__)

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
INPUT_SIZE = (224, 224)


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class DenseNetClassifier(nn.Module):
    """DenseNet-121 with a 1-class sigmoid head for Glaucoma classification."""

    def __init__(self):
        super().__init__()
        self.features = models.densenet121(weights=None).features
        self.classifier = nn.Linear(1024, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.features(x)
        out = F.relu(features)
        out = F.adaptive_avg_pool2d(out, (1, 1))
        out = torch.flatten(out, 1)
        out = self.classifier(out)
        return out


class GradCAM:
    """Grad-CAM explainer for DenseNet-121."""

    def __init__(self, model: DenseNetClassifier, device: torch.device):
        self.model = model
        self.device = device
        self.activations: Optional[torch.Tensor] = None
        self.gradients: Optional[torch.Tensor] = None
        self._forward_handle = None
        self._backward_handle = None

    def _forward_hook(self, module, input, output):
        self.activations = output.detach()

    def _backward_hook(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def _register_hooks(self):
        target_layer = self.model.features.denseblock4
        self._forward_handle = target_layer.register_forward_hook(self._forward_hook)
        self._backward_handle = target_layer.register_full_backward_hook(self._backward_hook)

    def _remove_hooks(self):
        if self._forward_handle is not None:
            self._forward_handle.remove()
            self._forward_handle = None
        if self._backward_handle is not None:
            self._backward_handle.remove()
            self._backward_handle = None

    def generate(self, tensor: torch.Tensor) -> np.ndarray:
        self.model.eval()
        self._register_hooks()

        try:
            with torch.enable_grad():
                logits = self.model(tensor)
                self.model.zero_grad()
                score = logits[0, 0]
                score.backward()

            act = self.activations
            grad = self.gradients

            weights = grad.mean(dim=(2, 3), keepdim=True)
            cam = (weights * act).sum(dim=1, keepdim=True)
            cam = F.relu(cam)

            cam = cam - cam.min()
            if cam.max() > 0:
                cam = cam / cam.max()

            cam = F.interpolate(cam, size=INPUT_SIZE, mode="bilinear", align_corners=False)
            cam = cam.squeeze().cpu().numpy()

            return cam
        finally:
            self._remove_hooks()


def apply_jet_colormap(heatmap: np.ndarray) -> np.ndarray:
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    return cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)


def encode_gradcam_overlay(image: np.ndarray, heatmap: np.ndarray) -> str:
    img = cv2.resize(image, INPUT_SIZE)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    jet_rgb = apply_jet_colormap(heatmap)
    alpha = 0.4
    blended = (rgb * (1 - alpha) + jet_rgb * alpha).astype(np.uint8)

    pil_img = Image.fromarray(blended)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


class ClassificationPipeline:
    def __init__(self, model_path: Optional[str] = None):
        self.device = get_device()
        self.model = DenseNetClassifier().to(self.device)
        self.gradcam = GradCAM(self.model, self.device)
        self.model_loaded = False

        if model_path:
            self.load_weights(model_path)

    def load_weights(self, path: str) -> bool:
        try:
            state_dict = torch.load(path, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state_dict, strict=False)
            self.model.eval()
            self.model_loaded = True
            logger.info("Loaded DenseNet-121 weights from %s onto %s", path, self.device)
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
        img = cv2.resize(image, INPUT_SIZE, interpolation=cv2.INTER_LINEAR)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        mean = np.array(IMAGENET_MEAN, dtype=np.float32)
        std = np.array(IMAGENET_STD, dtype=np.float32)
        img = (img - mean) / std
        img = img.transpose(2, 0, 1)
        return torch.tensor(img, dtype=torch.float32).unsqueeze(0).to(self.device)

    @torch.no_grad()
    def predict(self, image: np.ndarray) -> float:
        tensor = self.preprocess(image)
        logits = self.model(tensor)
        p_glaucoma = torch.sigmoid(logits)[0, 0].item()
        return round(p_glaucoma, 4)

    def generate_gradcam(self, image: np.ndarray) -> str:
        tensor = self.preprocess(image)
        heatmap = self.gradcam.generate(tensor)
        return encode_gradcam_overlay(image, heatmap)

    def run(self, image: np.ndarray) -> dict:
        p_glaucoma = self.predict(image)
        gradcam_b64 = self.generate_gradcam(image)
        return {
            "p_glaucoma": p_glaucoma,
            "gradcam_heatmap": gradcam_b64,
            "device": str(self.device),
        }
