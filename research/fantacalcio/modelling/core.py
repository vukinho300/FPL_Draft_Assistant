"""Pure event-only predictors; targets and current snapshots use separate paths."""
import numpy as np
from ..pipeline.integrity import EVENT_WINDOW_FIELDS, IntegrityError, classify_event_window_field

FIELDS = ('PV', 'goals', 'assists', 'yellow_cards', 'red_cards', 'goals_conceded',
          'penalties_taken', 'penalties_scored', 'penalties_missed', 'penalties_saved', 'own_goals')
# Documented league baseline, not a reconstruction of exact source FM.
# Goals already include scored penalties; do not add penalties_scored again.
BONUS = np.array([0, 3, 1, -.5, -1, -1, 0, 0, -3, 3, 0], dtype=float)


def event_features(row):
    """Positive allowlist; raw MV/FM/role/club cannot become covariates."""
    result = {field: row.get(field) for field in FIELDS}
    if set(result) != EVENT_WINDOW_FIELDS or any(v is None or not np.isfinite(v) or v < 0 for v in result.values()):
        raise IntegrityError('Missing/invalid certified event input')
    return result


def vector(features):
    if set(features) != EVENT_WINDOW_FIELDS:
        raise IntegrityError('Feature whitelist violation')
    pv = features['PV']
    return [pv] + [features[field] / max(pv, 1) for field in FIELDS[1:]]


def samples(rows, target_seasons):
    lookup = {(r['playerRef'], r['season']): r for r in rows}
    if len(lookup) != len(rows):
        raise IntegrityError('Duplicate player-season input')
    result = []
    for target in rows:
        if target['season'] not in target_seasons:
            continue
        year = int(target['season'][:4])
        prior_season = f'{year-1}/{str(year)[-2:]}'
        prior = lookup.get((target['playerRef'], prior_season))
        if prior is None:
            continue
        features = event_features(prior)
        for field in features:
            classification = classify_event_window_field(field,
                source_season=prior_season, target_season=target['season'],
                cutoff=f'{year}-06-30T23:59:59+00:00',
                target_start=f'{year}-07-01T00:00:00+00:00',
                event_window_end_exclusive=f'{year}-07-01T00:00:00+00:00',
                source_available_by=prior['observed_at'], source_semantics=prior['statistics_scope'])
            if classification != 'BACKTEST_SAFE_EVENT_WINDOW':
                raise IntegrityError('Temporal certificate failed')
        if target['PV'] > 0 and target['FM'] is None:
            raise IntegrityError('Rated target lacks source FM')
        result.append({'key': target['playerRef'] + ':' + target['season'],
            'target_season': target['season'], 'feature_season': prior_season,
            'features': features, 'target_PV': target['PV'], 'target_FM': target['FM']})
    return sorted(result, key=lambda r: r['key'])


def arrays(records):
    return (np.asarray([vector(r['features']) for r in records], dtype=float),
            np.asarray([r['target_PV'] for r in records], dtype=float),
            np.asarray([np.nan if r['target_FM'] is None else r['target_FM'] for r in records], dtype=float))


def linear_fit(x, y, alpha, weights=None):
    weights = np.ones(len(y)) if weights is None else np.asarray(weights, dtype=float)
    weights = weights / weights.mean()
    mean = np.average(x, axis=0, weights=weights)
    scale = np.sqrt(np.average((x-mean)**2, axis=0, weights=weights))
    scale[scale < 1e-10] = 1
    y_mean = float(np.average(y, weights=weights))
    z = (x-mean)/scale
    coef = np.linalg.solve(z.T @ (z*weights[:, None]) + alpha*np.eye(x.shape[1]),
                           z.T @ ((y-y_mean)*weights))
    return {'mean': mean.tolist(), 'scale': scale.tolist(), 'coef': coef.tolist(), 'intercept': y_mean}


def linear_predict(state, x):
    return ((x-np.array(state['mean']))/np.array(state['scale'])) @ np.array(state['coef']) + state['intercept']


def fit(config, x, pv, fm):
    rated = (pv > 0) & np.isfinite(fm)
    if not rated.any():
        raise IntegrityError('No rated training targets')
    model = {'config': dict(config), 'mean_target_PV': float(pv.mean()),
        'mean_target_FM': float(np.average(fm[rated], weights=pv[rated])),
        'fm_bounds': [float(fm[rated].min()), float(fm[rated].max())]}
    if config['kind'] == 'ridge':
        model['availability'] = linear_fit(x, pv, config['alpha'])
        model['production'] = linear_fit(x[rated], fm[rated], config['alpha'], pv[rated])
    else:
        variance = float(np.var(x[:, 0]))
        slope = float(np.mean((x[:, 0]-x[:, 0].mean())*(pv-pv.mean()))/variance) if variance else 0
        slope = float(np.clip(slope, 0, 1))
        model['pv_slope'] = 1.0 if config['kind'] == 'naive' else slope
        model['pv_intercept'] = 0.0 if config['kind'] == 'naive' else float(pv.mean()-slope*x[:, 0].mean())
        net = x @ BONUS
        model['net_population_rate'] = float(np.average(net, weights=np.maximum(x[:, 0], 1)))
        k = config['k']
        shrunk = (net*x[:, 0]+k*model['net_population_rate'])/np.maximum(x[:, 0]+k, 1)
        model['fm_intercept'] = float(np.average(fm[rated]-shrunk[rated], weights=pv[rated]))
    return model


def predict(model, x):
    cfg = model['config']
    if cfg['kind'] == 'ridge':
        pv = linear_predict(model['availability'], x)
        fm = linear_predict(model['production'], x)
    else:
        pv = model['pv_intercept'] + model['pv_slope']*x[:, 0]
        k = cfg['k']
        net = x @ BONUS
        fm = model['fm_intercept'] + (net*x[:, 0]+k*model['net_population_rate'])/np.maximum(x[:, 0]+k, 1)
    return np.clip(pv, 0, 38), np.clip(fm, *model['fm_bounds'])


def ranks(values):
    order = np.argsort(values, kind='stable')
    result = np.empty(len(values), dtype=float)
    i = 0
    while i < len(order):
        j = i+1
        while j < len(order) and values[order[j]] == values[order[i]]:
            j += 1
        result[order[i:j]] = (i+j-1)/2
        i = j
    return result


def metrics(pv, fm, prediction):
    ppv, pfm = prediction
    actual = pv*np.nan_to_num(fm, nan=0)
    predicted = ppv*pfm
    rated = (pv > 0) & np.isfinite(fm)
    a, b = ranks(actual), ranks(predicted)
    rho = float(np.corrcoef(a, b)[0, 1]) if np.std(a) and np.std(b) else 0.0
    top = min(50, len(pv))
    return {'n':len(pv), 'rated_n':int(rated.sum()),
        'total_proxy_mae':float(np.mean(np.abs(actual-predicted))),
        'total_proxy_rmse':float(np.sqrt(np.mean((actual-predicted)**2))),
        'PV_mae':float(np.mean(np.abs(pv-ppv))),
        'FM_weighted_mae':float(np.average(np.abs(fm[rated]-pfm[rated]), weights=pv[rated])),
        'spearman':rho,
        'top50_recall':len(set(np.argsort(actual)[-top:]) & set(np.argsort(predicted)[-top:]))/top}


def current_update(prior_pv, prior_fm, current, elapsed, availability_strength, production_strength):
    """Current-only path, never used to generate historical feature matrices."""
    pv = current['PV']
    if not 0 < elapsed <= 38 or not 0 <= pv <= elapsed or min(availability_strength, production_strength) <= 0:
        raise IntegrityError('Invalid current exposure/shrinkage')
    if pv > 0 and current.get('FM') is None:
        raise IntegrityError('Current rated appearances lack FM')
    p = (availability_strength*prior_pv/38 + pv)/(availability_strength+elapsed)
    fm = prior_fm if pv == 0 else (production_strength*prior_fm+pv*current['FM'])/(production_strength+pv)
    if not np.isfinite(fm):
        raise IntegrityError('Invalid current FM')
    return {'expected_remaining_PV':float((38-elapsed)*p), 'rated_appearance_probability':float(p),
        'expected_FM':float(fm), 'availability_current_weight':elapsed/(availability_strength+elapsed),
        'production_current_weight':pv/(production_strength+pv)}
