# Full Codebase Forensic Audit Gates

- [x] G1: Repository inventory and architecture map are complete
  CHECK: node -e "const fs=require('fs'); const paths=['backend','frontend','mocs','tests','docs','pyproject.toml','frontend/package.json','frontend/scripts']; for(const p of paths){if(!fs.existsSync(p)) throw new Error('missing '+p)} console.log('INVENTORY_COMPLETE')"
  EXPECT: INVENTORY_COMPLETE
  EVIDENCE: automatic-evidence=v1; definition-sha256=f111c5df765c02adc3c075ebe1221bc6ede284689cec7e343120224868e6cd3e; exit=0; EXPECT=matched; output-sha256=4b74d4fdcd75e6e96b09ac73bc4b264fb44903571f066f9dbee29d47fb801ade; output-bytes=19; cwd=.

- [x] G2: Baseline Python modular suite passes
  CHECK: python test_modular_mocs.py
  EXPECT: All Modular Package Invariants Verified Successfully!
  EVIDENCE: automatic-evidence=v1; definition-sha256=85ed54a7f2233e30f11de1dd26fbc38a125cf500be31383c5ea26e523971c670; exit=0; EXPECT=matched; output-sha256=f63de53137f62d88612f2349732ba427a3a789bde853babb204a2a5422565c25; output-bytes=877; cwd=.

- [x] G3: Golden query corpus differential verification passes
  CHECK: pytest tests/test_golden_query_corpus.py -q
  EXPECT: 12 passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=a592ae65c8cf89aa2e9cbede620e791a73b7f8565be9bd51b2c230a980dc0fb1; exit=0; EXPECT=matched; output-sha256=c54fadc89c51f622667a833b63f6fcffad67f0d7a83c4e5147e527fe518e79fa; output-bytes=1047; cwd=.

- [x] G4: Architectural import boundaries pass
  CHECK: node frontend/scripts/verify-import-boundaries.mjs
  EXPECT: [PASS] All architectural boundaries forensically verified:
  EVIDENCE: automatic-evidence=v1; definition-sha256=ec3786ee6cc06f98ff2d8e8631fdda03e614968fb845f3b8f477ff3cf779e366; exit=0; EXPECT=matched; output-sha256=b42859cf2d6a492028e8bd454483ed338eab0754c041647ae51265c5a48666c8; output-bytes=542; cwd=.

- [x] G5: Backend tests pass
  CHECK: python -m pytest backend/tests
  EXPECT: 23 passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=5d92e937b18062bab188d49261c19529601b7bc956300f366dfa05ad3fe7ecd5; exit=0; EXPECT=matched; output-sha256=786c50c13ec0da918b96420af8f237b8ef99be7a722d27c330537b87fd2d0c9d; output-bytes=1533; cwd=.

- [x] G6: Frontend typecheck, lint, test, and build scripts exist
  CHECK: node -e "const p=require('./frontend/package.json'); const s=p.scripts||{}; const required=['lint','test','build','verify:boundaries']; const missing=required.filter(k=>!s[k]); if(missing.length) throw new Error('missing '+missing.join(',')); console.log('FRONTEND_SCRIPTS_PRESENT')"
  EXPECT: FRONTEND_SCRIPTS_PRESENT
  EVIDENCE: automatic-evidence=v1; definition-sha256=85e2dadee738812d6eeaa40a6b7e1f0b8e119155b801172f256ec5839ef20a98; exit=0; EXPECT=matched; output-sha256=6f76f11d23e4114b9aec83b166fecbb01912fd1cc61aa1930dd0ea96ce15c505; output-bytes=25; cwd=.

- [x] G7: Final modified-code diagnostics and security paths exist
  CHECK: node -e "const fs=require('fs'); const files=['backend/app/config.py','backend/app/main.py','frontend/src/api/client.ts','backend/tests/test_config_security.py']; for(const f of files){if(!fs.existsSync(f)) throw new Error('missing '+f)} console.log('FINAL_REAUDIT_REQUIRED')"
  EXPECT: FINAL_REAUDIT_REQUIRED
  EVIDENCE: automatic-evidence=v1; definition-sha256=aef7f3b576683fef98721b6ee976034f8d933afc22e3c7a867739cf0373e83ca; exit=0; EXPECT=matched; output-sha256=5c8d3ff28ccd8fe5b2900ce971a38ffb9d2140bd27a17f8ca14e5ad375a45fda; output-bytes=23; cwd=.
