"""Read-only FL1 browser-session bridge. Never exports session credentials."""
import json
import sys
from playwright.sync_api import sync_playwright

SCRIPT = r"""async () => {
  let token = localStorage.getItem('access_token') || localStorage.getItem('id_token');
  if (!token) { try { token = JSON.parse(localStorage.getItem('auth_tokens') || '{}').access_token; } catch {} }
  if (!token) throw new Error('FantaLab session unavailable');
  const post = async (path, body) => {
    const r = await fetch('https://api.fantalab.it/v2/' + path, {method:'POST', headers:{'content-type':'application/json', authorization:'Bearer ' + token}, body:JSON.stringify(body)});
    if (!r.ok) throw new Error('FantaLab request failed');
    return r.json();
  };
  const publicData = await post('strategy/public', {});
  const strategies = Array.isArray(publicData) ? publicData : (publicData.data || publicData.strategies);
  if (!Array.isArray(strategies)) throw new Error('Unknown strategy response');
  const creator = s => typeof s.app_user === 'string' ? s.app_user : (s.app_user?.display_name || s.app_user?.name || s.app_user?.username || s.app_user?.full_name);
  const matches = strategies.filter(s => creator(s) === 'SOS Fanta' && s.season === 's_26_27' && s.strategy_type === 'classic' && s.players_list === 'serie-a');
  if (matches.length !== 1) throw new Error('SOS Classic strategy discovery ambiguous or unavailable');
  const s = matches[0];
  const r = await fetch('https://api.fantalab.it/v2/listone');
  if (!r.ok) throw new Error('Listone unavailable');
  const list = await r.json();
  const data = await post('player-strategy', {strategy_id:s.strategy_id});
  const rows = Array.isArray(data) ? data : (data.data || data.players);
  if (!Array.isArray(rows) || !Array.isArray(list.players)) throw new Error('Unknown player response');
  return {checkedAt:new Date().toISOString(), listoneVersion:list.version, listoneSeason:list.season,
    strategy:{id:s.strategy_id, name:s.strategy_name, creator:creator(s), season:s.season, format:s.strategy_type, list:s.players_list, credits:s.credits, tierMapping:s.custom_fasce},
    listone:list.players.map(p => ({player_id:p.player_id, fantacalcio_id:p.fantacalcio_id, injured:p.injured})),
    rows:rows.map(p => ({player_id:p.player_id, strategy_id:p.strategy_id, fascia:p.fascia, fascia_second:p.fascia_second, fascia_third:p.fascia_third, price:p.price, perc_price:p.perc_price, notes:p.notes, target:p.target}))};
}"""

try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp('http://127.0.0.1:9223')
        page = next(page for context in browser.contexts for page in context.pages
                    if page.url.startswith('https://app.fantalab.it/'))
        result = page.evaluate(SCRIPT)
        browser.close()
        print(json.dumps(result, ensure_ascii=True))
except Exception:
    # Browser errors can contain request details. Never print the underlying error.
    print('Local FantaLab session unavailable or source validation failed. Reopen the FL1 signed-in browser.', file=sys.stderr)
    sys.exit(1)
