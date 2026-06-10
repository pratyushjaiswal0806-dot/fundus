"""
Late fusion ensemble for glaucoma screening.
Stage 3 of the Glaucoma Screening ML pipeline.

Fusion: (vcdr + p_glaucoma) / 2.0
Matches the validated Kaggle pipeline approach.
"""

import logging

logger = logging.getLogger(__name__)

DECISION_THRESHOLD = 0.57


def compute_fusion_score(vcdr: float, p_glaucoma: float) -> float:
    return round((vcdr + p_glaucoma) / 2.0, 4)


def classify(fusion_score: float) -> str:
    if fusion_score >= DECISION_THRESHOLD:
        return "Glaucoma"
    if fusion_score < 0.40:
        return "Healthy"
    return "Glaucoma Suspicion"


def risk_band(fusion_score: float) -> str:
    if fusion_score >= 0.57:
        return "High Risk"
    if fusion_score >= 0.40:
        return "Borderline"
    return "Low Risk"
