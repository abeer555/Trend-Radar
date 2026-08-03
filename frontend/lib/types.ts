export interface LeaderboardRow {
  ticker:               string;
  name:                 string | null;
  sector:               string | null;
  industry:             string | null;
  last_price:           number | null;
  pct_change_1d:        number | null;
  composite_score:      number | null;
  rs_rank:              number | null;
  trend_template_pass:  boolean | null;
  vcp_detected:         boolean | null;
  adx:                  number | null;
  volume_surge:         boolean | null;
  pocket_pivot:         boolean | null;
  week52_high:          number | null;
  week52_low:           number | null;
  high_proximity:       number | null;
  sparkline:            number[];
  scan_date:            string | null;
}

export interface StockDetail {
  ticker:               string;
  name:                 string | null;
  sector:               string | null;
  industry:             string | null;
  last_price:           number | null;
  pct_change_1d:        number | null;
  composite_score:      number | null;

  // Scores
  rs_rank:              number | null;
  rs_score:             number | null;
  momentum_12_1:        number | null;
  momentum_12_1_score:  number | null;
  trend_template_score: number | null;
  trend_template_pass:  boolean | null;
  vcp_detected:         boolean | null;
  vcp_contractions:     number | null;
  vcp_pivot:            number | null;
  vcp_score:            number | null;
  mansfield_stage2:     boolean | null;
  mansfield_rs:         number | null;
  mansfield_score:      number | null;
  high_proximity:       number | null;
  high_proximity_score: number | null;
  frog_in_pan:          number | null;
  frog_in_pan_score:    number | null;
  risk_adj_momentum:    number | null;
  risk_adj_score:       number | null;
  volume_surge:         boolean | null;
  pocket_pivot:         boolean | null;
  volume_score:         number | null;
  adx:                  number | null;
  adx_score:            number | null;

  // Technicals
  rsi:                  number | null;
  macd:                 number | null;
  macd_signal:          number | null;
  stoch_k:              number | null;
  stoch_d:              number | null;
  atr:                  number | null;
  bb_upper:             number | null;
  bb_lower:             number | null;
  ma50:                 number | null;
  ma150:                number | null;
  ma200:                number | null;

  // Human-readable reads
  rsi_read:             string;
  macd_read:            string;
  stoch_read:           string;
  atr_read:             string;
  adx_read:             string;

  // Fundamentals
  pe_ratio:             number | null;
  pb_ratio:             number | null;
  ev_ebitda:            number | null;
  revenue_growth:       number | null;
  earnings_growth:      number | null;
  debt_equity:          number | null;
  roe:                  number | null;
  gross_margin:         number | null;
  market_cap:           number | null;

  // Risk
  beta:                 number | null;
  volatility:           number | null;
  max_drawdown:         number | null;
  sharpe:               number | null;
  suggested_stop:       number | null;
  risk_label:           "Low" | "Medium" | "High" | "Unknown" | null;

  // 52-week
  week52_high:          number | null;
  week52_low:           number | null;

  // Composite attribution
  top_factors:          TopFactor[];
  entry_signal:         EntrySignal;
  trend_template_criteria: Record<string, boolean | null>;

  sparkline:            number[];
}

export interface TopFactor {
  factor:       string;
  key:          string;
  raw_score:    number;
  weight:       number;
  contribution: number;
}

export interface EntrySignal {
  label:          "Breakout" | "Extended" | "Setup forming" | "Watch" | "No setup";
  reason:         string;
  entry:          string;
  disclaimer:     string;
  pivot?:         number | null;
  pivot_cleared?: boolean;
}

export interface ChartCandle {
  time:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface ChartPoint {
  time:  string;
  value: number | null;
}

export interface ChartData {
  candles:  ChartCandle[];
  ma50:     ChartPoint[];
  ma150:    ChartPoint[];
  ma200:    ChartPoint[];
  bb_upper: ChartPoint[];
  bb_lower: ChartPoint[];
  bb_mid:   ChartPoint[];
}

export type SortField =
  | "composite_score"
  | "rs_rank"
  | "last_price"
  | "pct_change_1d"
  | "adx"
  | "high_proximity"
  | "trend_template_score";
