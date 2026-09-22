"""Build a local, immutable FD2-QA release and compact committable audit reports.

No training, ranking, price conversion, app integration, or production connections.
"""
import argparse
from collections import Counter, defaultdict
import csv
import io
import json
from pathlib import Path
import subprocess

from .adapters import workbook, fc_statistics, fc_page, advanced_csv, sqlite_inventory
from .integrity import (IntegrityError, canonical_id, normalize_name, role, duplicates, unique,
                        left_join, validate_current, validate_stats, aggregate_stints, fixture_audit,
                        classify_field, assert_feature_fields, split_overlap, score, readiness,
                        json_bytes, sha256, iso, WEIGHTS, DENYLIST)

PRIMARY_SHA = '5ec6e1afbee2ed7dd52c4fdb87595c242d13b8b2'
REFERENCE_SHA = '4dda14a8dd2ab24c2f30404c65d317e1d4cc84a4'
SEASON = '2026/27'
SEASONS = [f'{year}/{str(year+1)[-2:]}' for year in range(2021, 2027)]
SOURCE_AVAILABLE_BY = '2026-09-01T14:59:20+00:00'
RETRIEVED_AT = '2026-09-22T15:23:25+00:00'
TERMS = ('Local integrity audit only. No affirmative third-party data redistribution license established; '
         'Fantacalcio content terms restrict copying/processing. Public repository access is not a data license. '
         'Keep raw and derived player data outside Git; product reuse is a separate unresolved gate.')
FC_FIELDS = ['PV','MV','FM','goals','goals_conceded','assists','yellow_cards','red_cards',
             'penalties_saved','penalties_taken','penalties_scored','penalties_missed','own_goals']


def git(root, *args):
    return subprocess.check_output(['git','-C',str(root),*args], text=True, encoding='utf-8').strip()


def csv_bytes(rows, fields=None):
    if fields is None:
        fields = list(dict.fromkeys(k for row in rows for k in row))
    handle = io.StringIO(newline='')
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    for row in rows:
        writer.writerow({k: json.dumps(v,ensure_ascii=False,sort_keys=True) if isinstance(v,(list,dict)) else v
                         for k,v in row.items()})
    return handle.getvalue().encode('utf-8')


def missingness(rows, fields):
    result = {}
    for field in fields:
        absent = [r for r in rows if r.get(field) is None or r.get(field) == '']
        reasons = Counter()
        for r in absent:
            if field in {'MV','FM'} and r.get('PV') == 0:
                reasons['NO_APPEARANCE'] += 1
            elif field in {'minutes','starts','shots','xG','xA','availability','starter_evidence','set_piece_role'}:
                reasons['SOURCE_UNAVAILABLE'] += 1
            elif field == 'own_goals' and r.get('source_ref') == 'fc_stats':
                reasons['SOURCE_UNAVAILABLE'] += 1
            else:
                reasons['UNKNOWN'] += 1
        result[field] = {'non_null':len(rows)-len(absent),'missing':len(absent),
                         'missing_pct':round(100*len(absent)/len(rows),4) if rows else None,
                         'reasons':dict(reasons)}
    return result


def markdown_report(report):
    lines=['# FD2-QA data quality report','',
           f"Release: `{report['release_id']}`. Cutoff: {report['data_cutoff']}.",'',
           f"**AUCTION_POOL_READY: {report['AUCTION_POOL_READY']}; MODEL_READY: {report['MODEL_READY']}; DQ: {report['dq_score']}/100.**",
           '', '## Sources and freshness','',
           f"0novanta `{PRIMARY_SHA}`; piopy reference `{REFERENCE_SHA}`. Exact paths, per-file checksums, schemas and versions are in `source_manifest.json`.",'',
           'Bootstrap max rated appearances: 2; advanced current max appearances: 1; refreshed live max rated appearances: 5. This suggests round 5, but does not prove match completeness.',
           '', '## Current pool','',
           f"Players: {report['current_player_count']}; roles: {report['role_counts']}; identity coverage: {report['identity_coverage_pct']}%.",
           f"Unresolved identities: {report['unresolved_current_identities']}; missing roles: {report['current_missing_roles']}; missing clubs: {report['current_missing_clubs']}.",
           f"Bootstrap comparison: {report['bootstrap']['pool_additions']} additions, {report['bootstrap']['pool_removals']} removals, {report['bootstrap']['identity_updates']} club/role updates.",
           '', '## Historical and season coverage','',
           f"{report['historical']['rows']} historical rows, {report['historical']['players']} players. Current mapping: {report['historical']['current_players_mapped']}/{report['current_player_count']} ({report['historical']['current_player_mapping_pct']}%). {report['historical']['new_player_no_selected_history']} NEW_PLAYER_NO_HISTORY; {report['historical']['join_failures']} JOIN_FAILURE.",'',
           '| Season | Source rows | Distinct IDs | Clubs | Rated players | Max PV |',
           '|---|---:|---:|---:|---:|---:|']
    for row in report['season_coverage']:
        lines.append(f"| {row['season']} | {row['source_rows']} | {row['distinct_ids']} | {row['clubs']} | {row['rated_players']} | {row['max_PV']} |")
    lines.extend(['','The 2026/27 row above describes the superseded bootstrap workbook. All selected seasons contain 20 clubs. Fixture coverage and player-match coverage are **NOT_APPLICABLE — AGGREGATE SOURCE**. Expected/observed/missing fixtures, matchdays, orphan player-match rows and fixture duplicate counts are unknown, not zero.',
                  '', '## Duplicates and value validity',''])
    lines.extend(f'- {key}: {value}' for key,value in report['duplicates'].items())
    lines.extend(['',f"Canonical schema/value violations: {len(report['schema_violations'])}.",'',
                  'Transfer groups are counted across advanced file families, not unique transfers. Detailed keys, affected row indices, causes and resolutions remain in local `duplicate_audit.json`. No duplicate rows are silently dropped.',
                  '', '## Join cardinality','', '| Join | Left before | Right before | After | Matched |', '|---|---:|---:|---:|---:|'])
    for row in report['join_cardinality_checks']:
        lines.append(f"| {row['name']} | {row['left_before']} | {row['right_before']} | {row['after']} | {row['matched']} |")
    lines.extend(['','All joins enforce many-to-one right-key uniqueness.','', '## Missingness',''])
    for population,fields in report['missingness'].items():
        lines.extend([f'### {population}','', '| Field | Non-null | Missing | Missing % | Reasons |', '|---|---:|---:|---:|---|'])
        for field,row in fields.items():
            reasons=', '.join(f'{k}: {v}' for k,v in row['reasons'].items()) or '—'
            lines.append(f"| {field} | {row['non_null']} | {row['missing']} | {row['missing_pct']} | {reasons} |")
        lines.append('')
    lines.extend(['## Cross-source consistency',''])
    lines.extend(f'- {key}: {value}' for key,value in report['cross_source_consistency'].items())
    lines.extend(['','The live pages share one provider; the advanced files share another. These are internal consistency checks, not independent-provider confirmation. Different bootstrap/live timestamps explain changed values; they are never averaged. See local `source_reconciliation.csv`.',
                  '', '## Temporal and split integrity','',
                  'BACKTEST_SAFE: identifier only, not a predictive feature. Historical aggregates and current quotations/FVM/club/role are CURRENT_ONLY at this release cutoff. Future outcomes are TARGET_ONLY; future-derived fields and unmapped/unavailable enrichment are UNSAFE. See `field_safety_manifest.json`.',
                  '', 'Proposed target split: train 2022/23–2023/24; validation 2024/25; holdout 2025/26. Previous-season features only. Analytical target periods run July 1–June 30; prediction cutoff is June 30 23:59:59 UTC immediately before target start.',
                  f"Candidate counts: {report['split_counts']}. Temporal rejections: {report['temporal_rejected_candidates']}; admitted temporal violations: {report['admitted_temporal_violations']}; target leakage: {report['target_leakage_violations']}; split overlaps: {report['split_overlap_violations']}.",
                  'No historical samples are admitted: source publication before historical prediction cutoffs is unproven. These rejections block MODEL_READY.',
                  '', '## Deterministic DQ scoring','',
                  'Each component = its prescribed weight × the arithmetic mean of the named measured fractions below. Unknown checks receive zero. A high score never overrides a hard failure. MODEL_READY additionally requires total >=90.',
                  '', '| Component | Weight | Score | Measured fractions |', '|---|---:|---:|---|'])
    for component,value in report['dq_components'].items():
        metrics='; '.join(f'{k}={v:.6f}' for k,v in report['dq_metrics'][component].items())
        lines.append(f"| {component} | {WEIGHTS[component]} | {value} | {metrics} |")
    lines.extend(['',f"**Total: {report['dq_score']}/100.**",'', '## Hard failures',''])
    lines.extend(f'- {x}' for x in report['hard_failures'])
    lines.extend(['', '## Warnings',''])
    lines.extend(f'- {x}' for x in report['warnings'])
    lines.extend(['', '## Reproducibility and decision','',
                  'The builder compares two complete builds byte for byte, checks pinned source bytes and refuses to overwrite conflicting immutable releases. `release_checksums.json` covers every release file except itself; the content-derived release ID includes transformation-code hashes.',
                  'The pool is technically usable for local review. Historical modelling remains blocked. Raw and derived player data remain local because redistribution/product reuse is not cleared.',
                  'No model, prices, app integration or production mutation was performed.',''])
    return '\n'.join(lines).encode('utf-8')


def build(source_root, snapshot_root):
    source_root, snapshot_root = Path(source_root), Path(snapshot_root)
    selection_path=Path(__file__).parent.parent/'manifests/input_selection.json'
    selection=json.loads(selection_path.read_text(encoding='utf-8'))
    if selection['primary_commit'] != PRIMARY_SHA or selection['reference_commit'] != REFERENCE_SHA:
        raise IntegrityError('Selection manifest/code pin disagreement')
    if sha256((snapshot_root/'index.json').read_bytes()) != selection['snapshot_index_sha256']:
        raise IntegrityError('Snapshot index metadata differs from pinned selection')
    if git(source_root,'rev-parse','HEAD') != PRIMARY_SHA:
        raise IntegrityError('Primary source commit differs from pinned selection')
    reference = source_root.parent/'fantacalcio-py'
    if git(reference,'rev-parse','HEAD') != REFERENCE_SHA:
        raise IntegrityError('Current-source reference commit differs')
    snapshot_index = json.loads((snapshot_root/'index.json').read_text(encoding='utf-8'))
    snapshots = {r['source_name']:r for r in snapshot_index}
    for row in snapshot_index:
        if 'sha256' in row and sha256((snapshot_root/row['path']).read_bytes()) != row['sha256']:
            raise IntegrityError('Snapshot checksum mismatch')
    cutoff = max(r['retrieved_at'] for r in snapshot_index)
    artifacts, joins, duplicate_audit, reconciliation, warnings, hard_failures = [], [], [], [], [], []

    def artifact(rel, season_name, meta, decision='CANONICAL', provider='Fantacalcio'):
        path = source_root/rel
        # A clean HEAD is insufficient: compare each used working file with its actual Git blob.
        if git(source_root,'hash-object',str(path)) != git(source_root,'rev-parse',f'HEAD:{rel}'):
            raise IntegrityError('Modified external artifact: '+rel)
        item = {'source_name':'0novanta','repository':'https://github.com/0novanta/tool-asta-fantacalcio',
                'commit':PRIMARY_SHA,'path':rel,'season':season_name,'retrieved_at':RETRIEVED_AT,
                'observed_as_of':None,'available_by':SOURCE_AVAILABLE_BY,
                'sha256':sha256(path.read_bytes()),'row_count':meta['row_count'],
                'schema':meta['fields'],'schema_fingerprint':sha256(json_bytes(meta['fields'])),
                'original_source':provider,'terms_note':TERMS,'decision':decision,
                'freshness_note':'Historical final aggregate, publication history unproven' if season_name != SEASON
                    else 'Bootstrap snapshot; explicitly superseded or excluded when stale'}
        artifacts.append(item)
        return rel

    quotes_path = 'quotazioni/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx'
    original, quote_meta = workbook(source_root/quotes_path, SEASON)
    departed, _ = workbook(source_root/quotes_path, SEASON, 'Ceduti')
    artifact(quotes_path,SEASON,quote_meta,'BOOTSTRAP_SUPERSEDED')
    unique(original,['Id']); unique(departed,['Id'])
    if {r['Id'] for r in original}&{r['Id'] for r in departed}:
        raise IntegrityError('Active/departed workbook overlap')
    sheet_checks=[]
    for sheet, code in [('Portieri','P'),('Difensori','D'),('Centrocampisti','C'),('Attaccanti','A')]:
        subset,_=workbook(source_root/quotes_path,SEASON,sheet)
        expected={r['Id'] for r in original if r['R']==code}
        if expected != {r['Id'] for r in subset}:
            raise IntegrityError('Role sheets disagree with Tutti')
        sheet_checks.append({'sheet':sheet,'count':len(subset),'resolution':'VIEW_ONLY_DO_NOT_CONCATENATE'})

    latest, latest_meta = fc_page(snapshot_root/snapshots['fc_quotes']['path'],'quotes',SEASON)
    latest_stats, stats_meta = fc_page(snapshot_root/snapshots['fc_stats']['path'],'stats',SEASON)
    for key, meta in [('fc_quotes',latest_meta),('fc_stats',stats_meta)]:
        artifacts.append({**snapshots[key], 'repository':None,'commit':None,'version':snapshots[key]['sha256'],
                          'season':SEASON,'observed_as_of':None,'available_by':snapshots[key]['retrieved_at'],
                          'row_count':meta['row_count'],'schema':meta['fields'],
                          'schema_fingerprint':sha256(json_bytes(meta['fields'])),
                          'original_source':'Fantacalcio','terms_note':TERMS,'decision':'CANONICAL_LOCAL_ONLY',
                          'freshness_note':'Live snapshot; publication timestamp absent; max rated appearances measured separately'})
    latest_by_id={r['Id']:r for r in latest}
    selected=[r for r in latest if not r['out_of_list']]
    changes=[]
    old_by_id={r['Id']:r for r in original}
    for ident in sorted(set(old_by_id)|{r['Id'] for r in selected},key=int):
        a,b=old_by_id.get(ident),latest_by_id.get(ident)
        if not a:
            changes.append({'fantacalcioId':ident,'change':'ADDED','name':b['Nome'],'reason':'LIVE_ACTIVE_NOT_BOOTSTRAP_ACTIVE'})
        elif b is None or b['out_of_list']:
            changes.append({'fantacalcioId':ident,'change':'REMOVED','name':a['Nome'],'reason':'LIVE_OUT_OF_LIST'})
        elif a['Squadra'] != b['Squadra'] or a['R'] != b['R']:
            changes.append({'fantacalcioId':ident,'change':'UPDATED','name':b['Nome'],
                            'reason':f"club {a['Squadra']} -> {b['Squadra']}; role {a['R']} -> {b['R']}"})
    pairs,check=left_join(latest,latest_stats,['Id'],name='live quotation to live fantasy statistics')
    joins.append(check)
    current_consistency=[]
    for a,b in pairs:
        for field in ['Nome','Squadra','R']:
            good=b is not None and a[field]==b[field]
            current_consistency.append(good)
            reconciliation.append({'player':a['Id'],'season':SEASON,'field':field,
                'source_a':'fc_quotes','source_b':'fc_stats','source_a_value':a[field],
                'source_b_value':b.get(field) if b else None,'difference':None,
                'status':'MATCH' if good else 'FAIL','explanation':'Separate live pages, same original provider; not independent confirmation'})
        reconciliation.append({'player':a['Id'],'season':SEASON,'field':'eligibility',
            'source_a':'fc_quotes','source_b':'fc_stats','source_a_value':not a['out_of_list'],
            'source_b_value':None,'difference':None,'status':'NOT_COMPARABLE',
            'explanation':'Only quotation page exposes out-of-game marker; absence on statistics page is unknown, not eligible'})
    if not all(current_consistency):
        hard_failures.append('CURRENT_IDENTITY_RECONCILIATION_FAILED')
    current=[]
    for r in sorted(selected,key=lambda x:int(x['Id'])):
        current.append({'playerRef':canonical_id(r['Id']),'fantacalcioId':r['Id'],
            'displayName':r['Nome'],'normalizedName':normalize_name(r['Nome']),'club':r['Squadra'],
            'clubSourceId':r['club_source_id'],'role':role(r['R']),'eligibility':'SELECTABLE',
            'season':SEASON,'competition':'IT_SERIE_A','quotation':r['Qt.A'],'initialQuotation':r['Qt.I'],
            'FVM':r['FVM'],'source_ref':'fc_quotes','source_url':r['url'],
            'observed_at':snapshots['fc_quotes']['retrieved_at'],
            'eligibility_basis':'Live Classic list; no out-of-game marker'})
    pool_schema_errors=validate_current(current,SEASON)
    schema_errors=list(pool_schema_errors)
    if len({r['clubSourceId'] for r in current}) != 20:
        schema_errors.append({'error':'CURRENT_CLUB_COUNT_NOT_20'})
        pool_schema_errors.append({'error':'CURRENT_CLUB_COUNT_NOT_20'})
    name_collisions=duplicates(current,['normalizedName','club'])
    if name_collisions:
        hard_failures.append('CURRENT_NORMALIZED_IDENTITY_COLLISION')

    history,bootstrap_current,season_audit=[],[],[]
    for s in SEASONS:
        rel=f"statistiche/Statistiche_Fantacalcio_Stagione_{s.replace('/','_')}.xlsx"
        rows,meta=workbook(source_root/rel,s)
        ref=artifact(rel,s,meta,'BOOTSTRAP_SUPERSEDED' if s==SEASON else 'CANONICAL_LOCAL_ONLY')
        dup=duplicates(rows,['Id'])
        if dup:
            hard_failures.append('DUPLICATE_FANTACALCIO_ID_'+s)
        duplicate_audit.append({'source':rel,'grain':['source','season','Id'],'groups':dup})
        normalized=fc_statistics(rows,s,ref,SOURCE_AVAILABLE_BY)
        for r in normalized:
            r['playerRef']=canonical_id(r['fantacalcioId'])
            schema_errors.extend({'source':ref,'id':r['fantacalcioId'],'error':e} for e in validate_stats(r))
        season_audit.append({'season':s,'source_rows':len(rows),'distinct_ids':len({r['Id'] for r in rows}),
                             'clubs':len({r['Squadra'] for r in rows}),'max_PV':max(r['Pv'] for r in rows),
                             'rated_players':sum(r['Pv']>0 for r in rows),
                             'fixture_coverage':fixture_audit([],[],0,aggregate_source=True)})
        if s==SEASON:
            bootstrap_current=normalized
        else:
            history.extend(normalized)
    refreshed=fc_statistics(latest_stats,SEASON,'fc_stats',snapshots['fc_stats']['retrieved_at'])
    for r in refreshed:
        r['playerRef']=canonical_id(r['fantacalcioId'])
        schema_errors.extend({'source':'fc_stats','id':r['fantacalcioId'],'error':e} for e in validate_stats(r))
    player_season=sorted(history+refreshed,key=lambda x:(x['season'],int(x['fantacalcioId'])))
    unique(player_season,['playerRef','season'])
    suspect_rows=[{**r,'normalizedName':normalize_name(r['displayName'])} for r in player_season]
    suspected_identity_duplicates=duplicates(suspect_rows,['season','normalizedName','club',*FC_FIELDS])
    for item in suspected_identity_duplicates:
        item.update(cause='DISTINCT_IDS_IDENTICAL_NAME_CLUB_AND_STATISTICS',resolution='REQUIRES_VERIFICATION')
    if suspected_identity_duplicates:
        hard_failures.append('HISTORICAL_DISTINCT_IDS_IDENTICAL_OBSERVATIONS')
    current_ids={r['fantacalcioId'] for r in current}
    history_ids={r['fantacalcioId'] for r in history}
    mapping=[{'canonical_player_id':r['playerRef'],'source':'Fantacalcio','source_player_id':r['fantacalcioId'],
              'match_method':'stable provider numeric ID','confidence':'SOURCE_ID','status':'EXACT_ID'} for r in current]
    history_status=[]
    for p in current:
        matches=[r for r in history if r['fantacalcioId']==p['fantacalcioId']]
        status='EXACT_ID' if matches else 'NEW_PLAYER_NO_HISTORY'
        history_status.append({'playerRef':p['playerRef'],'status':status,'seasons':len(matches),
                               'meaning':'No row in selected historical source universe; not a claim of no career history'})
    joined,check=left_join(current,refreshed,['fantacalcioId'],name='current pool to refreshed current aggregates')
    joins.append(check)
    if check['matched'] != len(current):
        hard_failures.append('CURRENT_STATS_ID_JOIN_FAILURE')
    current_observations=[b for _,b in joined if b]
    oldstats={r['fantacalcioId']:r for r in bootstrap_current}
    freshness_changes=0
    for r in refreshed:
        old=oldstats.get(r['fantacalcioId'])
        if old:
            for field in FC_FIELDS:
                a,b=old.get(field),r.get(field)
                if a!=b:
                    freshness_changes+=1
                reconciliation.append({'player':r['fantacalcioId'],'season':SEASON,'field':field,
                    'source_a':'bootstrap_current','source_b':'fc_stats','source_a_value':a,'source_b_value':b,
                    'difference':round(b-a,6) if a is not None and b is not None else None,
                    'status':'MATCH' if a==b else 'DIFFERENT_SNAPSHOT',
                    'explanation':'Bootstrap max PV=2, live max PV measured below; versions kept separate, never averaged'})

    # Advanced data is audited at its actual player/season/club-stint grain.
    # Do not use upstream app fuzzy matching or its missing-to-zero coercions.
    advanced_audit=[]
    advanced_candidates=[]
    for s in SEASONS:
        year=int(s[:4]); parsed={}
        for kind in ['standard_stats','time','shooting_stats','misc','goalkeeping']:
            rel=f'statistiche_avanzate/{year}_{year+1}/{kind}.csv'
            rows,meta=advanced_csv(source_root/rel,s)
            artifact(rel,s,meta,'AUDIT_ONLY_NOT_MODEL_FEATURES','Sports Reference / FBref')
            parsed[kind]=rows
            source_dups=duplicates(rows,['source_player_id','season'])
            real_dups=duplicates(rows,['source_player_id','season','club'])
            for d in source_dups:
                d.update(cause='MULTIPLE_CLUB_STINTS',resolution='KEEP_STINT_GRAIN; DO_NOT_JOIN_AT_PLAYER_SEASON')
            duplicate_audit.append({'source':rel,'grain':['source_player_id','season'],
                                    'groups':source_dups,'stint_key_duplicates':real_dups})
            violations=[{'id':r['source_player_id'],'errors':validate_stats(r)} for r in rows if validate_stats(r)]
            advanced_audit.append({'source':rel,'season':s,'kind':kind,'rows':len(rows),
                'ids':len({r['source_player_id'] for r in rows}),'max_appearances':max((r['appearances'] or 0) for r in rows),
                'max_starts':max((r['starts'] or 0) for r in rows),'max_minutes':max((r['minutes'] or 0) for r in rows),
                'transfer_groups':len(source_dups),'stint_key_duplicates':len(real_dups),
                'value_violations':violations,'footer':meta['footer'],'decision':'AUDIT_ONLY_NO_VERIFIED_CROSSWALK'})
        pairs,check=left_join(parsed['standard_stats'],parsed['time'],['source_player_id','season','club'],
                              name=s+' advanced standard to time at stint grain')
        joins.append(check)
        for a,b in pairs:
            for field in ['appearances','starts','minutes']:
                av,bv=a.get(field),b.get(field) if b else None
                reconciliation.append({'player':'fbref:'+a['source_player_id'],'season':s,'field':field,
                    'source_a':'advanced_standard','source_b':'advanced_time','source_a_value':av,'source_b_value':bv,
                    'difference':bv-av if av is not None and bv is not None else None,
                    'status':'MATCH' if b and av==bv else 'AUDIT_ONLY_MISMATCH',
                    'explanation':'Not admitted to model; same source family, compare at club-stint grain'})
        groups=defaultdict(list)
        for r in parsed['standard_stats']:
            groups[r['source_player_id']].append(r)
        for ident,stints in groups.items():
            values,resolution=aggregate_stints(stints,['appearances','starts','minutes','goals','assists'])
            advanced_candidates.append({'source_player_id':ident,'season':s,'clubs':[r['club'] for r in stints],
                **values,'resolution':resolution,'canonical_mapping_status':'UNRESOLVED','admission':'EXCLUDED'})
    db_rel='dati_condivisibili/dati_pubblici.sqlite3'
    db=sqlite_inventory(source_root/db_rel)
    artifact(db_rel,None,{'row_count':sum(t['row_count'] for t in db['tables'].values()),
                          'fields':{k:v['fields'] for k,v in db['tables'].items()}},'AUDIT_ONLY','Mixed FBref/API-Football')
    for rel in ['app.py','README.md']:
        artifact(rel,None,{'row_count':None,'fields':['reference_code_or_documentation']},
                 'AUDIT_ONLY','0novanta repository documentation/code')

    # Explicitly enumerate every candidate observation field. Market values never enter historical evaluation.
    safety=[]
    for field in FC_FIELDS:
        safety.append({'field':'historical.'+field,'class':'CURRENT_ONLY',
            'reason':'Prior completed-season aggregates are usable today. This pinned version was only proven available in Sep 2026; earlier vintages unproven.',
            'backtest_condition':'Earlier published snapshot at/before cutoff AND source season precedes target season',
            'available_by':SOURCE_AVAILABLE_BY})
    for field in ['quotation','initialQuotation','FVM','club','role','eligibility']+FC_FIELDS:
        safety.append({'field':'current.'+field,'class':'CURRENT_ONLY',
                        'reason':'Snapshot observed on 2026-09-22, never backfilled into previous seasons'})
    for field in ['minutes','starts','shots','xG','xA','availability','starter_evidence','set_piece_role']:
        safety.append({'field':field,'class':'UNSAFE','reason':'Not admitted: absent or no verified canonical crosswalk/coverage'})
    for field in ['target_PV','target_FM','target_goals','target_assists']:
        safety.append({'field':field,'class':'TARGET_ONLY','reason':'Separate future outcome; never selected as a feature'})
    safety.append({'field':'playerRef','class':'BACKTEST_SAFE','reason':'Identifier only, not a predictive feature; never filter historical cohort to current survivors'})
    for field in sorted(DENYLIST):
        safety.append({'field':field,'class':'UNSAFE','reason':'Target/future-information denylist'})
    feature_names=['historical_'+f for f in FC_FIELDS]+['current_'+f for f in FC_FIELDS]
    assert_feature_fields(feature_names)
    split_keys={'train':[],'validation':[],'holdout':[]}
    candidate_samples=[]
    previous={(r['fantacalcioId'],int(r['season'][:4])):r for r in history}
    for target_row in history:
        year=int(target_row['season'][:4])
        if year < 2022:
            continue
        prior=previous.get((target_row['fantacalcioId'],year-1))
        if prior is None:
            continue
        split='train' if year<=2023 else 'validation' if year==2024 else 'holdout'
        sample=target_row['playerRef']+':target:'+target_row['season']
        sample_cutoff=f'{year}-06-30T23:59:59+00:00'
        target_start=f'{year}-07-01T00:00:00+00:00'
        safe=classify_field('MV',source_season=prior['season'],target_season=target_row['season'],
                            available_at=prior['observed_at'],cutoff=sample_cutoff)=='BACKTEST_SAFE'
        if not iso(sample_cutoff)<iso(target_start):
            raise IntegrityError('Invalid target boundary')
        candidate_samples.append({'sample_key':sample,'split':split,'feature_season':prior['season'],
            'target_season':target_row['season'],'prediction_cutoff':sample_cutoff,'target_start':target_start,
            'feature_max_timestamp':prior['observed_at'],'admitted':safe,
            'reason':'PASS' if safe else 'SOURCE_VERSION_NOT_PROVEN_AVAILABLE_AT_CUTOFF'})
        split_keys[split].append(sample)
    overlap=split_overlap(split_keys)
    rejected_temporal=sum(not r['admitted'] for r in candidate_samples)
    if rejected_temporal:
        hard_failures.append('HISTORICAL_AS_OF_UNPROVEN: candidate training/validation/holdout rows fail publication-time gate')
    if not candidate_samples:
        hard_failures.append('NO_CHRONOLOGICAL_SAMPLES')
    if overlap:
        hard_failures.append('SPLIT_OVERLAP')
    if schema_errors:
        hard_failures.append('CANONICAL_SCHEMA_VIOLATIONS')
    for r in player_season:
        if iso(r['observed_at'])>iso(cutoff):
            hard_failures.append('FEATURE_OBSERVED_AFTER_RELEASE_CUTOFF')

    # Independent current evidence is a smoke test, not a wholesale guessed-name join.
    fpd_smoke={'reference_repository':'https://github.com/piopy/fantacalcio-py','commit':REFERENCE_SHA,
        'pages':snapshot_index[2:],'observed':'Maignan page: current 2026/27, 4 appearances; live FC has 5. Forecast fields and GK Rigorista badge are not validated facts.',
        'injury_page':'Printed update 2026-09-15 18:45; no Kossounou entry in inspected snapshot. Not used as complete current availability.',
        'decision':'NOT_ADMITTED_STALE_OR_UNVERIFIED_SEMANTICS',
        'rejected_implementation_patterns':['private credential provider','DNS override','fuzzy first-match identity','numeric errors coerced to zero'],
        'understat':'Prior normal browser export worked, but lacks player IDs; robots disallows crawling. No undocumented POST or scraper used.',
        'paid_provider':'Not used or purchased'}
    for rel in ['src/providers.py','src/fpd.py','src/merge.py','src/config.py','LICENSE']:
        p=reference/rel
        if git(reference,'hash-object',str(p)) != git(reference,'rev-parse',f'HEAD:{rel}'):
            raise IntegrityError('Modified reference code: '+rel)
        artifacts.append({'source_name':'piopy_reference','repository':'https://github.com/piopy/fantacalcio-py',
            'commit':REFERENCE_SHA,'path':rel,'sha256':sha256(p.read_bytes()),'season':None,
            'retrieved_at':RETRIEVED_AT,'observed_as_of':None,'available_by':'2026-09-13T20:05:45+00:00',
            'row_count':None,'schema':['reference_code_or_license'],'schema_fingerprint':sha256(json_bytes(['reference_code_or_license'])),
            'original_source':'Reference code only, no code copied','terms_note':'GPL-3.0 code; upstream data rights separate',
            'freshness_note':'Reference-only','decision':'AUDIT_ONLY'})
    for row in snapshot_index[2:]:
        if 'sha256' in row:
            artifacts.append({**row,'version':row['sha256'],'season':SEASON,'row_count':None,
                'schema':['html_smoke_test'],'schema_fingerprint':sha256(json_bytes(['html_smoke_test'])),
                'observed_as_of':None,'original_source':'Fantacalciopedia','terms_note':'All rights reserved; local smoke test only',
                'freshness_note':'Not admitted; historical/current/forecast sections coexist','decision':'AUDIT_ONLY'})

    all_candidates=FC_FIELDS+['minutes','starts','shots','xG','xA','availability','starter_evidence','set_piece_role']
    miss={'current_pool':missingness(current,['playerRef','fantacalcioId','displayName','club','role','eligibility','quotation','FVM']),
          'historical':missingness(history,all_candidates),'current_evidence':missingness(current_observations,all_candidates)}
    pool_ok=bool(current and not pool_schema_errors and not name_collisions and all(current_consistency))
    historical_coverage=len(current_ids & history_ids)/len(current_ids)
    usable_rates=sum(r['PV']>0 and r['MV'] is not None and r['FM'] is not None for r in history)/sum(r['PV']>0 for r in history)
    adv_recons=[r for r in reconciliation if r['source_a']=='advanced_standard']
    adv_consistency=sum(r['status']=='MATCH' for r in adv_recons)/len(adv_recons) if adv_recons else 0
    # Unknown historical publication time earns no point; excluding unsafe rows is separately rewarded.
    metric_config={
      'provenance':{'all_artifacts_hashed':float(all(r.get('sha256') for r in artifacts)),
                    'all_versions_pinned':float(all(r.get('commit') or r.get('version') for r in artifacts)),
                    'all_schemas_recorded':float(all(r.get('schema') for r in artifacts))},
      'schema':{'canonical_value_validity':float(not schema_errors),'strict_missing_numeric_policy':1.0},
      'identity':{'unique_canonical_keys':float(not duplicates(current,['playerRef'])),
                  'unique_season_keys':float(not duplicates(player_season,['playerRef','season'])),
                  'join_cardinality':float(all(j['passed'] for j in joins)),
                  'current_identity_complete':float(not name_collisions and pool_ok)},
      'coverage':{'current_critical_complete':float(pool_ok),'current_stats_id_coverage':len(current_observations)/len(current),
                  'historical_rated_values_complete':usable_rates,'current_players_with_history':historical_coverage},
      'consistency':{'live_identity_agreement':sum(current_consistency)/len(current_consistency),
                     'advanced_same_grain_agreement':adv_consistency,
                     'independent_provider_complete_current_reconciliation':0.0},
      'temporal':{'current_release_cutoff_valid':float(not any('AFTER_RELEASE' in f for f in hard_failures)),
                  'unsafe_samples_excluded':1.0,'target_denylist':1.0,'split_disjoint':float(not overlap),
                  'historical_cutoff_proven':1-rejected_temporal/len(candidate_samples) if candidate_samples else 0.0}}
    components,total=score(metric_config)
    temporal_violations=rejected_temporal
    states=readiness(pool_ok,total,hard_failures,temporal_violations,0,len(overlap))
    warnings.extend(['Data release is LOCAL_ONLY; data redistribution/product reuse not cleared.',
        'Aggregate data cannot prove fixture or player-match completeness.',
        'Historical source includes current-version corrections; do not assign old as-of timestamps from season labels.',
        'No historical training cohort is filtered to current selectable players (avoid survivorship bias).',
        'PV counts rated appearances, not all appearances; source assists and generic football assists are not interchangeable.',
        'MV/FM source zero with PV=0 is preserved as raw value and normalized to null/NO_APPEARANCE.',
        'No exact fantasy total reconstructed from rounded MV/FM.',
        'Workbook/page vote edition is preserved as Fantacalcio-source data; league-specific edition/settings are not independently confirmed.',
        'Workbook core date metadata is absent; reader-generated default modification timestamps are not source freshness evidence.',
        'Advanced data excluded from predictive features until crosswalk verification; no fuzzy joins admitted.',
        'No complete current minutes/starts/injuries feed admitted. Missing optional evidence does not block the pool.',
        'No historical base-vote distribution: aggregate mean is insufficient for modifier stability.',
        'Five preferred completed seasons only; older compatible source files were not needed for this release.'])
    source_manifest={'primary_commit':PRIMARY_SHA,'reference_commit':REFERENCE_SHA,
                     'snapshot_index_sha256':selection['snapshot_index_sha256'],
                     'input_selection_sha256':sha256(selection_path.read_bytes()),
                     'pipeline_sha256':{p.name:sha256(p.read_bytes()) for p in sorted(Path(__file__).parent.glob('*.py'))},
                     'retrieval_time_semantics':'Fixed acquisition record, not regeneration time',
                     'cutoff':cutoff,'rights_status':'LOCAL_ONLY_NOT_CLEARED_FOR_REDISTRIBUTION','artifacts':artifacts}
    field_manifest={'classes':['BACKTEST_SAFE','CURRENT_ONLY','TARGET_ONLY','UNSAFE'],'fields':safety,
        'denylist':sorted(DENYLIST),'feature_candidates':feature_names,
        'historical_asof_policy':'Strict known-at-time. A final-season label is not a publication timestamp.',
        'candidate_split':{'train':['2022/23','2023/24'],'validation':['2024/25'],'holdout':['2025/26'],
                           'features':'Previous completed season only','boundary':'Analytical season July 1 to June 30; cutoff June 30 23:59:59 UTC before target season'},
        'admitted_historical_samples':sum(r['admitted'] for r in candidate_samples),
        'current_only_safe_for_forecast_after':cutoff}
    files={'current_players.csv':csv_bytes(current),'player_season.csv':csv_bytes(player_season),
           'identity_mapping.csv':csv_bytes(mapping),'history_mapping_status.csv':csv_bytes(history_status),
           'excluded_players.csv':csv_bytes([r for r in latest if r['out_of_list']]),
           'pool_changes.csv':csv_bytes(changes), 'source_reconciliation.csv':csv_bytes(reconciliation),
           'advanced_stint_audit.csv':csv_bytes(advanced_candidates),
           'candidate_split_audit.csv':csv_bytes(candidate_samples),
           'source_manifest.json':json_bytes(source_manifest),'field_safety_manifest.json':json_bytes(field_manifest),
           'duplicate_audit.json':json_bytes(duplicate_audit),
           'suspicious_identity_duplicates.json':json_bytes(suspected_identity_duplicates),'sqlite_audit.json':json_bytes(db),
           'advanced_audit.json':json_bytes(advanced_audit),'current_source_audit.json':json_bytes(fpd_smoke)}
    digest=sha256(json_bytes({k:sha256(v) for k,v in sorted(files.items())}))
    release_id='fd2qa-2026-09-22-'+digest[:12]
    report={'release_id':release_id,'content_sha256':digest,'data_cutoff':cutoff,'competition':'IT_SERIE_A',
        'primary_commit':PRIMARY_SHA,'reference_commit':REFERENCE_SHA,'source_versions':source_manifest,
        'current_player_count':len(current),'role_counts':dict(Counter(r['role'] for r in current)),
        'identity_coverage_pct':100.0 if pool_ok else None,'unresolved_current_identities':len(name_collisions),
        'current_missing_roles':miss['current_pool']['role']['missing'],'current_missing_clubs':miss['current_pool']['club']['missing'],
        'bootstrap':{'current_rows':len(original),'departed_rows':len(departed),'sheet_checks':sheet_checks,
            'pool_additions':sum(r['change']=='ADDED' for r in changes),'pool_removals':sum(r['change']=='REMOVED' for r in changes),
            'identity_updates':sum(r['change']=='UPDATED' for r in changes)},
        'freshness':{'bootstrap_PV_max':max(r['PV'] for r in bootstrap_current),
            'advanced_current_MP_max':max(r['max_appearances'] for r in advanced_audit if r['season']==SEASON),
            'live_PV_max':max(r['PV'] for r in refreshed),'live_stats_retrieved_at':snapshots['fc_stats']['retrieved_at'],
            'fixture_completeness':'NOT_APPLICABLE — AGGREGATE SOURCE','asof_matchday':'Live maximum PV=5 suggests round 5; no fixture completeness assertion'},
        'historical':{'seasons':SEASONS[:-1],'rows':len(history),'players':len(history_ids),
            'current_players_mapped':len(current_ids&history_ids),'current_player_mapping_pct':round(100*historical_coverage,4),
            'new_player_no_selected_history':len(current_ids-history_ids),'join_failures':0,'cohort':'ALL_SOURCE_PLAYERS_NOT_ONLY_CURRENT_SURVIVORS'},
        'season_coverage':season_audit,'player_match_coverage':{'status':'NOT_APPLICABLE — AGGREGATE SOURCE','orphans':None},
        'duplicates':{'current_canonical':len(duplicates(current,['playerRef'])),
            'source_identity_mapping':len(duplicates(mapping,['source','source_player_id'])),
            'player_season':len(duplicates(player_season,['playerRef','season'])),
            'current_name_club_collisions':len(name_collisions),
            'different_ids_identical_observations':len(suspected_identity_duplicates),
            'advanced_transfer_groups':sum(len(d['groups']) for d in duplicate_audit if 'stint_key_duplicates' in d),
            'advanced_unresolved_stint_duplicates':sum(len(d['stint_key_duplicates']) for d in duplicate_audit if 'stint_key_duplicates' in d),
            'canonical_unresolved':len(suspected_identity_duplicates)},
        'join_cardinality_checks':joins,'schema_violations':schema_errors,'missingness':miss,
        'cross_source_consistency':{'live_identity_checks':len(current_consistency),'live_identity_failures':current_consistency.count(False),
            'advanced_stat_checks':len(adv_recons),'advanced_stat_mismatches':sum(r['status']!='MATCH' for r in adv_recons),
            'bootstrap_to_live_changed_fields':freshness_changes,'independent_complete_current_check':False},
        'temporal_leakage_violations':temporal_violations,'admitted_temporal_violations':0,
        'temporal_rejected_candidates':rejected_temporal,'target_leakage_violations':0,'split_overlap_violations':len(overlap),
        'split_counts':{k:len(v) for k,v in split_keys.items()},'split_overlap_details':overlap,
        'dq_formula':'component weight times unweighted mean of listed measured fractions; no score overrides hard failures',
        'dq_metrics':metric_config,'dq_weights':WEIGHTS,'dq_components':components,'dq_score':total,
        **states,'warnings':warnings,'hard_failures':sorted(set(hard_failures)),
        'production_changes':'NONE','model_trained':False,'rights_status':'LOCAL_ONLY',
        'reproducibility':'Verified by caller building twice and comparing every output byte before writing',
        'optional_scope_exclusions':['advanced features','Understat enrichment','FPD forecasts/injury joins','paid providers'],
        'sqlite_summary':{k:v['row_count'] for k,v in db['tables'].items()},
        'sqlite_missing_tables':db['missing_canonical_tables']}
    files['data_quality_report.json']=json_bytes(report)
    files['data_quality_report.md']=markdown_report(report)
    files['release_checksums.json']=json_bytes({k:sha256(v) for k,v in sorted(files.items())})
    return files,report


def write_immutable(directory, files):
    directory=Path(directory)
    if directory.exists():
        old={p.name:p.read_bytes() for p in directory.iterdir() if p.is_file()}
        if old!=files:
            raise IntegrityError('Refusing to overwrite a different frozen release')
        return
    directory.mkdir(parents=True)
    for name,payload in sorted(files.items()):
        (directory/name).write_bytes(payload)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',type=Path,required=True)
    parser.add_argument('--snapshot-root',type=Path,required=True)
    parser.add_argument('--output-root',type=Path,required=True)
    parser.add_argument('--reports',type=Path,required=True)
    args=parser.parse_args()
    files,report=build(args.source_root,args.snapshot_root)
    rerun,second=build(args.source_root,args.snapshot_root)
    if files!=rerun or report!=second:
        raise IntegrityError('Deterministic rerun failed')
    destination=args.output_root/report['release_id']
    write_immutable(destination,files)
    args.reports.mkdir(parents=True,exist_ok=True)
    for name in ['data_quality_report.json','data_quality_report.md','field_safety_manifest.json',
                 'source_manifest.json','sqlite_audit.json','advanced_audit.json','current_source_audit.json','release_checksums.json']:
        (args.reports/name).write_bytes(files[name])
    print(json.dumps({'release':str(destination),'players':report['current_player_count'],'score':report['dq_score'],
                      'AUCTION_POOL_READY':report['AUCTION_POOL_READY'],'MODEL_READY':report['MODEL_READY'],
                      'hard_failures':report['hard_failures'],'deterministic_rerun':'PASS'},indent=2))


if __name__=='__main__':
    main()
