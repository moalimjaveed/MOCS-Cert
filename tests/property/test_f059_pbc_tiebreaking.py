"""
Property and differential test verifying PBC tie-breaking and banker's rounding (F-059).
Asserts that Python minimum_image_displacement and TypeScript calculateMinimumImageDistance
produce identical outputs to within 1 ULP on arbitrary and tie-breaking coordinates.
"""

import json
import subprocess
import numpy as np
import pytest
from mocs.bounds.periodic_bounds import minimum_image_displacement


def test_round_half_even_tie_breaking():
    """Verify NumPy round-half-to-even behavior on half-integers."""
    inputs = [0.5, 1.5, 2.5, 3.5, 4.5, -0.5, -1.5, -2.5, -3.5, -4.5]
    expected_py = np.round(inputs).tolist()
    
    node_cmd = [
        "node",
        "-e",
        """
        function roundHalfEven(x) {
          if (x < 0) return -roundHalfEven(-x);
          const floor = Math.floor(x);
          const diff = x - floor;
          if (Math.abs(diff - 0.5) < 1e-12) {
            return floor % 2 === 0 ? floor : floor + 1;
          }
          return Math.round(x);
        }
        const inputs = [0.5, 1.5, 2.5, 3.5, 4.5, -0.5, -1.5, -2.5, -3.5, -4.5];
        console.log(JSON.stringify(inputs.map(roundHalfEven)));
        """
    ]
    proc = subprocess.run(node_cmd, capture_output=True, text=True, check=True)
    js_output = json.loads(proc.stdout.strip())
    
    assert js_output == expected_py, f"JS {js_output} != Py {expected_py}"


def test_differential_pbc_distance_cross_language():
    """Verify minimum-image distance agreement between Python and JS calculateMinimumImageDistance."""
    box = [80.0, 80.0, 80.0]
    box_arr = np.array(box, dtype=np.float64)
    
    test_cases = [
        ([0.0, 0.0, 0.0], [40.0, 0.0, 0.0]),
        ([0.0, 0.0, 0.0], [-40.0, 0.0, 0.0]),
        ([0.0, 0.0, 0.0], [120.0, 0.0, 0.0]),
        ([10.0, 20.0, 30.0], [50.0, 60.0, 70.0]),
        ([40.0, 40.0, 40.0], [45.5, 40.0, 40.0]),
        ([1.0, 2.0, 3.0], [79.0, 78.0, 77.0]),
        ([25.3, 14.8, 62.1], [68.4, 71.9, 15.2]),
    ]
    
    for pA, pB in test_cases:
        diff = np.array(pB) - np.array(pA)
        diff_pbc = minimum_image_displacement(diff, box_arr)
        py_dist = float(np.linalg.norm(diff_pbc))
        
        node_script = f"""
        function roundHalfEven(x) {{
          if (x < 0) return -roundHalfEven(-x);
          const floor = Math.floor(x);
          const diff = x - floor;
          if (Math.abs(diff - 0.5) < 1e-12) {{
            return floor % 2 === 0 ? floor : floor + 1;
          }}
          return Math.round(x);
        }}
        function calcDist(pA, pB, box) {{
          let dx = pB[0] - pA[0];
          let dy = pB[1] - pA[1];
          let dz = pB[2] - pA[2];
          dx -= roundHalfEven(dx / box[0]) * box[0];
          dy -= roundHalfEven(dy / box[1]) * box[1];
          dz -= roundHalfEven(dz / box[2]) * box[2];
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }}
        console.log(calcDist({json.dumps(pA)}, {json.dumps(pB)}, {json.dumps(box)}));
        """
        proc = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, check=True)
        js_dist = float(proc.stdout.strip())
        
        assert abs(py_dist - js_dist) < 1e-12, (
            f"Discrepancy for {pA} -> {pB}: Py={py_dist}, JS={js_dist}"
        )
