# Security V1

- No private keys or signing paths.
- No `dangerouslySetInnerHTML` for token metadata.
- External image URLs are not trusted; production should proxy/sanitize token/NFT media.
- Provider responses are validated/bounded before being promoted to canonical models.
- Wallet enrichment is read-only.
- React Bits Pro key stays local only.
