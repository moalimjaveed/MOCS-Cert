# Method Specification: Kleene 3-Valued Logic Algebra
## Method ID: METH-002

### 1. Mathematical Formulation
When evaluating geometric predicates over spatial coordinate blocks $[k_s, k_e)$ where atomic positions are conservatively bounded by Axis-Aligned Bounding Boxes (AABBs), the truth value belongs to Kleene's ternary domain $\mathbb{K} = \{	ext{TRUE}, 	ext{FALSE}, 	ext{UNKNOWN}\}$:

$$	ext{TRUE} \land 	ext{UNKNOWN} = 	ext{UNKNOWN}, \quad 	ext{FALSE} \land 	ext{UNKNOWN} = 	ext{FALSE}$$
$$	ext{TRUE} \lor 	ext{UNKNOWN} = 	ext{TRUE}, \quad 	ext{FALSE} \lor 	ext{UNKNOWN} = 	ext{UNKNOWN}$$
$$
eg 	ext{UNKNOWN} = 	ext{UNKNOWN}$$

### 2. Epistemic Principle
Only intervals where all sub-frames evaluate to TRUE can be certified as TRUE.
