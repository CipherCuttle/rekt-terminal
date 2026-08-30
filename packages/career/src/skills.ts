import type { CapabilityId, SkillId } from './types.js';

export const STARTING_SKILL: SkillId = 'SPOT_BASIC';
export const STARTING_CAPABILITIES: readonly CapabilityId[] = ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL'];
export const SCALE_CONTROL_CAPABILITIES: readonly CapabilityId[] = ['SCALE_IN', 'PARTIAL_EXIT'];
export const STOP_LOSS_CAPABILITIES: readonly CapabilityId[] = ['STOP_MARKET'];
export const RISK_SIZING_CAPABILITIES: readonly CapabilityId[] = ['CUSTOM_POSITION_SIZE', 'RISK_PERCENT_SIZING'];
export const MARGIN_2X_CAPABILITIES: readonly CapabilityId[] = ['PERP_LONG_2X'];

export function capabilitiesForSkill(skill: SkillId): readonly CapabilityId[] {
  if (skill === 'SPOT_BASIC') return STARTING_CAPABILITIES;
  if (skill === 'SCALE_CONTROL') return SCALE_CONTROL_CAPABILITIES;
  if (skill === 'STOP_LOSS') return STOP_LOSS_CAPABILITIES;
  if (skill === 'RISK_SIZING') return RISK_SIZING_CAPABILITIES;
  if (skill === 'MARGIN_2X') return MARGIN_2X_CAPABILITIES;
  return [];
}
