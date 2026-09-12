export type ShowcaseCollection = 'REKT INK' | 'CHIBI HOOD';

export type ShowcaseToken = {
  collection: ShowcaseCollection;
  tokenId: string;
  rarityRank: number | null;
  lastSaleUsd: number | null;
  bestOfferUsd: number | null;
  role: 'RARITY' | 'RARITY + MARKET' | 'VISUAL COMBO' | 'MARKET WILDCARD';
  note: string;
  href: string;
};

const REKT_CONTRACT = '0x25aa78ab6785a4b0aeff5c170998992fd958d43d';
const CHIBI_CONTRACT = '0x4b712c60e11938b1026b8f5158e7e7f5b467302b';

const rektHref = (tokenId: string) => `https://opensea.io/item/ink/${REKT_CONTRACT}/${tokenId}`;
const chibiHref = (tokenId: string) => `https://opensea.io/item/robinhood/${CHIBI_CONTRACT}/${tokenId}`;

export const showcase15: ShowcaseToken[] = [
  {collection: 'REKT INK', tokenId: '249', rarityRank: 98, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'Pedigree anchor.', href: rektHref('249')},
  {collection: 'REKT INK', tokenId: '1521', rarityRank: 337, lastSaleUsd: 94.94, bestOfferUsd: 80.42, role: 'RARITY + MARKET', note: 'Elite rarity with market confirmation.', href: rektHref('1521')},
  {collection: 'REKT INK', tokenId: '602', rarityRank: 755, lastSaleUsd: 116.37, bestOfferUsd: 40.46, role: 'RARITY + MARKET', note: 'Top-1k with a premium historical sale.', href: rektHref('602')},
  {collection: 'REKT INK', tokenId: '2040', rarityRank: 983, lastSaleUsd: 84.07, bestOfferUsd: 83.93, role: 'RARITY + MARKET', note: 'Rarity and market signal agree.', href: rektHref('2040')},
  {collection: 'REKT INK', tokenId: '3385', rarityRank: 1046, lastSaleUsd: null, bestOfferUsd: 87.25, role: 'RARITY + MARKET', note: 'Strong offer signal.', href: rektHref('3385')},
  {collection: 'REKT INK', tokenId: '2347', rarityRank: 1093, lastSaleUsd: 96.56, bestOfferUsd: 26.81, role: 'RARITY + MARKET', note: 'Market-confirmed depth pick.', href: rektHref('2347')},
  {collection: 'REKT INK', tokenId: '2564', rarityRank: 1172, lastSaleUsd: 45.89, bestOfferUsd: 47.94, role: 'VISUAL COMBO', note: 'Neon / Fireworks / Psychosis / Twirl / Joker.', href: rektHref('2564')},
  {collection: 'REKT INK', tokenId: '4422', rarityRank: 1406, lastSaleUsd: 115.16, bestOfferUsd: 41.57, role: 'VISUAL COMBO', note: 'Neon / Avatar / Digital / Gun / Super Smile.', href: rektHref('4422')},
  {collection: 'CHIBI HOOD', tokenId: '4712', rarityRank: 347, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'Primary Chibi rarity anchor.', href: chibiHref('4712')},
  {collection: 'CHIBI HOOD', tokenId: '4715', rarityRank: 1045, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'High-rarity Chibi anchor.', href: chibiHref('4715')},
  {collection: 'CHIBI HOOD', tokenId: '4714', rarityRank: 1351, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'High-rarity Chibi anchor.', href: chibiHref('4714')},
  {collection: 'CHIBI HOOD', tokenId: '4718', rarityRank: 1654, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'Rare Chibi depth pick.', href: chibiHref('4718')},
  {collection: 'CHIBI HOOD', tokenId: '6586', rarityRank: 2407, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY', note: 'Secondary rarity pick.', href: chibiHref('6586')},
  {collection: 'CHIBI HOOD', tokenId: '6027', rarityRank: 4921, lastSaleUsd: null, bestOfferUsd: null, role: 'RARITY + MARKET', note: 'Rarity depth with sale history.', href: chibiHref('6027')},
  {collection: 'CHIBI HOOD', tokenId: '3095', rarityRank: null, lastSaleUsd: 3.23, bestOfferUsd: null, role: 'MARKET WILDCARD', note: 'Recent above-floor market wildcard.', href: chibiHref('3095')},
];

export const showcaseByCollection = {
  'REKT INK': showcase15.filter((token) => token.collection === 'REKT INK'),
  'CHIBI HOOD': showcase15.filter((token) => token.collection === 'CHIBI HOOD'),
} as const;
