import logging
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from models.transunet import SegmentationPipeline
from models.densenet import ClassificationPipeline
from models.fusion import compute_fusion_score, classify, risk_band, DECISION_THRESHOLD

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

seg_pipeline: SegmentationPipeline | None = None
cls_pipeline: ClassificationPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global seg_pipeline, cls_pipeline
    logger.info("Loading TransUNet model...")
    seg_pipeline = SegmentationPipeline(model_path="./weights/transunet_latest.pth")
    logger.info("Loading DenseNet-121 model...")
    cls_pipeline = ClassificationPipeline(model_path="./weights/densenet121_latest.pth")
    yield
    seg_pipeline = None
    cls_pipeline = None
    logger.info("Shutting down.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_hardware_accelerator():
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def decode_image(contents: bytes) -> np.ndarray | None:
    nparr = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "online",
        "hardware_accelerator": get_hardware_accelerator(),
    }


@app.post("/api/v1/analyze")
async def analyze(file: UploadFile):
    if seg_pipeline is None or cls_pipeline is None:
        return {"status": "error", "detail": "Models not loaded."}

    raw_contents = await file.read()

    raw_image = decode_image(raw_contents)
    if raw_image is None:
        return {"status": "error", "detail": "Could not decode fundus image."}

    try:
        t0 = time.perf_counter()

        masks = seg_pipeline.predict_mask(raw_image)
        t_seg = time.perf_counter()

        vcdr = SegmentationPipeline.compute_vcdr(masks)
        mask_b64 = SegmentationPipeline.encode_mask_overlay(raw_image, masks)
        crop = SegmentationPipeline.crop_disc_from_image(raw_image, masks)

        cls_result = cls_pipeline.run(crop)
        t_cls = time.perf_counter()

        p_glaucoma = cls_result["p_glaucoma"]

        fusion_score = compute_fusion_score(vcdr, p_glaucoma)
        diagnosis = classify(fusion_score)
        band = risk_band(fusion_score)
        risk_score = round(fusion_score * 100, 1)

        t_fusion = time.perf_counter()

        logger.info(
            "Inference: seg=%.2fs cls=%.2fs fusion=%.2fs total=%.2fs | vcdr=%.4f p_glau=%.4f fusion=%.4f dx=%s",
            t_seg - t0, t_cls - t_seg, t_fusion - t_cls, t_fusion - t0,
            vcdr, p_glaucoma, fusion_score, diagnosis,
        )

        response = {
            "status": "success",
            "fusion_score": round(fusion_score, 3),
            "risk_score": risk_score,
            "vcdr_value": vcdr,
            "p_glaucoma": p_glaucoma,
            "diagnosis_class": diagnosis,
            "risk_band": band,
            "decision_threshold": DECISION_THRESHOLD,
            "segmentation_mask": mask_b64,
            "gradcam_heatmap": cls_result["gradcam_heatmap"],
        }

        del raw_image, crop, raw_contents
        return response

    except Exception as exc:
        logger.error("Inference failed: %s", exc)
        del raw_image, raw_contents
        return {"status": "error", "detail": str(exc)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
