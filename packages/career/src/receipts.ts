export interface ReceiptDefinition {
  id: string;
  name: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE';
  cosmeticOnly: true;
}

export const PHASE_0_RECEIPTS: readonly ReceiptDefinition[] = [
  { id: 'PAPER_HANDS', name: 'PAPER HANDS', rarity: 'COMMON', cosmeticOnly: true },
  { id: 'SCALE_CONTROL_AUTHORIZED', name: 'SCALE CONTROL AUTHORIZED', rarity: 'UNCOMMON', cosmeticOnly: true },
  { id: 'STOP_LOSS_AUTHORIZED', name: 'STOP LOSS AUTHORIZED', rarity: 'UNCOMMON', cosmeticOnly: true },
  { id: 'RISK_SIZING_AUTHORIZED', name: 'RISK SIZING AUTHORIZED', rarity: 'RARE', cosmeticOnly: true },
];
