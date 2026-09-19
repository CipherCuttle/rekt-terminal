# REKT INKUBATOR — STAGE J4 SWEDEN / EU PRODUCTION LEGAL MATRIX V1

**Status:** RESEARCHED / COUNSEL DECISION REQUIRED / PRODUCTION MONEY BLOCKED  
**Date:** 2026-09-19  
**Scope:** Swedish/EU production-readiness classification for the first capped REKT Inkubator Challenge  
**Technical audit code scope:** repaired and frozen at `56eaa98497f4c036227c7e2512dadeb640eacfe4`  
**Legal approval:** NOT GRANTED  
**Production-money authority:** NONE

This document records the current legal/regulatory questions that must be resolved before production money. It is a counsel handoff, not legal advice or a claim of compliance. The runtime-identity repair changed release/deployment attestation only; it did not change the product facts that counsel must classify.

## 1. Product facts counsel must classify

The first capped candidate presently assumes:

- a Challenge is funded in native Circle USDC on Ink;
- funds sit in an immutable, non-upgradeable per-Challenge smart contract;
- no platform fee exists in the first candidate;
- no platform/admin sweep exists;
- participants submit work against frozen Challenge rules;
- objective qualification precedes organizer selection;
- winner/recipient selection is based on performance/rules, not random draw;
- payout recipients are frozen before BUILDING;
- settlement is constrained by immutable contract law;
- deterministic post-deadline fallback is permissionless;
- the ordinary web/API runtime has no production settlement private key;
- an isolated outcome signer and immutable 2-of-3 ERC-1271 resolver provide bounded attestations/recovery;
- the platform does not offer exchange, trading, portfolio management, yield, swap, bridge or arbitrary token routing.

Any product change to these facts can change the classification.

## 2. Gambling / competition law — current evidence

Sweden's Spelinspektionen states that competitions in which the winner is determined by a performance element, without lottery/randomness, are outside the Gambling Act and instead fall under Consumer Agency supervision.

Authority:

- https://www.spelinspektionen.se/licens-o-tillstand/sok-licens/lotterier/lotterier-och-andra-spel-som-inte-behover-licens-eller-kommunal-registrering/
- https://www.spelinspektionen.se/spelare/spelform/nar-kravs-det-inte-licens/

### Current product implication

The frozen Inkubator design is deliberately performance/rule based and contains no random winner selection.

**Preliminary risk direction:** this supports treatment as a competition rather than gambling.

**Counsel gate:** confirm that:
1. no product mechanic, tie-break, allocation or promotional mechanic introduces legally relevant randomness;
2. organizer subjective selection among objective qualifiers still remains a performance competition;
3. any entry fee or future platform fee would not change the analysis;
4. cross-border participation does not create a different gambling/licensing result.

Do not market the product as gambling, betting, lottery, jackpot or chance-based.

## 3. MiCA CASP classification — primary unresolved regulatory fork

Finansinspektionen states that, as a general rule, authorization is required to professionally provide crypto-asset services. The listed services include custody/administration, execution of orders and transfer services on behalf of clients.

Authority:

- https://www.fi.se/sv/betalningar/sok-tillstand/kryptotillgangar-och-kryptotillgangstjanster/kryptotillgangstjanster/
- Regulation (EU) 2023/1114, Article 3: https://eur-lex.europa.eu/eli/reg/2023/1114
- MiCA Article 75 custody: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-75-providing-custody-and
- MiCA Article 82 transfer services: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-82-providing-transfer-services

### Counsel must answer

Does operating Inkubator as described constitute, on a professional basis:

- **custody and administration of crypto-assets on behalf of clients**, despite assets being locked in immutable non-upgradeable smart contracts and the platform having no unilateral withdrawal/sweep authority;
- **transfer services for crypto-assets on behalf of clients**, because the platform supplies the settlement system and participates in bounded authorization;
- **execution of orders on behalf of clients**, or is there no client order/execution relationship;
- another MiCA crypto-asset service;
- or provision of non-custodial software/competition infrastructure outside those service definitions.

This is a **launch-blocking classification question**. Technical non-custody language must not be used as a substitute for legal classification.

If Inkubator is a CASP, authorization, governance, complaints, safeguarding, conflicts, outsourcing and AML/CFT obligations become a materially larger launch program.

FI currently states a minimum annual supervision fee of SEK 150,000 for CASPs, in addition to application fees.

## 4. USDC / EMT / PSD2 interaction

Circle's current EEA MiCA white paper classifies USDC as an e-money token (EMT). Circle France is also authorized as an electronic-money institution and, since April 2026, as a CASP for custody/transfer services relating to USDC/EURC.

Authorities:

- https://www.circle.com/legal/mica-usdc-whitepaper
- https://www.circle.com/legal/eea-terms
- https://www.circle.com/blog/circle-france-receives-approval-to-offer-crypto-asset-services-under-mica

The EBA has separately addressed the interaction between MiCA and PSD2 for CASPs transacting EMTs that qualify as payment services.

Authority:

- https://www.eba.europa.eu/publications-and-media/press-releases/eba-advises-national-authorities-actions-take-end-transition-period-under-its-no-action-letter

### Counsel must answer

If Inkubator activity is a MiCA crypto-asset service involving USDC, does any part also constitute a payment service involving an EMT under PSD2 / Swedish payment-services law?

Do not assume “crypto under MiCA” eliminates payment-services analysis.

## 5. AML / sanctions / Travel Rule

Regulation (EU) 2023/1113 governs information accompanying certain crypto-asset transfers and is in force:

- https://eur-lex.europa.eu/eli/reg/2023/1113

ESMA's June 2026 transition statement also emphasizes AML/CFT onboarding and transfer-traceability obligations for MiCA-authorized CASPs.

Authority:

- https://www.esma.europa.eu/sites/default/files/2026-06/ESMA75-113276571-1710_Public_Statement_MiCA_transitional_period_ends.pdf

### Counsel gate

Determine whether Inkubator is an obliged entity / CASP and, if so, identify exact requirements for:

- customer due diligence;
- beneficial-owner checks for entities;
- sanctions screening;
- source-of-funds / enhanced due diligence thresholds;
- Travel Rule data collection/transmission;
- suspicious-activity reporting;
- record retention.

If Inkubator is not a CASP/obliged entity, separately determine what sanctions screening and contractual controls are still required.

## 6. Prize income / reporting

Skatteverket states that performance-based competition prizes are ordinarily taxable for the recipient; money prizes are taxable from the first krona in the cited guidance.

Authorities:

- https://www.skatteverket.se/privat/skatter/arbeteochinkomst/inkomster/vinsterispelochtavlingar
- https://www4.skatteverket.se/rattsligvagledning/edition/2026.6/364826.html

### Counsel/accounting gate

Determine:

- whether the Challenge organizer/platform has Swedish reporting or withholding obligations;
- how payouts to Swedish natural persons, sole traders and companies differ;
- treatment of non-Swedish winners;
- valuation/reporting date for USDC;
- bookkeeping evidence required for organizer deposits, refunds and prizes.

Terms must tell participants that tax treatment may apply without presenting personalized tax advice.

## 7. VAT / prize versus procured service

Skatteverket states that prize money conditioned only on placement is generally not consideration for a supplied service for VAT purposes. It also states that where competition entries function like bids/tenders and the winner is expected to provide a service or rights, the “prize” can instead form part of consideration for a taxable supply.

Authority:

- https://www4.skatteverket.se/rattsligvagledning/edition/2026.10/440612.html

### Product-critical counsel/accounting question

REKT Inkubator may sit close to this boundary because a Challenge can produce software/work product and may involve IP rights.

Before launch freeze:

- define whether winning transfers/licenses IP;
- define whether any post-win delivery obligation exists;
- define whether the prize is purely for placement/performance or is consideration for a procured deliverable;
- define invoicing/VAT treatment for business participants;
- prevent product copy from contradicting the chosen legal/tax structure.

## 8. Consumer / marketing / terms

Performance competitions are supervised outside the Gambling Act by consumer authorities. Konsumentverket states that commercial claims must be truthful, provable and non-misleading, and that paid services/agreements must be clearly disclosed.

Authorities:

- https://www.konsumentverket.se/marknadsratt-foretag/marknadsforingslagen-for-foretag/
- https://www.konsumentverket.se/konsumentratt/regler-for-reklam/

Required launch work:

- clear organizer identity;
- clear eligibility;
- exact judging/qualification rules;
- exact prize and asset;
- deadlines and fallback/refund law;
- fees = zero for the first candidate unless changed through a new reviewed version;
- IP/license terms;
- dispute/contact process;
- material Circle/USDC issuer-control risks;
- no unsupported “safe”, “guaranteed”, “escrow”, “audited” or affiliation claims.

## 9. Privacy / DPIA

The technical contract intentionally keeps public-chain evidence opaque and excludes obvious personal identifiers, but the application still processes GitHub/account/submission/operator data.

GDPR Article 35 requires a DPIA where planned processing, especially using new technology, is likely to create high risk.

Authority:

- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/dataskyddsforordningen-i-fulltext/

Before external-human production:

- inventory personal data and public-chain linkability;
- identify controller/processors;
- lawful bases;
- retention/deletion;
- data-subject rights;
- cross-border processors/transfers;
- incident process;
- determine and document whether DPIA is required;
- if required, complete it before processing begins.

## 10. Eligibility / entity policy

Before production, freeze:

- minimum age;
- natural person vs company eligibility;
- excluded jurisdictions;
- sanctioned/restricted persons;
- employee/affiliate conflicts;
- organizer self-dealing rules;
- whether organizer and participant may share beneficial ownership;
- KYC/KYB trigger if legally required.

## 11. Counsel decision table

| Question | Current technical direction | Launch state |
| --- | --- | --- |
| Gambling license | performance-only, no random selection | COUNSEL CONFIRM |
| MiCA CASP | immutable constrained vault; no unilateral platform sweep | **OPEN / HIGH PRIORITY** |
| PSD2 / EMT payment service | native USDC is an EMT in EEA | **OPEN / HIGH PRIORITY** |
| AML / Travel Rule | depends materially on service classification | OPEN |
| Prize income/reporting | participant tax likely relevant | OPEN |
| VAT | depends on prize-vs-procurement/IP structure | **OPEN / PRODUCT-CRITICAL** |
| Consumer/terms | clear terms and claims required | OPEN |
| Privacy/DPIA | data minimization implemented technically | OPEN |
| Age/entity/jurisdiction | not yet frozen | OPEN |

## 12. Legal acceptance gate

Production-money authority remains blocked until a qualified Swedish/EU lawyer and accountant, as applicable, answer at minimum:

1. Is the exact first-candidate activity a MiCA crypto-asset service? Which one(s), if any)?
2. Does USDC settlement create a PSD2/payment-services authorization issue?
3. What AML/Travel Rule/sanctions duties follow?
4. Is the Challenge outside the Gambling Act under the exact selection rules?
5. Is the payout a competition prize, service consideration, or dependent on Challenge/IP structure?
6. What reporting/withholding/VAT/invoicing duties apply?
7. What consumer terms/marketing restrictions are mandatory?
8. Is a DPIA required?
9. What participant/jurisdiction/age/entity restrictions are required?

Until written answers are recorded:

```text
LEGAL_GATE = OPEN
MICA_CASP_CLASSIFICATION = UNRESOLVED
PSD2_EMT_CLASSIFICATION = UNRESOLVED
AML_TRAVEL_RULE = DEPENDS_ON_CLASSIFICATION
GAMBLING_CLASSIFICATION = PERFORMANCE_COMPETITION_DIRECTION / COUNSEL_CONFIRM
TAX_VAT_ACCOUNTING = OPEN
PRIVACY_DPIA = OPEN
PRODUCTION_MONEY = NOT_AUTHORIZED
```
