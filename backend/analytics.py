
from collections import Counter
from datetime import datetime, timezone
from io import StringIO
import csv

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ContentCheckResult, ContentReview
from security import require_roles


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[
        Depends(require_roles("manager", "admin"))
    ],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# RISK SCORE HELPERS
# --------------------------------------------------

def calculate_risk_score(compliance_score):
    return max(0, min(100, 100 - int(compliance_score)))


def get_risk_level(risk_score):
    if risk_score < 25:
        return "Low"
    elif risk_score < 50:
        return "Moderate"
    elif risk_score < 75:
        return "High"
    return "Critical"


def count_severities(records):
    counts = {
        "high": 0,
        "medium": 0,
        "low": 0,
    }

    for flags in records:
        for flag in flags or []:
            severity = str(
                flag.get("severity", "")
            ).lower()

            if severity in counts:
                counts[severity] += 1

    return counts


# --------------------------------------------------
# ANALYTICS SUMMARY
# --------------------------------------------------

@router.get("/summary")
def analytics_summary(db: Session = Depends(get_db)):

    total_checks = db.scalar(
        select(func.count(ContentCheckResult.id))
    ) or 0

    average_score = db.scalar(
        select(
            func.avg(ContentCheckResult.compliance_score)
        )
    )

    average_compliance = (
        round(float(average_score), 2)
        if average_score is not None
        else None
    )

    average_risk = (
        round(100 - average_compliance, 2)
        if average_compliance is not None
        else None
    )

    risk_level = (
        get_risk_level(average_risk)
        if average_risk is not None
        else "Not available"
    )

    ai_checks = db.scalar(
        select(func.count(ContentCheckResult.id))
        .where(ContentCheckResult.ai_enabled.is_(True))
    ) or 0

    flag_records = db.scalars(
        select(ContentCheckResult.flags)
    ).all()

    severity_counts = count_severities(flag_records)

    # REVIEW STATISTICS

    review_counts = {
        "pending": 0,
        "approved": 0,
        "changes_requested": 0,
        "rejected": 0,
    }

    review_rows = db.execute(
        select(
            ContentReview.status,
            func.count(ContentReview.id),
        ).group_by(ContentReview.status)
    ).all()

    for status, count in review_rows:
        if status in review_counts:
            review_counts[status] = count

    approved = review_counts["approved"]
    rejected = review_counts["rejected"]
    changes_requested = review_counts["changes_requested"]

    processed_reviews = (
        approved + rejected + changes_requested
    )

    approval_rate = (
        round((approved / processed_reviews) * 100, 2)
        if processed_reviews else 0.0
    )

    rejection_rate = (
        round((rejected / processed_reviews) * 100, 2)
        if processed_reviews else 0.0
    )

    return {
        "total_checks": total_checks,

        "average_compliance_score": average_compliance,

        "average_risk_score": average_risk,

        "risk_level": risk_level,

        "high_severity_flags": severity_counts["high"],
        "medium_severity_flags": severity_counts["medium"],
        "low_severity_flags": severity_counts["low"],

        "ai_enabled_checks": ai_checks,

        "total_reviews": sum(review_counts.values()),
        "processed_reviews": processed_reviews,

        "approval_rate": approval_rate,
        "rejection_rate": rejection_rate,

        "changes_requested": changes_requested,

        "reviews": review_counts,
    }


# --------------------------------------------------
# MONTHLY COMPLIANCE AND RISK TRENDS
# --------------------------------------------------

@router.get("/trends")
def analytics_trends(db: Session = Depends(get_db)):

    month = func.date_trunc(
        "month",
        ContentCheckResult.created_at,
    )

    rows = db.execute(
        select(
            month.label("month"),
            func.count(ContentCheckResult.id).label("checks"),
            func.avg(
                ContentCheckResult.compliance_score
            ).label("average_score"),
        )
        .group_by(month)
        .order_by(month.asc())
    ).all()

    results = []

    for row in rows:
        average_score = round(
            float(row.average_score), 2
        )

        risk_score = round(
            100 - average_score, 2
        )

        results.append({
            "month": row.month.strftime("%Y-%m"),
            "checks": row.checks,
            "average_score": average_score,
            "average_risk_score": risk_score,
            "risk_level": get_risk_level(risk_score),
        })

    return results


# --------------------------------------------------
# COMMON BRAND VIOLATIONS
# --------------------------------------------------

@router.get("/violations")
def analytics_violations(db: Session = Depends(get_db)):

    records = db.scalars(
        select(ContentCheckResult.flags)
    ).all()

    violation_counts = Counter()

    for flags in records:
        for flag in flags or []:
            issue_type = str(
                flag.get("issue_type", "unknown")
            ).strip().lower()

            violation_counts[issue_type] += 1

    return [
        {
            "issue_type": issue_type,
            "count": count,
        }
        for issue_type, count
        in violation_counts.most_common(10)
    ]


# --------------------------------------------------
# DOWNLOADABLE CSV REPORT
# --------------------------------------------------

@router.get("/report.csv")
def download_analytics_report(
    db: Session = Depends(get_db),
):

    records = db.scalars(
        select(ContentCheckResult)
        .order_by(ContentCheckResult.created_at.desc())
    ).all()

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Check ID",
        "User ID",
        "Compliance Score",
        "Risk Score",
        "Risk Level",
        "Total Flags",
        "High Severity",
        "Medium Severity",
        "Low Severity",
        "AI Enabled",
        "Checked At",
    ])

    for record in records:

        flags = record.flags or []

        severities = count_severities([flags])

        risk_score = calculate_risk_score(
            record.compliance_score
        )

        risk_level = get_risk_level(risk_score)

        writer.writerow([
            record.id,
            record.checked_by,
            record.compliance_score,
            risk_score,
            risk_level,
            record.total_flags,
            severities["high"],
            severities["medium"],
            severities["low"],
            record.ai_enabled,
            record.created_at.isoformat()
            if record.created_at else "",
        ])

    output.seek(0)

    filename = (
        "inkloom_brandguard_analytics_"
        + datetime.now(timezone.utc).strftime("%Y%m%d")
        + ".csv"
    )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )
