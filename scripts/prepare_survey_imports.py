#!/usr/bin/env python3
"""Prepare SurveyAnnotate CSV imports from the MA thesis pipeline catalog.

The generated materials CSV matches the admin import format:

topicKey,topicTitle,prompt,promptImageUrl,essayKey,essayTitle,gradeLevel,essayText,methodKey,feedbackText

By default the script creates a study-sized sample with 6 essays per topic
(3 essays for each of the 2 groups assigned to a topic), across the three
selected feedback methods:

- no_issues
- llama_unified_v1
- llama_baseline_v2
"""

from __future__ import annotations

import argparse
import csv
import random
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


DEFAULT_RUNS = {
    "no_issues": "reverse_engineering_student_feedback_no_issues",
    "llama_unified_v1": "reverse_engineering_student_feedback_guided_unified_v1_v3",
    "llama_baseline_v2": "reverse_engineering_student_feedback_baseline_v2_v3",
}

@dataclass(frozen=True)
class Essay:
    essay_id: int
    topic: str
    prompt: str
    text: str
    grade_level: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def default_catalog_path() -> Path:
    return repo_root().parent / "ma_thesis_code" / "results" / "llm_pipeline" / "catalog.sqlite"


def normalize_topic_key(topic: str) -> str:
    return (
        topic.strip()
        .lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace(" ", "-")
    )


def normalize_grade_level(grade_level: str) -> str:
    grade = grade_level.strip().lower()
    if grade.startswith("5"):
        return "5"
    if grade.startswith("9"):
        return "9"
    return grade_level.strip()


def fetch_essays(connection: sqlite3.Connection) -> dict[int, Essay]:
    rows = connection.execute(
        """
        SELECT essay_id, topic, essay_prompt, text, grade_level
        FROM essays
        WHERE topic IS NOT NULL
        ORDER BY essay_id
        """
    ).fetchall()
    return {
        int(row["essay_id"]): Essay(
            essay_id=int(row["essay_id"]),
            topic=row["topic"],
            prompt=row["essay_prompt"],
            text=row["text"],
            grade_level=row["grade_level"],
        )
        for row in rows
    }


def fetch_feedbacks(connection: sqlite3.Connection, selected_runs: dict[str, str]) -> dict[str, dict[int, str]]:
    """Return method_key -> essay_id -> feedback text.

    Some selected runs, especially guided unified runs, contain multiple
    reverse-engineered feedback snippets per essay. SurveyAnnotate needs one
    feedback text per method and essay, so snippets are concatenated in
    source_index order with numbered sections.
    """

    placeholders = ",".join("?" for _ in selected_runs)
    config_to_method = {config_name: method_key for method_key, config_name in selected_runs.items()}
    grouped: dict[str, dict[int, list[tuple[int, str, str]]]] = defaultdict(lambda: defaultdict(list))
    rows = connection.execute(
        f"""
        SELECT config_name, essay_id, source_index, source_rewriting_dimension, extracted_feedback
        FROM vw_essay_reverse_engineering_results
        WHERE config_name IN ({placeholders})
        ORDER BY config_name, essay_id, source_index
        """,
        tuple(selected_runs.values()),
    ).fetchall()

    for row in rows:
        method_key = config_to_method[row["config_name"]]
        dimension = row["source_rewriting_dimension"] or ""
        grouped[method_key][int(row["essay_id"])].append(
            (int(row["source_index"]), dimension, row["extracted_feedback"].strip())
        )

    feedbacks: dict[str, dict[int, str]] = {}
    for method_key, by_essay in grouped.items():
        feedbacks[method_key] = {}
        for essay_id, snippets in by_essay.items():
            clean_snippets = [snippet for snippet in snippets if snippet[2]]
            if len(clean_snippets) == 1:
                feedbacks[method_key][essay_id] = clean_snippets[0][2]
                continue
            parts = []
            for item_index, (_, dimension, text) in enumerate(clean_snippets, start=1):
                heading = f"Hinweis {item_index}"
                if dimension:
                    heading = f"{heading} ({dimension})"
                parts.append(f"{heading}:\n{text}")
            feedbacks[method_key][essay_id] = "\n\n".join(parts)
    return feedbacks


def select_balanced_essays(
    essays: dict[int, Essay],
    feedbacks: dict[str, dict[int, str]],
    essays_per_topic: int,
    seed: int,
) -> list[Essay]:
    if essays_per_topic <= 0 or essays_per_topic % 2 != 0:
        raise ValueError("--essays-per-topic must be a positive even number.")

    rng = random.Random(seed)
    by_topic: dict[str, list[Essay]] = defaultdict(list)
    for essay in essays.values():
        if all(essay.essay_id in method_feedbacks for method_feedbacks in feedbacks.values()):
            by_topic[essay.topic].append(essay)

    if len(by_topic) != 3:
        raise ValueError(f"Expected exactly 3 topics, found {len(by_topic)}: {sorted(by_topic)}")

    selected: list[Essay] = []
    for topic in sorted(by_topic):
        candidates = sorted(by_topic[topic], key=lambda essay: essay.essay_id)
        if len(candidates) < essays_per_topic:
            raise ValueError(f"Topic {topic} has only {len(candidates)} eligible essays.")
        rng.shuffle(candidates)
        selected.extend(sorted(candidates[:essays_per_topic], key=lambda essay: essay.essay_id))
    return selected


def write_materials(path: Path, selected_essays: list[Essay], feedbacks: dict[str, dict[int, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "topicKey",
                "topicTitle",
                "prompt",
                "promptImageUrl",
                "essayKey",
                "essayTitle",
                "gradeLevel",
                "essayText",
                "methodKey",
                "feedbackText",
            ],
        )
        writer.writeheader()
        for essay in selected_essays:
            for method_key in DEFAULT_RUNS:
                writer.writerow(
                    {
                        "topicKey": normalize_topic_key(essay.topic),
                        "topicTitle": essay.topic,
                        "prompt": essay.prompt,
                        "promptImageUrl": "",
                        "essayKey": str(essay.essay_id),
                        "essayTitle": f"Essay {essay.essay_id}",
                        "gradeLevel": normalize_grade_level(essay.grade_level),
                        "essayText": essay.text,
                        "methodKey": method_key,
                        "feedbackText": feedbacks[method_key][essay.essay_id],
                    }
                )


def write_participants_template(path: Path, groups: int, participants_per_group: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["groupKey", "firstName"])
        writer.writeheader()
        for group_index in range(groups):
            group_key = chr(ord("A") + group_index)
            for participant_index in range(participants_per_group):
                writer.writerow(
                    {
                        "groupKey": group_key,
                        "firstName": f"Name_{group_key}_{participant_index + 1}",
                    }
                )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=default_catalog_path())
    parser.add_argument("--out-dir", type=Path, default=repo_root() / "sample_data")
    parser.add_argument(
        "--essays-per-topic",
        type=int,
        default=6,
        help="Must be even. 6 gives 3 essays per group for 2 groups per topic.",
    )
    parser.add_argument("--participants-per-group", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.catalog.exists():
        raise FileNotFoundError(f"Catalog not found: {args.catalog}")

    connection = sqlite3.connect(args.catalog)
    connection.row_factory = sqlite3.Row
    essays = fetch_essays(connection)
    feedbacks = fetch_feedbacks(connection, DEFAULT_RUNS)
    selected_essays = select_balanced_essays(essays, feedbacks, args.essays_per_topic, args.seed)

    materials_path = args.out_dir / "materials_sample.csv"
    participants_path = args.out_dir / "participants_template.csv"
    write_materials(materials_path, selected_essays, feedbacks)
    write_participants_template(participants_path, groups=6, participants_per_group=args.participants_per_group)

    print(f"Wrote {materials_path}")
    print(f"Wrote {participants_path}")
    print(
        f"Selected {len(selected_essays)} essays total: "
        f"{args.essays_per_topic} per topic, {args.essays_per_topic // 2} per topic-group."
    )
    print("Feedback methods:")
    for method_key, config_name in DEFAULT_RUNS.items():
      print(f"- {method_key}: {config_name}")


if __name__ == "__main__":
    main()
