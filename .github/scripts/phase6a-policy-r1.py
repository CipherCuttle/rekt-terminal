from pathlib import Path
p=Path('.github/scripts/phase6a-ship-verifier.py')
s=p.read_text()
s=s.replace("['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['100::', 64], ['2001:db8::', 32],", "['::', 128], ['::1', 128], ['100::', 64], ['2001:db8::', 32],")
s=s.replace("  const actual = isIP(address.address);\n  if (actual !== address.family) return false;\n  return !block.check(address.address, address.family === 4 ? 'ipv4' : 'ipv6');", "  const actual = isIP(address.address);\n  if (actual !== address.family) return false;\n  if (address.family === 6 && address.address.toLowerCase().startsWith('::ffff:')) return false;\n  return !block.check(address.address, address.family === 4 ? 'ipv4' : 'ipv6');")
if s==p.read_text(): raise SystemExit('policy repair markers not found')
p.write_text(s)
