// Volume Momentum Alert Engine
// Implements the decision logic from the specification:
//   - Liquidity rule (min avg daily volume)
//   - Trend detection via fast/slow MA crossover
//   - Volume confirmation (volume_ratio >= threshold)
//   - RSI overbought/oversold filters
//   - ATR-based stop-loss and position sizing
//   - Risk management caps (daily loss, weekly loss, holding days)
//
// No look-ahead bias: every indicator uses only data at or before the
// decision bar. The engine evaluates the *latest* bar by default.

import type { Candle, VolumeAlert, VolumeScannerSettings, ActionType, SignalType, FlagType } from "./types";
import { sma, rsi as rsiCalc, atr as atrCalc, bollingerBands } from "./indicators";

export function evaluateTicker(
  ticker: string,
  candles: Candle[],
  settings: VolumeScannerSettings
): VolumeAlert {
  const disclaimer = "Educational screening signal only; not investment advice.";

  if (candles.length < Math.max(settings.slowMaPeriod, 60)) {
    return {
      ticker,
      date: candles[candles.length - 1]?.date ?? "",
      action: "NO_TRADE",
      signal_type: "no_trend",
      message: "Insufficient data to compute indicators.",
      close: candles[candles.length - 1]?.close ?? 0,
      fast_ma: null,
      slow_ma: null,
      rsi: null,
      volume_ratio: null,
      avg_daily_volume_20d: null,
      suggested_stop: null,
      suggested_target: null,
      suggested_position_size: null,
      risk_reward_ratio: null,
      flags: [],
      risk_checks_passed: false,
      disclaimer,
      atr: null,
      change_pct: null,
      volume: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const fastMaArr = sma(closes, settings.fastMaPeriod);
  const slowMaArr = sma(closes, settings.slowMaPeriod);
  const rsiArr = rsiCalc(closes, settings.rsiPeriod);
  const atrArr = atrCalc(candles, settings.atrPeriod);
  const volMaArr = sma(volumes, settings.volumeMaPeriod);
  const bb = bollingerBands(closes, settings.bollingerPeriod, settings.bollingerStdDev);

  const idx = candles.length - 1;
  const prevIdx = idx - 1;

  const close = closes[idx];
  const prevClose = closes[prevIdx];
  const fastMa = fastMaArr[idx];
  const slowMa = slowMaArr[idx];
  const prevFastMa = fastMaArr[prevIdx];
  const prevSlowMa = slowMaArr[prevIdx];
  const rsiVal = rsiArr[idx];
  const atrVal = atrArr[idx];
  const volMa = volMaArr[idx];
  const volume = volumes[idx];
  const bbUpper = bb.upper[idx];

  const avgDailyVolume20d = volMa;
  const volumeRatio = volMa && volMa > 0 ? volume / volMa : null;
  const changePct = prevClose ? ((close - prevClose) / prevClose) * 100 : null;

  const flags: FlagType[] = [];

  // Liquidity check
  const liquid = avgDailyVolume20d != null && avgDailyVolume20d >= settings.minAvgDailyVolume;
  if (!liquid) flags.push("low_liquidity");

  // Trend detection
  const uptrend = fastMa != null && slowMa != null && fastMa > slowMa;
  const downtrend = fastMa != null && slowMa != null && fastMa < slowMa;

  // Golden/death cross detection (no look-ahead: compare current vs prior bar)
  const goldenCross =
    fastMa != null && slowMa != null && prevFastMa != null && prevSlowMa != null &&
    fastMa > slowMa && prevFastMa <= prevSlowMa;
  const deathCross =
    fastMa != null && slowMa != null && prevFastMa != null && prevSlowMa != null &&
    fastMa < slowMa && prevFastMa >= prevSlowMa;

  // MA tolerance for "no trend" — if MAs are within tolerance %, no clear trend
  const maDiff = fastMa != null && slowMa != null ? Math.abs(fastMa - slowMa) / slowMa * 100 : 100;
  const noTrend = maDiff < settings.maTolerancePct && !goldenCross && !deathCross;

  // Volume confirmation
  const upVolumeConfirm =
    close > prevClose && volumeRatio != null && volumeRatio >= settings.volumeRatioThreshold;
  const downVolumeConfirm =
    close < prevClose && volumeRatio != null && volumeRatio >= settings.volumeRatioThreshold;

  // Volume fade: price moved but volume below average
  const volumeFade =
    Math.abs(close - prevClose) > 0.001 &&
    volumeRatio != null && volumeRatio < settings.volumeRatioThreshold;

  if (volumeFade) flags.push("volume_fading");

  // RSI flags
  if (rsiVal != null && rsiVal > settings.rsiOverbought) flags.push("overbought");
  if (rsiVal != null && rsiVal < settings.rsiOversold) flags.push("oversold");

  // Bollinger overextended
  if (bbUpper != null && close > bbUpper) flags.push("overextended");

  // ── Decision logic ──────────────────────────────────────────

  let action: ActionType = "NO_TRADE";
  let signalType: SignalType = "no_trend";
  let message = "";
  let suggestedStop: number | null = null;
  let suggestedTarget: number | null = null;
  let suggestedPositionSize: number | null = null;
  let riskRewardRatio: number | null = null;

  if (!liquid) {
    action = "NO_TRADE";
    signalType = "low_liquidity";
    message = `Average daily volume (${formatNum(avgDailyVolume20d)}) is below the minimum threshold of ${formatNum(settings.minAvgDailyVolume)}; ticker is not liquid enough for momentum trading.`;
  } else if (noTrend) {
    action = "NO_TRADE";
    signalType = "no_trend";
    message = `Fast MA (${formatNum(fastMa)}) and Slow MA (${formatNum(slowMa)}) are within ${settings.maTolerancePct}% of each other; no clearly established trend.`;
  } else if (volumeFade) {
    action = "NO_TRADE";
    signalType = "volume_fade";
    const direction = changePct != null ? (changePct > 0 ? "up" : "down") : "sideways";
    message = `Price moved ${direction} but volume ratio (${volumeRatio?.toFixed(2)}) is below the confirmation threshold of ${settings.volumeRatioThreshold}; momentum not confirmed.`;
  } else {
    // Check for conflict: trend says one thing but RSI extreme says opposite
    const conflictLong =
      uptrend && rsiVal != null && rsiVal > settings.rsiOverbought && close < (slowMa ?? 0);
    const conflictShort =
      downtrend && rsiVal != null && rsiVal < settings.rsiOversold && close > (slowMa ?? 0);

    // ── LONG conditions ──
    const longTrendOk = goldenCross || (uptrend && close > (slowMa ?? 0));
    const longRsiOk = settings.allowOverboughtLongs || (rsiVal != null && rsiVal <= settings.rsiOverbought);

    if (longTrendOk && upVolumeConfirm && longRsiOk && !conflictLong) {
      action = "LONG";
      signalType = goldenCross ? "golden_cross" : "uptrend";
      suggestedStop = close - settings.atrMultiplierForStop * (atrVal ?? 0);
      const riskPerShare = close - suggestedStop;
      if (riskPerShare > 0) {
        const riskAmount = settings.accountEquity * (settings.riskPerTradePct / 100);
        suggestedPositionSize = Math.floor(riskAmount / riskPerShare);
        riskRewardRatio = 2.0;
        suggestedTarget = close + riskPerShare * 2; // 1:2 risk-reward
      }
      const overboughtNote = rsiVal != null && rsiVal > settings.rsiOverbought ? " (RSI overbought — momentum may be extended)" : "";
      message = `${goldenCross ? "Golden cross detected" : "Uptrend confirmed"} with fast MA above slow MA and volume expanding (${volumeRatio?.toFixed(2)}× average). Enter early with stop at ₹${formatNum(suggestedStop)}.${overboughtNote}`;
    }
    // ── SHORT conditions ──
    else if ((deathCross || (downtrend && close < (slowMa ?? 0))) && downVolumeConfirm && (settings.allowOversoldShorts || (rsiVal != null && rsiVal >= settings.rsiOversold)) && !conflictShort) {
      action = "SHORT";
      signalType = deathCross ? "death_cross" : "downtrend";
      suggestedStop = close + settings.atrMultiplierForStop * (atrVal ?? 0);
      const riskPerShare = suggestedStop - close;
      if (riskPerShare > 0) {
        const riskAmount = settings.accountEquity * (settings.riskPerTradePct / 100);
        suggestedPositionSize = Math.floor(riskAmount / riskPerShare);
        riskRewardRatio = 2.0;
        suggestedTarget = close - riskPerShare * 2; // 1:2 risk-reward
      }
      const oversoldNote = rsiVal != null && rsiVal < settings.rsiOversold ? " (RSI oversold — downside may be exhausted)" : "";
      message = `${deathCross ? "Death cross detected" : "Downtrend confirmed"} with fast MA below slow MA and volume expanding (${volumeRatio?.toFixed(2)}× average). Enter short with stop at ₹${formatNum(suggestedStop)}.${oversoldNote}`;
    }
    // ── Conflict ──
    else if (conflictLong || conflictShort) {
      action = "NO_TRADE";
      signalType = "conflict";
      message = conflictLong
        ? `Uptrend present but RSI is extremely overbought (${rsiVal?.toFixed(1)}) and price has broken below the slow MA; signals conflict.`
        : `Downtrend present but RSI is extremely oversold (${rsiVal?.toFixed(1)}) and price has broken above the slow MA; signals conflict.`;
    }
    // ── No volume confirmation on a trending bar ──
    else if ((uptrend || downtrend) && !upVolumeConfirm && !downVolumeConfirm) {
      action = "NO_TRADE";
      signalType = "volume_fade";
      message = `Trend is present but the latest bar's volume does not confirm the move (volume ratio ${volumeRatio?.toFixed(2)}); waiting for volume confirmation.`;
    } else {
      action = "NO_TRADE";
      signalType = "no_trend";
      message = "No actionable signal: trend and volume conditions not simultaneously met.";
    }
  }

  // Risk checks
  const riskChecksPassed =
    settings.riskPerTradePct >= 1 && settings.riskPerTradePct <= 3 &&
    settings.dailyLossCapPct <= 10 &&
    settings.weeklyLossCapPct <= 15 &&
    settings.atrMultiplierForStop >= 1;

  return {
    ticker,
    date: candles[idx].date,
    action,
    signal_type: signalType,
    message,
    close,
    fast_ma: fastMa,
    slow_ma: slowMa,
    rsi: rsiVal,
    volume_ratio: volumeRatio,
    avg_daily_volume_20d: avgDailyVolume20d,
    suggested_stop: suggestedStop,
    suggested_target: suggestedTarget,
    suggested_position_size: suggestedPositionSize,
    risk_reward_ratio: riskRewardRatio,
    flags,
    risk_checks_passed: riskChecksPassed,
    disclaimer,
    atr: atrVal,
    change_pct: changePct,
    volume,
  };
}

export function evaluateWatchlist(
  candlesByTicker: Map<string, Candle[]>,
  settings: VolumeScannerSettings
): VolumeAlert[] {
  const alerts: VolumeAlert[] = [];
  for (const [ticker, candles] of candlesByTicker) {
    alerts.push(evaluateTicker(ticker, candles, settings));
  }
  return alerts.sort((a, b) => {
    const order: Record<ActionType, number> = { LONG: 0, SHORT: 1, NO_TRADE: 2 };
    return order[a.action] - order[b.action];
  });
}

function formatNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
