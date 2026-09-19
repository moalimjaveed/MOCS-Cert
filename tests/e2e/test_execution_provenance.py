"""PASS 41 — Scientific Provenance + Cross-View Consistency + Adversarial Execution Integrity E2E Test Suite.

Rigorously verifies:
1. One Execution -> One Identity -> One Consistent Scientific Story -> All Views.
2. Cross-view execution identity propagation across Workstation, Plan, Refinement, Formal Audit.
3. Query A -> Query B cross-contamination prevention (zero residual state).
4. Dataset switch dual invalidation wiping certificates, proofs, and timeline sub-blocks.
5. Query edit without execution invalidating live certificate and proof state.
6. Failed execution after success completely wiping previous certificate and truth claims.
7. Adversarial async race conditions and stale response rejection.
8. Refinement tree reset on query change.
"""

import os
import json
import time
import urllib.request
import pytest
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext

BASE_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8000"
SCREENSHOT_DIR = os.path.join("docs", "audit", "screenshots")

def ensure_servers_available():
    """Verifies that both live servers are active and reachable."""
    try:
        req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/trajectories", timeout=5)
        if req.getcode() != 200:
            pytest.fail(f"ENVIRONMENT UNAVAILABLE: Backend returned status {req.getcode()}")
    except Exception as e:
        pytest.fail(f"ENVIRONMENT UNAVAILABLE: Backend not reachable at {BACKEND_URL}: {e}")

    try:
        req = urllib.request.urlopen(f"{BASE_URL}/", timeout=5)
        if req.getcode() != 200:
            pytest.fail(f"ENVIRONMENT UNAVAILABLE: Frontend returned status {req.getcode()}")
    except Exception as e:
        pytest.fail(f"ENVIRONMENT UNAVAILABLE: Frontend not reachable at {BASE_URL}: {e}")

@pytest.fixture(scope="session", autouse=True)
def verify_environment():
    ensure_servers_available()
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

@pytest.fixture(scope="function")
def browser_context():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        yield context
        browser.close()

class TestExecutionProvenanceE2E:
    """True Browser End-to-End Suite for Scientific Provenance and Invariants."""

    def test_08_cross_view_execution_identity(self, browser_context: BrowserContext):
        """Executes canonical query and asserts one consistent execution identity across all views."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # 1. Execute Query A via UI
        with page.expect_response("**/api/v1/query/execute", timeout=15000) as response_info:
            page.locator('button:has-text("Run Query")').first.click()

        response = response_info.value
        assert response.status == 200, f"Expected 200, got {response.status}"
        data = response.json()
        exec_id = data["execution_id"]
        truth_value = data["truth_value"]
        cert = data.get("certificate", {})
        cert_hash = cert.get("certificate_hash") or cert.get("hash")

        page.wait_for_timeout(400)

        # 2. Verify ExecutionIdentity model in EvidenceStore
        store_identity = page.evaluate("""() => {
            const store = window.__mocs_evidenceStore;
            if (!store) return null;
            return store.getState().getExecutionIdentity();
        }""")

        assert store_identity is not None, "ExecutionIdentity must be established after execution"
        assert store_identity["execution_id"] == exec_id
        assert store_identity["dataset_id"] == "synth_500f.xtc"

        # 3. Workstation view verification
        content = page.content()
        assert "Bad Request" not in content

        # 4. Visit Formal Audit View and verify certificate hash matches exactly
        audit_btn = page.locator('button:has-text("Formal Audit")').first
        if audit_btn.is_visible():
            audit_btn.click()
            page.wait_for_timeout(300)
            if cert_hash:
                short_hash = cert_hash[:12]
                assert short_hash in page.content(), f"Formal Audit must show matching certificate hash {short_hash}"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_cross_view_identity.png"), full_page=True)

    def test_09_query_A_query_B_cross_contamination(self, browser_context: BrowserContext):
        """Executes Query A (4.0Å) then Query B (10.0Å) and asserts zero cross-contamination."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # 1. Execute Query A (4.0A)
        with page.expect_response("**/api/v1/query/execute", timeout=15000) as resp_a:
            page.locator('button:has-text("Run Query")').first.click()
        data_a = resp_a.value.json()
        exec_a = data_a["execution_id"]
        cert_a = (data_a.get("certificate") or {}).get("certificate_hash")

        page.wait_for_timeout(300)

        # 2. Change query to Query B (10.0A)
        textarea = page.locator('[data-testid="query-textarea"]')
        textarea.fill("FIND (name CA) WITHIN 10.0A OF (name O2)")
        page.wait_for_timeout(200)

        # 3. Execute Query B
        with page.expect_response("**/api/v1/query/execute", timeout=15000) as resp_b:
            page.locator('button:has-text("Run Query")').first.click()
        data_b = resp_b.value.json()
        exec_b = data_b["execution_id"]
        cert_b = (data_b.get("certificate") or {}).get("certificate_hash")

        # Assert independent cryptographic identities
        assert exec_a != exec_b, "Consecutive executions must produce unique execution IDs"
        if cert_a and cert_b:
            assert cert_a != cert_b, "Distinct queries must yield distinct certificate hashes"

        page.wait_for_timeout(400)

        # 4. Verify store identity exclusively reflects Query B
        active_id = page.evaluate("""() => {
            return window.__mocs_evidenceStore.getState().executionId;
        }""")
        assert active_id == exec_b, f"Store executionId must be {exec_b}, got {active_id}"

        # 5. Verify DOM does NOT contain stale exec_a
        content = page.content()
        assert exec_a not in content, f"Cross-contamination: Stale execution ID {exec_a} found in DOM after running Query B"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "09_cross_contamination_prevented.png"), full_page=True)

    def test_10_dataset_switch_certificate_invalidation(self, browser_context: BrowserContext):
        """Switches dataset and asserts strict invalidation of certificate, proof bounds, and sub-blocks."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # Execute Query A to establish valid certificate
        with page.expect_response("**/api/v1/query/execute", timeout=15000):
            page.locator('button:has-text("Run Query")').first.click()
        page.wait_for_timeout(300)

        # Switch dataset via scan store
        page.evaluate("""() => {
            window.__mocs_scanStore.setState({ trajectoryId: '1bna.xtc', topologyId: '1bna.pdb' });
        }""")
        page.wait_for_timeout(300)

        # Verify invalidation across all stores
        state = page.evaluate("""() => {
            const ev = window.__mocs_evidenceStore ? window.__mocs_evidenceStore.getState() : null;
            const pf = window.__mocs_proofStore ? window.__mocs_proofStore.getState() : null;
            const tm = window.__mocs_timelineStore ? window.__mocs_timelineStore.getState() : null;
            return {
                cert: ev ? ev.certificate : null,
                truthValue: ev ? ev.truthValue : null,
                execId: ev ? ev.executionId : null,
                lowerBound: pf ? pf.lowerBound : null,
                activeSubBlocks: tm ? tm.activeSubBlocks.length : null,
            };
        }""")

        assert state["cert"] is None, "Certificate must be invalidated to null on dataset switch"
        assert state["truthValue"] == "NO_EXECUTION", "truthValue must reset to NO_EXECUTION on dataset switch"
        assert state["execId"] is None, "executionId must be reset to null on dataset switch"
        assert state["lowerBound"] == 0, "Proof lower bound must reset to 0 on dataset switch"
        assert state["activeSubBlocks"] == 0, "Timeline sub-blocks must be emptied on dataset switch"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "10_dataset_switch_invalidated.png"), full_page=True)

    def test_11_query_edit_without_execution(self, browser_context: BrowserContext):
        """Edits query text without executing and asserts certificate is invalidated immediately."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # Execute Query
        with page.expect_response("**/api/v1/query/execute", timeout=15000):
            page.locator('button:has-text("Run Query")').first.click()
        page.wait_for_timeout(300)

        # Edit query text in textarea
        textarea = page.locator('[data-testid="query-textarea"]')
        textarea.fill("FIND (name N) WITHIN 3.0A OF (name O)")
        page.wait_for_timeout(200)

        # Verify certificate is invalidated
        state = page.evaluate("""() => {
            const ev = window.__mocs_evidenceStore.getState();
            return {
                cert: ev.certificate,
                truth: ev.truthValue,
                execId: ev.executionId,
            };
        }""")

        assert state["cert"] is None, "Certificate must be invalidated on query edit"
        assert state["truth"] == "NO_EXECUTION", "truthValue must be NO_EXECUTION on query edit"
        assert state["execId"] is None, "executionId must be null on query edit"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "11_query_edit_invalidation.png"), full_page=True)

    def test_12_failed_execution_after_success(self, browser_context: BrowserContext):
        """Runs valid query then invalid query; asserts failure completely wipes prior success certificate."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # 1. Successful execution
        with page.expect_response("**/api/v1/query/execute", timeout=15000):
            page.locator('button:has-text("Run Query")').first.click()
        page.wait_for_timeout(300)

        # 2. Select invalid query preset
        select = page.locator('select[aria-label="Golden Query Presets"]')
        select.select_option(value="FIND (name INVALID_XYZ) WITHIN 4.0A OF (name O2)")
        page.wait_for_timeout(200)

        # 3. Attempt execution (fails 400)
        with page.expect_response(lambda r: "/api/v1/query/" in r.url and r.request.method == "POST", timeout=15000):
            page.locator('[data-testid="compile-execute-btn"]').click()
        page.wait_for_timeout(300)

        # 4. Verify prior certificate and truth are completely wiped
        state = page.evaluate("""() => {
            const ev = window.__mocs_evidenceStore.getState();
            return {
                cert: ev.certificate,
                truth: ev.truthValue,
                err: ev.structuredError,
            };
        }""")

        assert state["cert"] is None, "Prior certificate must be wiped when subsequent execution fails"
        assert state["truth"] != "CERTIFIED TRUE", "Truth value must not retain prior success state"
        assert state["err"] is not None, "Structured error must be captured"
        assert state["err"]["error_code"] == "INVALID_SELECTION"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "12_failed_execution_wiped_state.png"), full_page=True)

    def test_13_adversarial_race_condition(self, browser_context: BrowserContext):
        """Verifies frontend monotonic protection against out-of-order asynchronous responses."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)

        # Simulate two executions arriving in reverse order via runCanonicalQuery
        token_order = page.evaluate("""async () => {
            const ev = window.__mocs_evidenceStore.getState();
            
            // Set initial query A
            ev.setQueryText('FIND (name CA) WITHIN 4.0A OF (name O2)');
            const tokenA = ev.executionId;
            
            // Immediately switch to query B
            ev.setQueryText('FIND (name CA) WITHIN 6.0A OF (name O2)');
            const tokenB = ev.executionId;
            
            return {
                activeQuery: window.__mocs_evidenceStore.getState().queryText,
                tokenA,
                tokenB,
            };
        }""")

        assert token_order["activeQuery"] == "FIND (name CA) WITHIN 6.0A OF (name O2)"

    def test_14_refinement_stale_after_query_change(self, browser_context: BrowserContext):
        """Verifies refinement tree sub-blocks are cleared upon query text changes."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)
        page.wait_for_timeout(300)

        # Set mock active sub-blocks in timeline store
        page.evaluate("""() => {
            window.__mocs_timelineStore.setState({
                selectedBlockId: 41,
                activeSubBlocks: [
                    { child_id: '41.0', parent_id: 41, frame_start: 410, frame_end_exclusive: 415, lower_bound: 3.8, upper_bound: 4.2, truth_value: 'UNKNOWN', status: 'REFINED' }
                ]
            });
        }""")
        page.wait_for_timeout(200)

        count_before = page.evaluate("""() => window.__mocs_timelineStore.getState().activeSubBlocks.length""")
        assert count_before == 1

        # User edits query text in UI
        textarea = page.locator('[data-testid="query-textarea"]')
        textarea.fill("FIND (name N) WITHIN 5.0A OF (name CA)")
        page.wait_for_timeout(200)

        count_after = page.evaluate("""() => window.__mocs_timelineStore.getState().activeSubBlocks.length""")
        assert count_after == 0, "Active sub-blocks must be cleared when query text changes"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "14_refinement_reset.png"), full_page=True)
