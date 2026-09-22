"""Strict, deterministic checks shared by adapters and the release gate."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
import unicodedata

ROLES = {'P': 'POR', 'D': 'DIF', 'C': 'CEN', 'A': 'ATT'}
WEIGHTS = {'provenance': 10, 'schema': 10, 'identity': 20, 'coverage': 20,
           'consistency': 15, 'temporal': 25}
DENYLIST = {'future_fantavoto', 'future_fm', 'future_goals', 'future_assists',
            'future_fvm', 'future_final_ranking', 'post_target_aggregate',
            'target_fm', 'target_pv', 'target_goals', 'target_assists',
            'future_transfer', 'future_injury', 'future_league_position'}
EVENT_WINDOW_FIELDS = frozenset({'PV', 'goals', 'goals_conceded', 'assists',
    'yellow_cards', 'red_cards', 'penalties_saved', 'penalties_taken',
    'penalties_scored', 'penalties_missed', 'own_goals'})
SNAPSHOT_FIELDS = frozenset({'fvm', 'quotation', 'initialquotation', 'club',
    'role', 'eligibility', 'injury', 'availability', 'starter_evidence', 'set_piece_role'})


class IntegrityError(ValueError):
    pass


def normalize_name(value):
    text = unicodedata.normalize('NFKD', str(value)).casefold()
    return ' '.join(re.sub(r'[^\w\s]', ' ', ''.join(c for c in text if not unicodedata.combining(c))).split())


def number(value, *, integer=False, nonnegative=True):
    """Only explicit blank markers are missing. Invalid/nonfinite text raises."""
    if value is None or (isinstance(value, str) and value.strip() in {'', '-', '—', 'N/A'}):
        return None
    if isinstance(value, bool):
        raise IntegrityError('Boolean is not a number')
    text = str(value).strip().replace('\u00a0', '')
    # Decimal comma only; thousands separators must be handled by the source adapter.
    if ',' in text and '.' in text:
        raise IntegrityError(f'Ambiguous numeric punctuation: {value!r}')
    try:
        result = Decimal(text.replace(',', '.'))
    except InvalidOperation as error:
        raise IntegrityError(f'Invalid numeric token: {value!r}') from error
    if not result.is_finite() or (nonnegative and result < 0):
        raise IntegrityError(f'Invalid numeric value: {value!r}')
    if integer and result != result.to_integral_value():
        raise IntegrityError(f'Noninteger count: {value!r}')
    return int(result) if integer else float(result)


def source_id(value):
    result = number(value, integer=True)
    if result is None or result <= 0:
        raise IntegrityError('Missing/nonpositive source ID')
    return str(result)


def canonical_id(value):
    return 'fantacalcio:fc:' + source_id(value)


def role(value):
    try:
        return ROLES[str(value).strip().upper()]
    except KeyError as error:
        raise IntegrityError(f'Unknown Classic role {value!r}') from error


def season(value):
    if not re.fullmatch(r'20\d{2}/\d{2}', str(value)):
        raise IntegrityError(f'Invalid season {value!r}')
    if int(value[-2:]) != (int(value[:4]) + 1) % 100:
        raise IntegrityError(f'Nonconsecutive season {value!r}')
    return value


def duplicates(rows, keys):
    groups = defaultdict(list)
    for index, row in enumerate(rows):
        groups[tuple(row.get(k) for k in keys)].append(index)
    return [{'key': list(key), 'count': len(indices), 'affected_rows': indices,
             'cause': 'REQUIRES_CLASSIFICATION', 'resolution': 'UNRESOLVED'}
            for key, indices in sorted(groups.items(), key=lambda x: str(x[0])) if len(indices) > 1]


def unique(rows, keys):
    problems = duplicates(rows, keys)
    if problems:
        raise IntegrityError(f'Duplicate keys {keys}: {problems[:3]}')


def left_join(left, right, keys, *, name):
    """Many-to-one is explicit; duplicate right keys always fail, even identical rows."""
    unique(right, keys)
    lookup = {tuple(r[k] for k in keys): r for r in right}
    pairs = [(row, lookup.get(tuple(row[k] for k in keys))) for row in left]
    if len(pairs) != len(left):
        raise IntegrityError('Join explosion')
    return pairs, {'name': name, 'left_before': len(left), 'right_before': len(right),
                   'after': len(pairs), 'matched': sum(b is not None for _, b in pairs),
                   'cardinality': 'many_to_one', 'passed': True}


def validate_current(rows, expected_season):
    season(expected_season)
    errors = []
    required = ('playerRef', 'fantacalcioId', 'displayName', 'normalizedName', 'club', 'role',
                'eligibility', 'source_ref', 'season', 'competition')
    for i, r in enumerate(rows):
        for field in required:
            if r.get(field) in (None, ''):
                errors.append({'row': i, 'field': field, 'error': 'MISSING_REQUIRED'})
        if r.get('role') not in ROLES.values():
            errors.append({'row': i, 'field': 'role', 'error': 'INVALID_ROLE'})
        if r.get('season') != expected_season or r.get('competition') != 'IT_SERIE_A':
            errors.append({'row': i, 'field': 'season/competition', 'error': 'WRONG_SEASON_COMPETITION'})
        if r.get('eligibility') not in {'SELECTABLE', 'OUT_OF_LIST'}:
            errors.append({'row': i, 'field': 'eligibility', 'error': 'INVALID_ELIGIBILITY'})
    errors.extend({'field': 'playerRef', 'error': 'COLLISION', **d} for d in duplicates(rows, ['playerRef']))
    return errors


def validate_stats(row):
    errors = []
    for key in ('appearances', 'starts', 'minutes', 'goals', 'assists', 'PV', 'shots'):
        if row.get(key) is not None and row[key] < 0:
            errors.append(key + ':negative')
    if row.get('starts') is not None and row.get('appearances') is not None:
        if row['starts'] > row['appearances']:
            errors.append('starts>appearances')
    if row.get('MV') is not None and not 0 <= row['MV'] <= 10:
        errors.append('MV outside 0..10')
    if row.get('PV') is not None and row['PV'] > 38:
        errors.append('PV>38')
    return errors


def aggregate_stints(rows, additive_fields):
    """Never add TOTAL to club stints; check its totals before selecting it."""
    totals = [r for r in rows if re.fullmatch(r'(?i)(total|\d+\s+(squads?|teams?))', str(r.get('club', '')))]
    stints = [r for r in rows if r not in totals]
    if len(totals) > 1:
        raise IntegrityError('Multiple TOTAL rows')
    unique(stints, ['source_player_id', 'season', 'club'])
    values = {}
    for field in additive_fields:
        observed = [r.get(field) for r in stints]
        subtotal = sum(observed) if observed and all(v is not None for v in observed) else None
        if totals:
            total = totals[0].get(field)
            if subtotal is not None and total is not None and abs(subtotal - total) > 1e-6:
                raise IntegrityError(f'TOTAL/stint disagreement: {field}')
            values[field] = total
        else:
            values[field] = subtotal
    return values, 'SELECT_VERIFIED_TOTAL' if totals else 'SUM_DISTINCT_CLUB_STINTS'


def fixture_audit(fixtures, teams, expected_matches, *, aggregate_source=False):
    if aggregate_source:
        return {'status': 'NOT_APPLICABLE — AGGREGATE SOURCE', 'expected': None, 'observed': None,
                'missing': None, 'duplicates': None, 'coverage_pct': None}
    dup = duplicates(fixtures, ['season', 'fixture_id'])
    observed = len({(r['season'], r['fixture_id']) for r in fixtures})
    counts = Counter(t for r in fixtures for t in (r['home'], r['away']))
    return {'expected': expected_matches, 'observed': observed, 'missing': max(0, expected_matches-observed),
            'duplicates': len(dup), 'coverage_pct': 100*observed/expected_matches,
            'expected_teams': len(teams), 'observed_teams': len(counts), 'per_team': dict(counts)}


def iso(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def classify_field(name, *, source_season, target_season, available_at, cutoff, target=False, current_only=False):
    if target:
        return 'TARGET_ONLY'
    if name.casefold() in DENYLIST or name.casefold().startswith(('future_', 'target_', 'post_target_')):
        return 'UNSAFE'
    if available_at is None or iso(available_at) > iso(cutoff):
        return 'UNSAFE'
    if current_only:
        return 'CURRENT_ONLY'
    if int(source_season[:4]) >= int(target_season[:4]):
        return 'UNSAFE'
    return 'BACKTEST_SAFE'


def classify_event_window_field(name, *, source_season, target_season, cutoff,
                                target_start, event_window_end_exclusive,
                                source_available_by, source_semantics, target=False):
    """Certify final prior-season event totals, never backdate the file's publication.

    The July 1 bound is an analytical season bound, not a claimed match timestamp.
    A later file may revise prior results; that risk remains explicit in the report.
    """
    if target:
        return 'TARGET_ONLY'
    token = name.casefold()
    if token in DENYLIST or token.startswith(('future_', 'target_', 'post_target_')):
        return 'UNSAFE'
    if token in SNAPSHOT_FIELDS or name in {'MV', 'FM'}:
        return 'CURRENT_ONLY'
    if name not in EVENT_WINDOW_FIELDS:
        return 'UNSAFE'
    season(source_season); season(target_season)
    year = int(target_season[:4])
    if int(source_season[:4]) != year - 1 or source_semantics != 'PLAYER_SEASON_TOTAL':
        return 'UNSAFE'
    expected_start = iso(f'{year}-07-01T00:00:00+00:00')
    if iso(target_start) != expected_start or iso(event_window_end_exclusive) != expected_start:
        return 'UNSAFE'
    if iso(event_window_end_exclusive) - timedelta(seconds=1) > iso(cutoff) or iso(cutoff) >= iso(target_start):
        return 'UNSAFE'
    if source_available_by is None or iso(source_available_by) < iso(event_window_end_exclusive):
        return 'UNSAFE'  # A purported final version published before its window closed is not verified.
    return 'BACKTEST_SAFE_EVENT_WINDOW'


def assert_feature_fields(names):
    bad = [x for x in names if x.casefold() in DENYLIST or x.casefold().startswith(('future_', 'target_', 'post_target_'))]
    if bad:
        raise IntegrityError(f'Target-derived fields denied: {bad}')


def split_overlap(splits):
    seen = {}
    problems = []
    for split, keys in splits.items():
        for key in keys:
            if key in seen:
                problems.append({'sample': key, 'first': seen[key], 'second': split})
            seen[key] = split
    return problems


def score(metrics):
    """Each component = weight * arithmetic mean of declared measured pass fractions."""
    if set(metrics) != set(WEIGHTS):
        raise IntegrityError('All six DQ components required')
    result = {}
    for component, checks in metrics.items():
        if not checks or any(not 0 <= x <= 1 for x in checks.values()):
            raise IntegrityError('Missing/out-of-range DQ metric')
        result[component] = round(WEIGHTS[component] * sum(checks.values()) / len(checks), 4)
    return result, round(sum(result.values()), 4)


def readiness(pool_ok, dq, hard_failures, temporal, target, overlap):
    return {'AUCTION_POOL_READY': bool(pool_ok),
            'MODEL_READY': bool(pool_ok and dq >= 90 and not hard_failures and temporal == target == overlap == 0)}


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False)+'\n').encode('utf-8')


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()
