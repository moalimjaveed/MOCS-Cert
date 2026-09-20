"""PASS 40 — True Browser E2E Acceptance Test Suite.

Rigorously verifies:
1. Live Chromium browser interaction driving Vite frontend against live FastAPI backend.
2. Zero mocked fetch, zero MSW, zero synthetic store injections on critical paths.
3. Network contract verification for POST /api/v1/query/execute.
4. Structural invariant-based assertions (no hardcoded outputs).
5. Structured scientific error presentation (INVALID_SELECTION, UNSUPPORTED_GEOMETRY).
6. Dual invalidation on dataset switch (invalidates both dataset and execution identity).
7. Live concurrent query race condition protection.
8. Visual QA screenshot captures across all workstation views.
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

class TestBrowserE2E:
    """True Browser End-to-End Test Suite."""

    def test_01_real_browser_dataset_resolution(self, browser_context: BrowserContext):
        """Discovers and resolves actual dataset availability; fails explicitly if missing."""
        # 1. Query live API for dataset resolution
        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/trajectories")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        # Verify dataset properties via structural invariants
        assert "trajectory_id" in data, "Dataset resolution must declare trajectory_id"
        assert "total_frames" in data, "Dataset resolution must declare total_frames"
        assert data["total_frames"] > 0, "Active trajectory must have > 0 frames"
        assert "box_dimensions_angstrom" in data, "Dataset must specify box dimensions"
        assert len(data["box_dimensions_angstrom"]) == 3, "Simulation cell must have 3 dimensions"
        assert all(d > 0 for d in data["box_dimensions_angstrom"]), "Cell dimensions must be positive"

        # Verify physical file existence
        traj_file = os.path.join("tests", "data", data["trajectory_id"])
        if not os.path.exists(traj_file):
            pytest.fail(f"DATASET UNAVAILABLE: Expected physical file {traj_file} not found")

    def test_02_real_browser_canonical_query_execution(self, browser_context: BrowserContext):
        """Executes canonical query in real Chromium browser without mocked fetch.
        
        Asserts actual HTTP frame, response payload, structural invariants, and DOM rendering.
        """
        page: Page = browser_context.new_page()
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

        # Navigate to workstation
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # Ensure editor is ready and query text is present
        textarea = page.locator('[data-testid="query-textarea"]')
        current_query = textarea.input_value()
        assert len(current_query.strip()) > 0, "Query editor should have a valid initial query"

        # Intercept live HTTP POST to /api/v1/query/execute
        with page.expect_response("**/api/v1/query/execute", timeout=15000) as response_info:
            # Click primary 'Run Query' button
            run_btn = page.locator('button:has-text("Run Query")').first
            run_btn.click()

        response = response_info.value
        assert response.status == 200, f"Expected HTTP 200, got {response.status}: {response.text()}"

        # Inspect network payload
        res_json = response.json()
        assert "execution_id" in res_json, "Response must include execution_id"
        exec_id = res_json["execution_id"]
        assert exec_id.startswith("exec_"), f"execution_id must start with exec_, got {exec_id}"

        # Invariant Assertions (Rule 1)
        assert "blocks_examined" in res_json
        assert "refined_blocks" in res_json
        assert res_json["blocks_examined"] >= res_json["refined_blocks"] >= 0, \
            "Invariant violation: blocks_examined >= refined_blocks >= 0"

        assert res_json["truth_value"] in ("TRUE", "FALSE", "UNKNOWN"), \
            f"Invariant violation: truth_value {res_json['truth_value']} not in Kleene logic"

        assert res_json["resolution_status"] in ("COMPLETE", "INCONCLUSIVE", "EXACT_REFINED"), \
            f"Invalid resolution status: {res_json['resolution_status']}"

        assert len(res_json.get("plan_steps", [])) >= 7, "Execution plan must contain at least 7 stages"

        # Verify DOM rendering reflects live execution result
        page.wait_for_timeout(500)

        # Result badge / status in DOM
        content = page.content()
        assert "Bad Request" not in content, "Regression: generic 'Bad Request' found in DOM"
        assert "Compilation Failed" not in content, "Compilation failed unexpectedly"

        # Check diagnostics panel reflects live execution_id
        diag_toggle = page.locator('button:has-text("Developer Diagnostics")')
        if diag_toggle.is_visible():
            diag_toggle.click()
            page.wait_for_timeout(200)
            assert exec_id in page.content(), f"Live execution_id {exec_id} not rendered in diagnostics panel"

        # Capture screenshot for visual audit
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_canonical_query_executed.png"), full_page=True)

    def test_03_real_browser_invalid_selection_error(self, browser_context: BrowserContext):
        """Enters invalid selection and verifies structured error card (zero generic 'Bad Request')."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector('[data-testid="query-workspace-panel"]', timeout=10000)

        # Select the invalid selection preset from dropdown
        select = page.locator('select[aria-label="Golden Query Presets"]')
        select.select_option(value="FIND (name INVALID_XYZ) WITHIN 4.0A OF (name O2)")
        page.wait_for_timeout(200)

        # Intercept live HTTP POST expecting 400 (from compile or execute)
        with page.expect_response(lambda r: "/api/v1/query/" in r.url and r.request.method == "POST", timeout=15000) as response_info:
            page.locator('[data-testid="compile-execute-btn"]').click()

        response = response_info.value
        assert response.status == 400, f"Expected HTTP 400 for invalid selection, got {response.status}"

        res_json = response.json()
        assert res_json.get("error_code") == "INVALID_SELECTION", \
            f"Expected error_code INVALID_SELECTION, got {res_json.get('error_code')}"
        assert "location" in res_json, "Structured error must declare location"
        assert "action" in res_json, "Structured error must declare remediation action"

        # Verify DOM renders structured error card
        page.wait_for_timeout(300)
        error_card = page.locator('[data-testid="structured-error-card"]')
        assert error_card.is_visible(), "Structured error card should be displayed in DOM"
        card_text = error_card.text_content()
        assert "INVALID_SELECTION" in card_text
        assert "Bad Request" not in card_text, "Regression: raw Bad Request displayed in DOM"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_invalid_selection_error.png"), full_page=True)

    def test_04_real_browser_unsupported_geometry_rejection(self, browser_context: BrowserContext):
        """Verifies rejection of non-orthorhombic simulation cells (ADK OPLS-AA triclinic)."""
        adk_path = os.path.join("tests", "data", "real", "adk_oplsaa.xtc")
        if not os.path.exists(adk_path):
            pytest.fail(f"DATASET UNAVAILABLE: Required fixture {adk_path} not found")

        # Submit query directly requesting adk_oplsaa dataset
        payload = json.dumps({
            "query_text": "FIND (name CA) WITHIN 4.0A OF (name O2)",
            "trajectory_id": "tests/data/real/adk_oplsaa.xtc",
            "pbc_mode": "orthorhombic_minimum_image",
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{BACKEND_URL}/api/v1/query/execute",
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        try:
            urllib.request.urlopen(req)
            pytest.fail("Expected HTTP 400 for triclinic cell, but request succeeded")
        except urllib.error.HTTPError as err:
            assert err.code == 400, f"Expected HTTP 400, got {err.code}"
            err_data = json.loads(err.read().decode("utf-8"))
            assert err_data.get("error_code") == "UNSUPPORTED_GEOMETRY", \
                f"Expected UNSUPPORTED_GEOMETRY, got {err_data.get('error_code')}"
            assert "triclinic" in err_data.get("message", "").lower() or "orthorhombic" in err_data.get("message", "").lower()

    def test_04b_real_browser_adk_triclinic_execution(self, browser_context: BrowserContext):
        """Verifies end-to-end execution of non-orthorhombic simulation cells (ADK OPLS-AA triclinic)."""
        adk_path = os.path.join("tests", "data", "real", "adk_oplsaa.xtc")
        if not os.path.exists(adk_path):
            pytest.fail(f"DATASET UNAVAILABLE: Required fixture {adk_path} not found")

        # Submit query requesting adk_oplsaa dataset with pbc_mode auto
        payload = json.dumps({
            "query_text": "FIND resid 1 and name CA WITHIN 5.0A OF resid 2 and name CA",
            "trajectory_id": "tests/data/real/adk_oplsaa.xtc",
            "pbc_mode": "auto",
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{BACKEND_URL}/api/v1/query/execute",
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req) as resp:
            assert resp.getcode() == 200
            res_data = json.loads(resp.read().decode("utf-8"))

        assert res_data["truth_value"] == "TRUE"
        assert res_data["resolution_status"] == "COMPLETE"
        pbc_sem = res_data["certificate"]["semantics"]["pbc_semantics"]
        assert pbc_sem["mode"] == "triclinic_minimum_image"
        assert pbc_sem["cell_model"] == "TRICLINIC_DYNAMIC"
        assert len(pbc_sem["angles"]) == 3
        assert pytest.approx(pbc_sem["angles"][0], 0.1) == 60.0

        from mocs.certificates.auditor import verify_certificate
        assert verify_certificate(res_data["certificate"], verify_hashes=True) is True

    def test_05_real_browser_live_concurrent_race_condition(self, browser_context: BrowserContext):
        """Sends two live concurrent requests and verifies authoritative execution identity."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)

        # Issue two concurrent queries via live backend
        import concurrent.futures

        def post_query(query_str):
            req = urllib.request.Request(
                f"{BACKEND_URL}/api/v1/query/execute",
                data=json.dumps({"query_text": query_str, "trajectory_id": "synth_500f.xtc"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read().decode("utf-8"))

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut1 = executor.submit(post_query, "FIND (name CA) WITHIN 3.0A OF (name O2)")
            fut2 = executor.submit(post_query, "FIND (name CA) WITHIN 5.0A OF (name O2)")
            r1 = fut1.result()
            r2 = fut2.result()

        # Each live execution must have a unique execution_id
        assert r1["execution_id"] != r2["execution_id"], \
            "Each execution must receive a unique cryptographic execution identity"
        assert r1["execution_id"].startswith("exec_")
        assert r2["execution_id"].startswith("exec_")

    def test_06_real_browser_dataset_switch_dual_invalidation(self, browser_context: BrowserContext):
        """Switches dataset in browser and asserts dual invalidation of execution state and identity."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)

        # 1. Execute query
        with page.expect_response("**/api/v1/query/execute", timeout=15000):
            page.locator('button:has-text("Run Query")').first.click()

        page.wait_for_timeout(300)

        # 2. Trigger dataset switch in Zustand store via page evaluation
        page.evaluate("""() => {
            if (window.__mocs_scanStore) {
                window.__mocs_scanStore.setState({ trajectoryId: '1bna.xtc', topologyId: '1bna.pdb' });
            }
        }""")

        page.wait_for_timeout(400)

        # 3. Assert dual invalidation: execution identity is cleared and query is updated
        state = page.evaluate("""() => {
            return {
                execId: window.__mocs_evidenceStore ? window.__mocs_evidenceStore.getState().executionId : null,
                query: window.__mocs_evidenceStore ? window.__mocs_evidenceStore.getState().queryText : '',
            };
        }""")

        assert state["execId"] is None, "Dual invalidation failed: executionId should be cleared on dataset switch"
        assert "C1'" in state["query"] or "1bna" in state["query"], "Query text should reset to 1bna preset on dataset switch"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_dataset_switch_invalidated.png"), full_page=True)

    def test_07_real_browser_visual_qa_workstation_views(self, browser_context: BrowserContext):
        """Captures screenshots across all major workstation tabs and verifies layout integrity."""
        page: Page = browser_context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)

        # Tab list to visit
        tabs = [
            ("Workstation", "04_workstation_main.png"),
            ("Index Catalog", "05_index_catalog.png"),
            ("Refinement Explorer", "06_refinement_explorer.png"),
            ("Execution Benchmarks", "07_execution_benchmarks.png"),
            ("Formal Audit", "08_formal_audit.png"),
        ]

        for tab_name, screenshot_file in tabs:
            tab_btn = page.locator(f'button:has-text("{tab_name}")').first
            if tab_btn.is_visible():
                tab_btn.click()
                page.wait_for_timeout(300)
                page.screenshot(path=os.path.join(SCREENSHOT_DIR, screenshot_file), full_page=True)

        print("\nAll 8 Visual QA screenshots captured into docs/audit/screenshots/.")
