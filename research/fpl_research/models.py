from __future__ import annotations

from collections.abc import Sequence

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from research.fpl_research import RANDOM_SEED
from research.fpl_research.model_safety import ModelInputManifest, validate_model_input_manifest


MODEL_CONFIGS: dict[str, dict[str, object]] = {
    "ridge": {"alpha": 10.0},
    "random_forest": {"n_estimators": 80, "max_depth": 12, "min_samples_leaf": 5},
    "hist_gradient_boosting": {"max_iter": 100, "learning_rate": 0.06, "max_leaf_nodes": 31, "l2_regularization": 0.2},
    "hist_gradient_boosting_tuned": {
        "max_iter": 150,
        "learning_rate": 0.04,
        "max_leaf_nodes": 15,
        "min_samples_leaf": 30,
        "l2_regularization": 0.5,
    },
}


def build_model(name: str, numeric_columns: Sequence[str], categorical_columns: Sequence[str]) -> Pipeline:
    if name not in MODEL_CONFIGS:
        raise ValueError(f"unsupported model: {name}")
    numeric_steps: list[tuple[str, object]] = [("impute", SimpleImputer(strategy="median", add_indicator=True))]
    if name == "ridge":
        numeric_steps.append(("scale", StandardScaler()))
    preprocessing = ColumnTransformer(
        [
            ("numeric", Pipeline(numeric_steps), list(numeric_columns)),
            (
                "categorical",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="most_frequent")),
                        ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                list(categorical_columns),
            ),
        ],
        remainder="drop",
    )
    config = MODEL_CONFIGS[name]
    if name == "ridge":
        estimator = Ridge(**config)
    elif name == "random_forest":
        estimator = RandomForestRegressor(**config, random_state=RANDOM_SEED, n_jobs=-1)
    else:
        estimator = HistGradientBoostingRegressor(**config, random_state=RANDOM_SEED)
    return Pipeline([("preprocess", preprocessing), ("model", estimator)])


def fit_predict(
    train: pd.DataFrame,
    test: pd.DataFrame,
    model_name: str,
    numeric_columns: Sequence[str],
    categorical_columns: Sequence[str],
    *,
    manifest: ModelInputManifest,
) -> tuple[pd.DataFrame, Pipeline]:
    validate_model_input_manifest(manifest, numeric_columns, categorical_columns)
    if manifest.model != model_name:
        raise ValueError("feature manifest model does not match requested estimator")
    for label, frame in (("training", train), ("evaluation", test)):
        if "task" not in frame or "horizon" not in frame:
            raise ValueError(f"{label} data lacks task/horizon manifest context")
        if not frame["task"].astype(str).eq(manifest.task).all():
            raise ValueError(f"{label} task does not match feature manifest")
        if not pd.to_numeric(frame["horizon"], errors="coerce").eq(manifest.horizon).all():
            raise ValueError(f"{label} horizon does not match feature manifest")
    columns = list(numeric_columns) + list(categorical_columns)
    missing = [column for column in columns if column not in train or column not in test]
    if missing:
        raise ValueError(f"missing model columns: {missing}")
    model = build_model(model_name, numeric_columns, categorical_columns)
    model.fit(train[columns], train["target"])
    predictions = test.copy()
    predictions["prediction"] = model.predict(test[columns])
    return predictions, model
