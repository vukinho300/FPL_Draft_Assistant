"""Two phases: freeze validation selection, then open the final holdout and project."""
import argparse
import csv
import json
from pathlib import Path
import platform
import numpy as np
from .core import FIELDS, arrays, samples, event_features, vector, fit, predict, metrics, current_update
from ..pipeline.integrity import IntegrityError, json_bytes, sha256, split_overlap
from ..pipeline.release import csv_bytes, write_immutable


def protocol():
    return json.loads((Path(__file__).parents[1]/'manifests/fm_s_protocol.json').read_text())


def code_hashes():
    return {p.name:sha256(p.read_bytes()) for p in sorted(Path(__file__).parent.glob('*.py'))}


def verify_input(root, cfg):
    root=Path(root)
    raw=(root/'release_checksums.json').read_bytes()
    if sha256(raw)!=cfg['input_checksums_sha256']:
        raise IntegrityError('Unapproved input checksum manifest')
    for name,digest in json.loads(raw).items():
        if sha256((root/name).read_bytes())!=digest:
            raise IntegrityError('Input artifact changed: '+name)
    report=json.loads((root/'data_quality_report.json').read_bytes())
    if report['release_id']!=cfg['input_release'] or not report['MODEL_READY'] or report['hard_failures']:
        raise IntegrityError('Input release is not approved MODEL_READY')
    safety=json.loads((root/'field_safety_manifest.json').read_bytes())
    classes={r['field']:r['class'] for r in safety['fields']}
    if any(classes.get('historical.'+field)!='BACKTEST_SAFE_EVENT_WINDOW' for field in FIELDS):
        raise IntegrityError('Feature is outside accepted temporal certificate')
    return report


def read_rows(root, maximum_year):
    """Selection never parses target values from the holdout/current seasons."""
    result=[]
    with (Path(root)/'player_season.csv').open(encoding='utf-8',newline='') as handle:
        for raw in csv.DictReader(handle):
            if int(raw['season'][:4])>maximum_year:
                continue
            row={key:raw[key] for key in ('playerRef','season','observed_at','statistics_scope')}
            for field in (*FIELDS,'FM','MV'):
                row[field]=float(raw[field]) if raw[field]!='' else None
            result.append(row)
    return result


def check_splits(groups):
    if split_overlap({name:[r['key'] for r in rows] for name,rows in groups.items()}):
        raise IntegrityError('Chronological sample overlap')


def control_summary(rows):
    return {'repeats':len(rows),
        'median_total_proxy_mae':float(np.median([r['total_proxy_mae'] for r in rows])),
        'median_spearman':float(np.median([r['spearman'] for r in rows])),
        'p95_spearman':float(np.quantile([r['spearman'] for r in rows],.95))}


def negative_controls(config, train, validation, real_prediction, cfg):
    x,pv,fm=arrays(train); vx,vpv,vfm=arrays(validation)
    rng=np.random.default_rng(cfg['seed'])
    shuffled,noise,mispaired=[],[],[]
    for _ in range(cfg['negative_control_repeats']):
        permutation=rng.permutation(len(pv))
        model=fit(config,x,pv[permutation],fm[permutation])
        shuffled.append(metrics(vpv,vfm,predict(model,vx)))
        nx=np.column_stack([rng.permutation(x[:,j]) for j in range(x.shape[1])])
        nv=np.column_stack([rng.choice(x[:,j],len(vx)) for j in range(x.shape[1])])
        noise.append(metrics(vpv,vfm,predict(fit(config,nx,pv,fm),nv)))
        permutation=rng.permutation(len(vpv))
        mispaired.append(metrics(vpv[permutation],vfm[permutation],real_prediction))
    summaries={'shuffled_training_targets':control_summary(shuffled),
               'random_feature_columns':control_summary(noise),
               'shuffled_validation_outcomes':control_summary(mispaired)}
    real=metrics(vpv,vfm,real_prediction)
    required=['random_feature_columns','shuffled_validation_outcomes']
    if config['kind']!='naive':
        required.append('shuffled_training_targets')
    passed=all(real['total_proxy_mae']<summaries[name]['median_total_proxy_mae']*.95
        and real['spearman']>summaries[name]['p95_spearman'] for name in required)
    return {'summaries':summaries,'required_controls':required,'passed':passed,
        'fixed_persistence_note':'Shuffling training labels cannot erase a fixed prior-PV rule; outcome-pairing and noise controls test that rule.'}


def select_models(train, validation, cfg):
    if any(r['target_season'] not in cfg['train_targets'] for r in train) or any(
        r['target_season'] not in cfg['validation_targets'] for r in validation):
        raise IntegrityError('Holdout/other season supplied to selection')
    check_splits({'train':train,'validation':validation})
    x,pv,fm=arrays(train); vx,vpv,vfm=arrays(validation)
    comparisons={}; models={}
    for candidate in cfg['candidates']:
        model=fit(candidate,x,pv,fm)
        models[candidate['name']]=model
        comparisons[candidate['name']]=metrics(vpv,vfm,predict(model,vx))
    configs={r['name']:r for r in cfg['candidates']}
    baselines=[c for c in cfg['candidates'] if c['kind']!='ridge']
    baseline=min(baselines,key=lambda c:comparisons[c['name']]['total_proxy_mae'])
    winner=baseline
    ridge=next(c for c in cfg['candidates'] if c['kind']=='ridge')
    b,r=comparisons[baseline['name']],comparisons[ridge['name']]
    if r['total_proxy_mae']<=b['total_proxy_mae']*.98 and r['spearman']>=b['spearman']-.01:
        winner=ridge
    model=models[winner['name']]
    validation_prediction=predict(model,vx)
    controls=negative_controls(winner,train,validation,validation_prediction,cfg)
    best_shrink=min((c for c in cfg['candidates'] if c['kind']=='shrink'),
        key=lambda c:comparisons[c['name']]['total_proxy_mae'])
    training_probability=predict(model,x)[0]/38
    residual=pv/38-training_probability
    binomial_variance=float(np.mean(training_probability*(1-training_probability)))
    latent_variance=max(float(np.var(residual))-binomial_variance/38,1e-6)
    availability_strength=float(np.clip(binomial_variance/latent_variance-1,2,38))
    validation_total=vpv*np.nan_to_num(vfm,nan=0)
    error=np.abs(validation_total-validation_prediction[0]*validation_prediction[1])
    return {'protocol':cfg,'code_hashes':code_hashes(),'selected':configs[winner['name']],
        'validation_comparisons':comparisons,'train_in_sample':metrics(pv,fm,predict(model,x)),
        'negative_controls':controls,'sample_counts':{'train':len(train),'validation':len(validation)},
        'selection_basis':'VALIDATION_ONLY; holdout outcomes not parsed in this phase',
        'selection_rule':cfg['selection'],
        'current_update_strengths':{'availability_equivalent_matches':availability_strength,
            'availability_formula':'clip(mean(p*(1-p))/(var(PV/38-p)-mean(p*(1-p))/38)-1,2,38), train residual moments',
            'production_equivalent_rated_appearances':best_shrink['k'],
            'production_basis':'Best validation shrinkage baseline k, reused as a stated current-update approximation'},
        'validation_absolute_error_q80':float(np.quantile(error,.8)),
        'validation_interval_coverage':float(np.mean(error<=np.quantile(error,.8))),
        'runtime':{'python':platform.python_version(),'numpy':np.__version__}}


def selection_phase(root, output, reports):
    cfg=protocol(); verify_input(root,cfg)
    rows=read_rows(root,2024)
    train=samples(rows,cfg['train_targets']); val=samples(rows,cfg['validation_targets'])
    if (len(train),len(val))!=(876,424):
        raise IntegrityError('Accepted selection cohort count changed')
    result=select_models(train,val,cfg)
    payload=json_bytes(result)
    ident='fms-selection-'+sha256(payload)[:12]
    write_immutable(Path(output)/ident,{'selection.json':payload})
    Path(reports).mkdir(parents=True,exist_ok=True)
    (Path(reports)/'fm_s_selection.json').write_bytes(payload)
    print(json.dumps({'selection_path':str(Path(output)/ident/'selection.json'),
        'selected':result['selected'],'validation':result['validation_comparisons'],
        'controls':result['negative_controls'],'strengths':result['current_update_strengths']},indent=2))


def forecast(model, all_rows, current_pool, cfg, selected):
    previous={r['playerRef']:r for r in all_rows if r['season']=='2025/26'}
    live={r['playerRef']:r for r in all_rows if r['season']=='2026/27'}
    any_history={r['playerRef'] for r in all_rows if r['season']!='2026/27'}
    strengths=selected['current_update_strengths']
    elapsed=cfg['current_elapsed_opportunities_proxy']
    rows=[]
    for person in current_pool:
        ident=person['playerRef']; prior=previous.get(ident); current=live.get(ident)
        if current is None:
            raise IntegrityError('Current evidence join failed')
        if prior is None:
            ppv,pfm=model['mean_target_PV'],model['mean_target_FM']
        else:
            p=predict(model,np.array([vector(event_features(prior))]))
            ppv,pfm=float(p[0][0]),float(p[1][0])
        update=current_update(ppv,pfm,current,elapsed,strengths['availability_equivalent_matches'],
                              strengths['production_equivalent_rated_appearances'])
        value=update['expected_remaining_PV']*update['expected_FM']
        inflation=1.5 if prior is None else 1.25 if prior['PV']<10 else 1.0
        width=selected['validation_absolute_error_q80']*(38-elapsed)/38*inflation
        flags=['REMAINING_OPPORTUNITIES_PROXY_NOT_FIXTURE_VERIFIED','DEFENSE_MODIFIER_AND_CLEAN_SHEET_BONUS_UNMODELED',
               'RETROSPECTIVE_SOURCE_REVISION_RISK','CURRENT_UPDATE_NOT_BACKTESTED_WITHIN_SEASON']
        if prior is None: flags.append('NO_PREVIOUS_SEASON_ROW_POPULATION_PRIOR')
        if ident not in any_history: flags.append('NO_SELECTED_HISTORICAL_DATA')
        if current['PV']==0: flags.append('NO_CURRENT_RATED_APPEARANCE')
        rows.append({'playerRef':ident,'name':person['displayName'],'club':person['club'],'role':person['role'],
            'projection':round(value,4),'projection_unit':'remaining_source_fantavoto_sum_proxy',
            'position_rank':0,'overall_rank':0,
            'confidence':'MEDIUM' if prior is not None and prior['PV']>=10 and current['PV']>=2 else 'LOW',
            'uncertainty_lower':round(max(0,value-width),4),'uncertainty_upper':round(value+width,4),
            'uncertainty_kind':'validation_absolute_error_80_band_scaled_with_heuristic_inflation_not_calibrated_live',
            **{k:round(v,6) for k,v in update.items()},
            'prior_full_season_PV_prediction':round(ppv,6),'prior_FM_prediction':round(pfm,6),
            'prior_source_PV':prior['PV'] if prior else None,
            'current_PV':current['PV'],'current_MV':current['MV'],'current_FM':current['FM'],
            'remaining_opportunities_proxy':38-elapsed,'FVM_benchmark':float(person['FVM']),
            'quotation_benchmark':float(person['quotation']),'warnings':flags})
    rows.sort(key=lambda r:(-r['projection'],r['playerRef']))
    positions={}
    for rank,row in enumerate(rows,1):
        row['overall_rank']=rank
        positions[row['role']]=positions.get(row['role'],0)+1
        row['position_rank']=positions[row['role']]
    if len(rows)!=534 or len({r['playerRef'] for r in rows})!=534:
        raise IntegrityError('Forecast pool incomplete/duplicated')
    return rows


def release_phase(root, selection_path, output, reports):
    cfg=protocol(); source_report=verify_input(root,cfg)
    selection_bytes=Path(selection_path).read_bytes()
    if Path(selection_path).parent.name!='fms-selection-'+sha256(selection_bytes)[:12]:
        raise IntegrityError('Selection artifact content hash does not match its frozen identity')
    selected=json.loads(selection_bytes)
    if selected['protocol']!=cfg or selected['code_hashes']!=code_hashes():
        raise IntegrityError('Selection changed or code/protocol differs; do not silently retune after holdout')
    if not selected['negative_controls']['passed']:
        raise IntegrityError('Negative controls failed; no trusted projection release')
    # This phase is invoked only after immutable selection.json exists.
    rows=read_rows(root,2025)
    development=samples(rows,cfg['train_targets']+cfg['validation_targets'])
    holdout=samples(rows,cfg['holdout_targets'])
    check_splits({'development':development,'holdout':holdout})
    if (len(development),len(holdout))!=(1300,435):
        raise IntegrityError('Accepted final-evaluation cohort count changed')
    x,pv,fm=arrays(development); hx,hpv,hfm=arrays(holdout)
    evaluation_model=fit(selected['selected'],x,pv,fm)
    held_prediction=predict(evaluation_model,hx)
    held_metrics=metrics(hpv,hfm,held_prediction)
    naive=fit(cfg['candidates'][0],x,pv,fm)
    held_naive=metrics(hpv,hfm,predict(naive,hx))
    errors=np.abs(hpv*np.nan_to_num(hfm,nan=0)-held_prediction[0]*held_prediction[1])
    # Hyperparameters/strengths frozen. All completed outcomes can now fit tonight's model.
    all_samples=development+holdout
    ax,apv,afm=arrays(all_samples)
    production_model=fit(selected['selected'],ax,apv,afm)
    all_rows=read_rows(root,2026)
    with (Path(root)/'current_players.csv').open(encoding='utf-8',newline='') as handle:
        pool=list(csv.DictReader(handle))
    projections=forecast(production_model,all_rows,pool,cfg,selected)
    if json_bytes(projections)!=json_bytes(forecast(production_model,all_rows,pool,cfg,selected)):
        raise IntegrityError('Current projection serialization is not deterministic')
    holdout_rows=[{'sample_key':r['key'],'target_PV':r['target_PV'],'target_FM':r['target_FM'],
        'predicted_PV':float(held_prediction[0][i]),'predicted_FM':float(held_prediction[1][i])}
        for i,r in enumerate(holdout)]
    evaluation={'selected_model':selected['selected'],'validation_comparisons':selected['validation_comparisons'],
        'negative_controls':selected['negative_controls'],'holdout_selected':held_metrics,
        'holdout_naive_reference':held_naive,'holdout_reselected':False,
        'holdout_interval_coverage':float(np.mean(errors<=selected['validation_absolute_error_q80'])),
        'holdout_protocol':'Selection frozen first; fixed winner refit on train+validation; one predeclared final evaluation configuration.',
        'input_release':cfg['input_release'],'input_DQ':source_report['dq_score'],
        'selection_sha256':sha256(selection_bytes),'protocol_sha256':sha256(json_bytes(cfg)),
        'code_hashes':code_hashes(),'current_update_strengths':selected['current_update_strengths'],
        'feature_fields':list(FIELDS),'feature_transform':'PV count plus event counts / max(PV,1)',
        'split_counts':{'train':876,'validation':424,'holdout':435},'production_training_samples':len(all_samples),
        'current_player_count':len(projections),'current_pool_fingerprint':sha256((Path(root)/'current_players.csv').read_bytes()),
        'current_projection_deterministic_rerun':'PASS',
        'cold_start_previous_season_rows_missing':sum(r['prior_source_PV'] is None for r in projections),
        'confidence_counts':{name:sum(r['confidence']==name for r in projections) for name in ['LOW','MEDIUM']},
        'leakage_assertions':{'certified_features_only':True,'split_overlap':0,'holdout_used_for_selection':False,
            'historical_MV_FM_in_features':False,'market_values_in_model':False,'current_snapshots_in_backtest':False},
        'PROJECTION_READY':True,'prices_calculated':False,'rights_status':'LOCAL_ONLY',
        'warnings':['RETROSPECTIVE_SOURCE_REVISION_RISK',
            'PV measures rated appearances, not minutes/starts or medical availability.',
            'PV times rounded FM is an approximate source fantasy total, not exact league points.',
            'Clean-sheet bonus and defense modifier are unmodeled; current MV is descriptive evidence only.',
            'The baseline event signal omits own-goal penalties because their league coefficient was not established in the scoped rules; source FM is the observed target.',
            'Historical evaluation is conditional on a player existing in both adjacent source seasons; exits and cold starts are not validated.',
            'Five elapsed/33 remaining opportunities are a source-PV proxy, not verified per-team fixtures or transfer exposure.',
            'Current shrinkage is explicit but cannot be historically validated within-season from season aggregates.',
            'Intervals use validation residuals and heuristic current scaling; they are not calibrated live probabilities.',
            'No verified injuries, starts, minutes or tactical/set-piece evidence; role/club only label and rank outputs.',
            'Overall rank is contribution order, not positional scarcity, lineup utility or auction credit value.',
            'Source data and derived predictions remain local; product reuse rights unresolved.']}
    payloads={'projections.csv':csv_bytes(projections),'projections.json':json_bytes(projections),
        'model_parameters.json':json_bytes({'evaluation':evaluation_model,'production':production_model}),
        'selection.json':selection_bytes,'holdout_predictions.csv':csv_bytes(holdout_rows),
        'evaluation.json':json_bytes(evaluation)}
    digest=sha256(json_bytes({k:sha256(v) for k,v in sorted(payloads.items())}))
    ident='fms-2026-09-22-'+digest[:12]
    report={**evaluation,'release_id':ident,'content_sha256':digest,
        'data_as_of':source_report['data_cutoff'],'runtime':selected['runtime']}
    payloads['manifest.json']=json_bytes(report)
    payloads['report.md']=report_markdown(report)
    payloads['checksums.json']=json_bytes({k:sha256(v) for k,v in sorted(payloads.items())})
    write_immutable(Path(output)/ident,payloads)
    Path(reports).mkdir(parents=True,exist_ok=True)
    (Path(reports)/'fm_s_report.json').write_bytes(json_bytes(report))
    (Path(reports)/'fm_s_report.md').write_bytes(payloads['report.md'])
    print(json.dumps({'release':str(Path(output)/ident),'selected':selected['selected'],
        'holdout':held_metrics,'holdout_naive':held_naive,'interval_coverage':report['holdout_interval_coverage'],
        'players':len(projections),'PROJECTION_READY':True},indent=2))


def report_markdown(r):
    lines=['# FM-S projection release','',f"Release: `{r['release_id']}`. Input: `{r['input_release']}`.",
        f"Data as of {r['data_as_of']}. Selected model: **{r['selected_model']['name']}**.",'',
        'Projection unit: remaining source fantavoto-sum proxy. No auction credits.','',
        '## Validation comparisons','', '| Model | Total proxy MAE | PV MAE | FM weighted MAE | Spearman | Top-50 recall |',
        '|---|---:|---:|---:|---:|---:|']
    for name,m in r['validation_comparisons'].items():
        lines.append(f"| {name} | {m['total_proxy_mae']:.4f} | {m['PV_mae']:.4f} | {m['FM_weighted_mae']:.4f} | {m['spearman']:.4f} | {m['top50_recall']:.3f} |")
    lines.extend(['','Train targets 2022/23–2023/24 (876); validation 2024/25 (424); final holdout 2025/26 (435). Only certified previous-season events enter features. MV/FM are target outcomes, never previous-season inputs.',
        '', '## Frozen-selection final holdout','',
        f"Selected: {json.dumps(r['holdout_selected'],sort_keys=True)}",'',
        f"Naive reference: {json.dumps(r['holdout_naive_reference'],sort_keys=True)}",'',
        f"Validation-derived 80% error-band coverage on holdout: {r['holdout_interval_coverage']:.4f}. No selection change followed the holdout result.",
        '', '## Negative controls (validation only)',''])
    for name,m in r['negative_controls']['summaries'].items():
        lines.append(f"- {name}: {m['repeats']} repeats; median total MAE {m['median_total_proxy_mae']:.4f}; median Spearman {m['median_spearman']:.4f}; 95th-percentile Spearman {m['p95_spearman']:.4f}.")
    lines.extend(['',f"Control gate passed: {r['negative_controls']['passed']}.",
        r['negative_controls']['fixed_persistence_note'],'', '## Current forecast and uncertainty','',
        f"All {r['current_player_count']} selectable players ranked within position and overall. Missing previous-season row: {r['cold_start_previous_season_rows_missing']}. Confidence: {r['confidence_counts']}.",
        f"Availability prior strength: {r['current_update_strengths']['availability_equivalent_matches']:.4f} equivalent opportunities; production prior strength: {r['current_update_strengths']['production_equivalent_rated_appearances']} rated appearances.",
        'Current PV updates expected participation with beta-style shrinkage. Current FM updates production by rated-appearance exposure. MV and market quotations/FVM are output-only descriptive evidence/benchmarks.',
        'A fixed selected model is refit on all 1,735 completed historical samples after final holdout evaluation. The current update is not included in historical full-season metrics.',
        '', '## Limitations',''])
    lines.extend('- '+warning for warning in r['warnings'])
    lines.extend(['','## Reproducibility and safety','',
        f"Selection SHA-256: `{r['selection_sha256']}`. Input checksums, model/protocol hashes and deterministic seeds are pinned. No app, Supabase or Second Brain mutation.",
        'Player-level projections, evaluation rows and model parameters remain in ignored local release storage. Only authored code/protocol and aggregate reports are committed.',''])
    return '\n'.join(lines).encode('utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase',choices=['select','release'])
    parser.add_argument('--input-release',type=Path,required=True)
    parser.add_argument('--output-root',type=Path,required=True)
    parser.add_argument('--reports',type=Path,required=True)
    parser.add_argument('--selection',type=Path)
    args=parser.parse_args()
    if args.phase=='select':
        selection_phase(args.input_release,args.output_root,args.reports)
    else:
        if args.selection is None:
            parser.error('--selection required; holdout must follow frozen validation selection')
        release_phase(args.input_release,args.selection,args.output_root,args.reports)


if __name__=='__main__':
    main()
