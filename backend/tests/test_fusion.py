"""
Unit tests for the late fusion ensemble.
Fusion: (vcdr + p_glaucoma) / 2.0
"""

from models.fusion import compute_fusion_score, classify, risk_band, DECISION_THRESHOLD


def test_high_risk_case():
    """vcdr=0.72, p_glaucoma=0.85 → fusion=0.785, Glaucoma, High Risk."""
    score = compute_fusion_score(0.72, 0.85)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0
    assert score == 0.785
    assert score >= DECISION_THRESHOLD
    assert classify(score) == "Glaucoma"
    assert risk_band(score) == "High Risk"


def test_healthy_case():
    """vcdr=0.20, p_glaucoma=0.10 → fusion=0.15, Healthy, Low Risk."""
    score = compute_fusion_score(0.20, 0.10)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0
    assert score == 0.15
    assert score < 0.40
    assert classify(score) == "Healthy"
    assert risk_band(score) == "Low Risk"


def test_borderline_case():
    """vcdr=0.55, p_glaucoma=0.45 → fusion=0.50, Glaucoma Suspicion, Borderline."""
    score = compute_fusion_score(0.55, 0.45)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0
    assert score == 0.50
    assert 0.40 <= score < DECISION_THRESHOLD
    assert classify(score) == "Glaucoma Suspicion"
    assert risk_band(score) == "Borderline"


def test_risk_band_boundaries():
    assert risk_band(0.0) == "Low Risk"
    assert risk_band(0.39) == "Low Risk"
    assert risk_band(0.40) == "Borderline"
    assert risk_band(0.56) == "Borderline"
    assert risk_band(0.57) == "High Risk"
    assert risk_band(1.0) == "High Risk"


def test_classify_boundaries():
    assert classify(0.0) == "Healthy"
    assert classify(0.39) == "Healthy"
    assert classify(0.40) == "Glaucoma Suspicion"
    assert classify(0.56) == "Glaucoma Suspicion"
    assert classify(0.57) == "Glaucoma"
    assert classify(1.0) == "Glaucoma"


def test_decision_threshold_constant():
    assert DECISION_THRESHOLD == 0.57


def test_fusion_is_average():
    """Verify fusion score is exact average of inputs."""
    assert compute_fusion_score(0.0, 0.0) == 0.0
    assert compute_fusion_score(1.0, 1.0) == 1.0
    assert compute_fusion_score(0.3, 0.7) == 0.5
    assert compute_fusion_score(0.1, 0.9) == 0.5
