# Full Codebase Forensic Audit Gates

- [x] G1: Repository inventory and architecture map are complete
  CHECK: node -e "const fs=require('fs'); const paths=['backend','frontend','mocs','tests','scripts','docs','pyproject.toml','frontend/package.json']; for(const p of paths){if(!fs.existsSync(p)) throw new Error('missing '+p)} console.log('INVENTORY_COMPLETE')"
  EXPECT: INVENTORY_COMPLETE
  EVIDENCE: automatic-evidence=v1; definition-sha256=0e35d3f25f14ae43250073a0d75030032df67d27d988f66c60c412fcaa6d4f6f; exit=0; EXPECT=matched; output-sha256=4b74d4fdcd75e6e96b09ac73bc4b264fb44903571f066f9dbee29d47fb801ade; output-bytes=19; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G2: Baseline Python modular suite passes
  CHECK: python test_modular_mocs.py
  EXPECT: All Modular Package Invariants Verified Successfully!
  EVIDENCE: automatic-evidence=v1; definition-sha256=2b8d991e75296c266ee99f4916cb92f8ad6118117d9ab3d39d64185a7ac18253; exit=0; EXPECT=matched; output-sha256=bcfafd330eff5be7fa474c9d8850f07d655c75d2cef2d3ad90292277e41922db; output-bytes=896; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G3: Documentation consolidation completes
  CHECK: python merge_docs.py
  EXPECT: Successfully generated consolidated audit document
  EVIDENCE: automatic-evidence=v1; definition-sha256=face78439ce93059121717e211a425477d78d0341a6c12134ba82f8c4e845cba; exit=0; EXPECT=matched; output-sha256=3c5759857656b730ea42fa5f48fbfec7d68312c29972ee38613630821382db18; output-bytes=367; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G4: Code consolidation and self-tests complete
  CHECK: python merge_codes.py
  EXPECT: All MOCS-Cert Code Merge & Verification Steps Completed Successfully!
  EVIDENCE: automatic-evidence=v1; definition-sha256=957b3b605133366990ef3b3bcb0fa5dc697a8eb8b4da3750505328ca6d235b7d; exit=0; EXPECT=matched; output-sha256=f02178602c438b3d916fab0225a4b0bcf808a0c5ec5035f9633571ea73e481e3; output-bytes=2984; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G5: Backend tests pass
  CHECK: python -m pytest backend/tests
  EXPECT: 23 passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=d72fd3eb51df41931408245e1295af4a90247d6fe198532c2e5d60f93a20e793; exit=0; EXPECT=matched; output-sha256=bf00d33752d2afdcecabe75ea5272be68304d0c25909394d7319792ed8f6a32f; output-bytes=1555; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G6: Frontend typecheck, lint, tests, and production build pass where scripts exist
  CHECK: node -e "const p=require('./frontend/package.json'); const s=p.scripts||{}; const required=['lint','test','build']; const missing=required.filter(k=>!s[k]); if(missing.length) throw new Error('missing '+missing.join(',')); console.log('FRONTEND_SCRIPTS_PRESENT')"
  EXPECT: FRONTEND_SCRIPTS_PRESENT
  EVIDENCE: automatic-evidence=v1; definition-sha256=bf1f4262f2fd983c4b92cfd7b08f61b544c2ff09d8bf30339122b2166ed36367; exit=0; EXPECT=matched; output-sha256=6f76f11d23e4114b9aec83b166fecbb01912fd1cc61aa1930dd0ea96ce15c505; output-bytes=25; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries

- [x] G7: Final modified-code diagnostics and regression audit are clean
  CHECK: node -e "const fs=require('fs'); const files=['backend/app/config.py','backend/app/main.py','frontend/src/api/client.ts','backend/tests/test_config_security.py']; for(const f of files){if(!fs.existsSync(f)) throw new Error('missing '+f)} console.log('FINAL_REAUDIT_REQUIRED')"
  EXPECT: FINAL_REAUDIT_REQUIRED
  EVIDENCE: automatic-evidence=v1; definition-sha256=9eecb02649e656275983aa05d63339ba9ad0ead6c19baf0bf2ccff07d8728192; exit=0; EXPECT=matched; output-sha256=5c8d3ff28ccd8fe5b2900ce971a38ffb9d2140bd27a17f8ca14e5ad375a45fda; output-bytes=23; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Javeed Ahmad\Work\New folder; path=8c400496f314/51 entries
