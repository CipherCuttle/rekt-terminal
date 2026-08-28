import type { CapabilityId, SkillId } from './types.js';

export const STARTING_SKILL: SkillId = 'SPOT_BASIC';
export const STARTING_CAPABILITIES: readonly CapabilityId[] = ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL'];
export const SCALE_CONTROL_CAPABILITIES: readonly CapabilityId[] = ['SCALE_IN', 'PARTIAL_EXIT'];

export function capabilitiesForSkill(skill: SkillId): readonly CapabilityId[] {
  if (skill === 'SPOT_BASIC') return STARTING_CAPABILITIES;
  if (skill === 'SCALE_CONTROL') return SCALE_CONTROL_CAPABILITIES;
  return [];
}
