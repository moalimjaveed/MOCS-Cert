# RULE.md

# Product Design & UI/UX Philosophy

## The Visual Constitution of This Project

> This document defines how the product should look, feel, behave, and evolve.

>
> It is not a component library.

> It is not a collection of arbitrary CSS preferences.

> It is the design philosophy that governs every component, screen, interaction,

> and visual decision in the product.

---

# 00. THE CORE PRINCIPLE

## Design should feel intentional, not assembled.

Every visual decision must have a reason.

A good interface should feel as though:

- one designer designed it
- one system governs it
- every component belongs to the same product
- visual hierarchy is deliberate
- geometry is consistent
- spacing has rhythm
- color has meaning
- interactions have purpose
- nothing exists merely because a UI library made it available

The goal is not to make every component identical.

The goal is to make different components feel like members of the same family.

---

# 01. DESIGN PHILOSOPHY

The product follows seven primary principles:

1. Intentionality
2. Hierarchy
3. Restraint
4. Geometry
5. Consistency
6. Accessibility
7. Visual Proof

These principles take precedence over individual component preferences.

---

# 02. INTENTIONALITY

## Every visual element needs a reason.

Do not add a visual treatment simply because it looks modern.

Examples of things that require justification:

- gradients
- shadows
- borders
- colored icon containers
- pills
- decorative lines
- badges
- excessive cards
- background patterns
- animations
- large rounded corners
- glass effects
- floating elements

Ask:

> "What problem does this visual treatment solve?"

If the answer is:

> "It looks cool."

do not use it.

---

# 03. HIERARCHY

## The interface must communicate importance visually.

Not everything can be important.

A screen should have a hierarchy such as:

PRIMARY

↓

SECONDARY

↓

SUPPORTING

↓

TERTIARY

For example:

Primary:

- page title
- primary CTA
- critical status

Secondary:

- supporting action
- secondary information

Supporting:

- metadata
- descriptions
- contextual information

Tertiary:

- timestamps
- helper text
- low-priority metadata

Visual weight must follow this hierarchy.

---

# 04. THE VISUAL ANCHOR PRINCIPLE

Every product should have a small number of **visual anchors**.

A visual anchor is a component whose geometry establishes the language of the interface.

Examples:

- primary CTA
- primary card
- main navigation
- primary input
- signature product surface

Once an anchor has been established:

> Other components should visually relate to it.

Do not create a completely different radius, height, spacing rhythm,

shadow language, or typography treatment for every component.

---

# 05. CURVE PHILOSOPHY

## Curves communicate hierarchy.

Corner radius is not decoration.

It changes how an object is perceived.

A small radius communicates:

- compactness
- utility
- precision
- density

A medium radius communicates:

- friendliness
- normal interaction
- standard surface hierarchy

A large radius communicates:

- prominence
- softness
- containment
- large surface

A circular radius communicates:

- identity
- status
- gesture
- micro-interaction
- intentional capsule/circle geometry

Therefore:

> Radius must be selected according to the role of the component.

---

# 06. SEMANTIC RADIUS SCALE

Unless the product defines another scale, use:

| Token | Radius | Typical Use |

|---|---:|---|

| `rounded-none` | 0px | sharp structural surfaces |

| `rounded-xs` | 6px | tiny elements |

| `rounded-sm` | 8px | compact controls |

| `rounded-md` | 12px | standard controls |

| `rounded-lg` | 16px | primary controls / standard surfaces |

| `rounded-xl` | 20px | prominent panels |

| `rounded-2xl` | 24px | large intentional surfaces |

| `rounded-full` | 9999px | intentional circles/capsules |

These are semantic tokens.

They are not numbers that must be mathematically applied everywhere.

---

# 07. THE NO-ARBITRARY-RADIUS RULE

Avoid arbitrary values such as:

```txt

rounded-[13px]

rounded-[15px]

rounded-[17px]

rounded-[19px]

rounded-[21px]

rounded-[23px]

````

unless there is an exceptional, documented reason.

Why?

Because arbitrary values slowly destroy visual consistency.

Instead of:

```txt

13px

15px

17px

18px

21px

22px

```

the product should generally communicate through:

```txt

sm

md

lg

xl

2xl

```

The exact token may vary by project.

The principle does not.

---

# 08. RADIUS MUST BE JUDGED WITH HEIGHT

A radius cannot be evaluated independently.

Consider:

```txt

Height = 40px

Radius = 20px

```

This produces a capsule.

But:

```txt

Height = 80px

Radius = 20px

```

produces a substantially different visual object.

Therefore:

> Radius + Height must always be evaluated together.

A useful heuristic is:

```txt

Straight Edge = H - 2R

```

and:

```txt

Flat Edge Ratio = (H - 2R) / H

```

Example:

```txt

H = 56px

R = 16px

56 - 32 = 24px

24 / 56 = 42.9%

```

This produces a clearly rounded rectangle rather than a pill.

---

# 09. IMPORTANT: THE FORMULA IS A HEURISTIC

The previous formula is NOT a universal law.

Never say:

> "The ratio is below X, therefore the component is wrong."

Visual perception depends on:

* width
* height
* radius
* padding
* typography
* border
* shadow
* neighboring elements
* surrounding whitespace
* color
* component purpose

Therefore:

> Rendered visual quality takes precedence over mathematical purity.

---

# 10. PILL / CAPSULE PHILOSOPHY

## Pills should be intentional.

Do not make everything a pill.

Bad:

```txt

[ Dashboard ]

[ Settings ]

[ Save ]

[ Search ]

[ Submit ]

[ Profile ]

```

when all are `rounded-full`.

This makes the interface visually monotonous.

Pills should generally be reserved for things where capsule geometry communicates

something useful:

* status
* category
* tags
* compact filters
* certain segmented controls
* intentional chips
* small indicators

Normal buttons should generally use semantic rectangular radii.

---

# 11. ROUNDED-FULL PHILOSOPHY

`rounded-full` is not a universal "make this look nice" class.

Use it intentionally for:

* avatars
* status dots
* circular markers
* map markers
* circular controls
* drag handles
* spinners
* circular progress indicators
* intentional capsules
* micro-indicators

Do not automatically replace legitimate `rounded-full` usage.

The question is:

> "Is the circular/capsule geometry intentional?"

not:

> "Can I reduce the number of rounded-full occurrences?"

---

# 12. NESTED CURVE PHILOSOPHY

Nested surfaces should feel physically related.

For genuinely concentric surfaces:

```txt

R_inner = R_outer - inset

```

Example:

```txt

Outer = 16px

Inset = 4px

Inner = 12px

```

Therefore:

```txt

16 → 12

```

A deeper layer could become:

```txt

16 → 12 → 8

```

This prevents:

```txt

╭──────────────╮

│  ╭────────╮  │

│  │        │  │

│  ╰────────╯  │

╰──────────────╯

```

from looking geometrically disconnected.

Instead, nested surfaces should feel like:

```txt

╭────────────────╮

│  ╭──────────╮  │

│  │          │  │

│  ╰──────────╯  │

╰────────────────╯

```

Again:

> This is a design principle, not a CSS law.

Do not force mathematically concentric radii onto unrelated elements.

---

# 13. THE "CARD INSIDE CARD" RULE

Do not place every piece of information inside another card.

Bad:

```txt

┌──────────────────────────────┐

│ ┌──────────────────────────┐ │

│ │ ┌──────────────────────┐ │ │

│ │ │  Information         │ │ │

│ │ └──────────────────────┘ │ │

│ └──────────────────────────┘ │

└──────────────────────────────┘

```

This creates visual noise.

Prefer hierarchy through:

* spacing
* typography
* dividers
* subtle backgrounds
* alignment

Use another surface only when it communicates a genuine grouping.

---

# 14. SURFACE HIERARCHY

Think in levels.

### Level 0

Page background.

### Level 1

Primary surface.

### Level 2

Secondary surface.

### Level 3

Interactive controls.

### Level 4

Temporary overlays.

Each level should have a reason.

Do not give every level:

* border
* shadow
* background color
* radius

simultaneously.

---

# 15. BORDER PHILOSOPHY

Borders should clarify structure.

They should not decorate every object.

Use borders when they help communicate:

* separation
* containment
* input boundaries
* interactive boundaries
* table structure
* focus
* state

Avoid unnecessary:

```txt

border + shadow + colored background + radius

```

on every component.

---

# 16. SHADOW PHILOSOPHY

Shadows communicate elevation.

Use them when an object actually sits above another surface.

Examples:

* dialog
* dropdown
* popover
* floating action
* elevated card
* bottom sheet

Avoid giving every card a large shadow.

The default product surface should generally be calm.

A mature interface often uses:

> subtle shadow + border

rather than:

> huge shadow + gradient + glow.

---

# 17. COLOR PHILOSOPHY

## Color must communicate.

Every major color should have a semantic role.

Examples:

* neutral workstation base
* epistemic truth / success (TRUE / CERTIFIED_TRUE)
* epistemic refutation / failure (FALSE / CERTIFIED_FALSE)
* epistemic uncertainty / refinement (UNKNOWN / NEEDS_REFINEMENT)
* epistemic unresolvability / unsupported (UNRESOLVABLE_SAMPLING / UNSUPPORTED_SEMANTICS)
* spatial selection calipers (Cyan / Orange AABB cages)
* informational / neutral metadata
* disabled

Do not use color purely for decoration.

Especially avoid:

* random gradients
* random accent colors
* multiple unrelated reds
* multiple unrelated greens
* decorative neon colors

### MOCS-Cert Epistemic Truth & Deductive Proof Color Canon

In MOCS-Cert, color is not an aesthetic preference—it is a mathematical assertion of epistemic proof state:

* **TRUE / CERTIFIED_TRUE**: Emerald (#10B981 / Tailwind emerald-500) — verified truth, sound deductive step.
* **FALSE / CERTIFIED_FALSE**: Rose (#F43F5E / Tailwind 
ose-500) — refuted predicate, violation witness.
* **UNKNOWN / NEEDS_REFINEMENT**: Amber (#F59E0B / Tailwind mber-500) — inconclusive at current bound, requires block subdivision or coordinate refinement.
* **UNRESOLVABLE_SAMPLING / UNSUPPORTED_SEMANTICS**: Violet (#8B5CF6 / Tailwind iolet-500) — query cannot be resolved under trajectory sampling interval or requested operator is outside certified semantics.
* **Selection AABBs (Dual Caliper)**:
  * Subject A (e.g. Target Residue): Sky/Cyan (#38BDF8 / Tailwind sky-400)
  * Subject B (e.g. Ligand / Partner): Orange (#FB923C / Tailwind orange-400)
* **Workstation Foundation**: Deep Slate / Zinc (#020617 / #0B0F17 / #1E293B) — dark-mode first, zero eye strain during long trajectory analysis sessions.

If a brand color exists, use it deliberately and never allow it to conflict with epistemic truth states.

---

# 18. ACCENT-COLOR DISCIPLINE

A brand accent should be recognizable.

But:

> Accent color ≠ every interactive element.

If everything is red, blue, green, or purple:

nothing is important anymore.

In scientific workstations, accent colors must NEVER compete with or masquerade as epistemic truth indicators (Emerald/Rose/Amber/Violet). Interactive focus rings, active tabs, and primary action buttons use neutral high-contrast cyan/indigo (#6366F1 or #38BDF8) only when clearly separated from semantic truth assertions.

Use accent color where it creates hierarchy.

---

# 19. RED / DESTRUCTIVE / WARNING PHILOSOPHY

Red is powerful.

Therefore it should be used carefully.

Good uses:

* destructive action (e.g., purging index cache, killing long-running scan)
* system error / protocol failure
* CERTIFIED_FALSE state in proof inspection
* formal refutation witness in trajectory timeline

Bad use:

`	xt
random red line
random red icon
random red border
random red background
random red text
`

just to add visual interest.

Never add decorative color without semantic purpose.

---

# 20. TYPOGRAPHY PHILOSOPHY

Typography should establish hierarchy before decoration does.

Use:

### Primary

Titles / important values.

### Secondary

Descriptions / supporting information.

### Tertiary

Metadata / timestamps / helper text.

Avoid making everything:

* bold
* uppercase
* large
* highly contrasted

If everything screams, nothing has hierarchy.

---

# 21. UPPERCASE TEXT

Uppercase can be useful for:

* compact labels
* section labels
* status categories
* navigation metadata

But excessive uppercase text makes interfaces feel:

* aggressive
* noisy
* dated
* overly administrative

Use it intentionally.

---

# 22. SPACING PHILOSOPHY

Spacing should have rhythm.

Prefer an intentional spacing scale.

Common rhythm:

```txt

4

8

12

16

20

24

32

40

48

64

```

The exact scale may differ by project.

The principle is:

> Repetition creates rhythm.

Avoid random spacing such as:

```txt

7px

11px

13px

19px

27px

```

unless there is a strong reason.

---

# 23. ALIGNMENT PHILOSOPHY

Alignment is one of the cheapest ways to make an interface look professional.

Prefer:

* shared left edges
* shared right edges
* consistent baselines
* consistent control heights
* predictable gaps
* aligned icons
* aligned labels

Misalignment often looks like a radius problem when it is actually a spacing

or layout problem.

---

# 24. BUTTON PHILOSOPHY

Buttons should communicate hierarchy.

### Primary

The most important action.

### Secondary

Supporting action.

### Tertiary

Low-emphasis action.

### Destructive

Dangerous / irreversible action.

Never allow:

```txt

Primary button

=

Secondary button

=

Cancel

=

Delete

```

visually.

Actions need hierarchy.

---

# 25. BUTTON HEIGHT + RADIUS

Buttons should use radius according to size.

Example semantic system:

```txt

Small:

h-9 + rounded-sm

Medium:

h-10 + rounded-md

Large:

h-14 + rounded-lg

```

This is an example, not an absolute requirement.

The key principle:

> Smaller controls generally need tighter curvature.

Avoid:

```txt

h-8 + rounded-full

```

for ordinary buttons unless capsule geometry is intentional.

---

# 26. ICON BUTTON PHILOSOPHY

Icon-only buttons require:

* recognizable icon
* sufficient touch target
* accessible label
* visible hover state
* visible focus state
* consistent dimensions

Do not automatically make every icon button circular.

Use circular geometry only when it belongs to the visual language.

---

# 27. FORM PHILOSOPHY

Forms should feel calm.

Prioritize:

1. label
2. input
3. supporting text
4. validation
5. action

Do not surround every input with decorative containers.

Inputs should clearly communicate:

* normal
* focused
* disabled
* error
* success

---

# 28. INPUT GEOMETRY

Inputs should have:

* consistent height
* consistent radius
* consistent border
* predictable padding
* aligned icons

Do not let different input types randomly use:

```txt

8px

14px

18px

24px

9999px

```

without semantic reasoning.

---

# 29. STATUS PHILOSOPHY

Statuses should be immediately understandable.

Examples:

```txt

ACTIVE

PENDING

FAILED

EXPIRED

DISABLED

```

Status styling should be:

* compact
* semantic
* consistent
* readable

Do not make status badges larger than the information they describe.

---

# 30. TABLE / LIST PHILOSOPHY

Tables and lists should prioritize information density.

Do not turn every row into a giant rounded card.

Use:

* alignment
* spacing
* dividers
* hover state
* typography

to create structure.

---

# 31. NAVIGATION PHILOSOPHY

Navigation should make location obvious.

Active state must communicate:

> "You are here."

Do not use excessive decoration.

Avoid:

* random pseudo-elements
* arbitrary colored blocks
* inconsistent radius
* oversized active backgrounds

The active state should belong to the navigation container.

---

# 32. MODAL / DIALOG PHILOSOPHY

A dialog is a temporary focused environment.

It should have:

```txt

Context

↓

Title

↓

Explanation

↓

Content

↓

Primary action

↓

Secondary action

```

Avoid decorative clutter.

A dialog should not look like:

```txt

white box

+

red line

+

random icon circle

+

nested card

+

random tabs

+

multiple shadows

```

unless every layer has a clear semantic purpose.

---

# 33. BOTTOM-SHEET PHILOSOPHY

Bottom sheets should feel physically connected to the bottom of the viewport.

They should have:

* clear top edge
* subtle handle when appropriate
* intentional top corners
* clear header
* readable content
* appropriate scroll behavior
* clear dismissal

The handle is enough.

Do not add random decorative lines beneath it.

---

# 34. MOBILE-FIRST PHILOSOPHY

Mobile is not a smaller desktop.

Design mobile as its own interaction environment.

Prioritize:

1. reachability
2. touch targets
3. content hierarchy
4. scrolling
5. thumb-friendly controls
6. readable text
7. minimal clutter

Always test narrow widths.

Recommended:

```txt

375px

390px

430px

```

---

# 35. DESKTOP PHILOSOPHY

Desktop should take advantage of:

* horizontal space
* information density
* larger layouts
* multi-column structures

But do not stretch content unnecessarily.

A 1440px viewport does not mean every component should become huge.

---

# 36. RESPONSIVE PHILOSOPHY

Responsive behavior should be intentional.

Do not simply:

```txt

desktop

↓

shrink everything

↓

mobile

```

Instead decide:

* what disappears
* what stacks
* what wraps
* what becomes scrollable
* what becomes a drawer
* what becomes a bottom sheet
* what changes hierarchy

---

# 37. ACCESSIBILITY PHILOSOPHY

Accessibility is part of visual design.

Check:

* contrast
* focus
* keyboard navigation
* touch targets
* readable font sizes
* labels
* semantic states
* error communication
* disabled states

A beautiful inaccessible interface is not a finished interface.

---

# 38. DISABLED-STATE PHILOSOPHY

Disabled does not mean:

> "Make everything gray until it disappears."

Disabled states should communicate:

* unavailable
* inactive
* not currently actionable

while remaining legible.

Do not create:

```txt

black background

+

dark gray text

```

or similarly confusing combinations.

---

# 39. DESTRUCTIVE ACTION PHILOSOPHY

Destructive actions should be:

* obvious
* intentional
* difficult to trigger accidentally
* visually distinct
* accessible

But do not make every delete button enormous and red.

Use hierarchy appropriate to the context.

---

# 40. MICRO-INTERACTION PHILOSOPHY

Animation should explain change.

Good animation:

* communicates navigation
* confirms an action
* reveals hierarchy
* establishes continuity
* provides feedback

Bad animation:

* exists everywhere
* delays users
* distracts
* constantly moves UI
* adds spectacle without meaning

Prefer:

> subtle + fast + purposeful

over:

> dramatic + slow + everywhere.

---

# 41. ANIMATION RULE

Do not animate every element.

Use animation primarily for:

* entering
* leaving
* state changes
* expansion
* collapse
* navigation
* feedback

Respect reduced-motion preferences.

---

# 42. ICONOGRAPHY

Use one coherent icon language.

Do not mix:

* outlined icons
* filled icons
* cartoon icons
* 3D icons
* emoji
* random SVG illustrations

without a deliberate reason.

Icons should generally support the interface rather than dominate it.

---

# 43. ICON CONTAINER PHILOSOPHY

Do not automatically put every icon inside:

```txt

colored circle

```

Ask:

> Does the container communicate meaning?

If not:

remove it.

Sometimes the icon alone is cleaner.

---

# 44. DECORATIVE ELEMENT PHILOSOPHY

Every decorative element must justify its existence.

Examples:

* divider
* line
* dot
* glow
* gradient
* illustration
* pattern

If removing it makes the interface clearer:

remove it.

---

# 45. THE NO-RANDOM-LINE RULE

Never add a line merely to make a component "look designed."

Especially avoid:

```txt

────── red line ──────

```

beneath:

* modal handles
* tabs
* headers
* cards
* buttons

unless the line has a clear semantic purpose.

A line should communicate structure.

---

# 46. THE NO-AI-SLOP RULE

The product must not look like a generic AI-generated dashboard.

Avoid excessive use of:

* rounded cards
* pill buttons
* gradients
* glassmorphism
* glowing shadows
* colored icon circles
* excessive badges
* arbitrary illustrations
* huge headings
* excessive whitespace
* random decorative shapes
* unnecessary floating elements

The interface should feel:

> designed, not generated.

---

# 47. COMPONENT FAMILY PHILOSOPHY

Components should belong to families.

For example:

```txt

Button family

├── Primary

├── Secondary

├── Ghost

├── Destructive

└── Icon

Card family

├── Standard

├── Elevated

├── Prominent

└── Credential

Input family

├── Text

├── Select

├── Search

├── Date

└── Password

```

Members of the same family should share:

* geometry
* typography
* spacing
* states
* interaction behavior

---

# 48. SHARED COMPONENT FIRST

If a problem appears in multiple places:

> Fix the shared component.

Do not duplicate the same fix across 17 files.

But before changing a shared component:

verify that the change will not create regressions elsewhere.

---

# 49. LOCAL EXCEPTION PHILOSOPHY

Exceptions are allowed.

But exceptions must be intentional.

Good:

```txt

rounded-2xl

```

for a large hero surface.

Good:

```txt

rounded-full

```

for a circular avatar.

Bad:

```txt

rounded-[17px]

```

because:

> "17 looked better."

Exceptions should have a reason.

---

# 50. DESIGN SYSTEM OVER COMPONENT PREFERENCE

When a component developer says:

> "I personally like this radius."

that is not sufficient.

The question is:

> "Does this belong to the system?"

The product should not change personality from screen to screen because

different developers implemented different components.

---

# 51. VISUAL CONSISTENCY ≠ IDENTICALITY

Consistency does not mean:

```txt

everything = rounded-lg

```

That is not a design system.

A strong system contains variation with rules.

For example:

```txt

small control → sm

normal control → md

primary large control → lg

prominent panel → xl

large surface → 2xl

circle/micro element → full

```

Variation is allowed.

Randomness is not.

---

# 52. VISUAL DENSITY

Every screen should have an intentional density.

Avoid both:

### Too Dense

Everything touches everything.

### Too Sparse

Huge empty areas make simple information feel unnecessarily distant.

Aim for:

> breathable density.

---

# 53. INFORMATION BEFORE DECORATION

When deciding between:

```txt

more decoration

```

and:

```txt

clearer information

```

choose clearer information.

The interface exists to help users accomplish something.

---

# 54. REAL-WORLD METAPHOR

Use physical geometry where appropriate.

For example:

* credential → card-like
* bottom sheet → physically attached to bottom
* button → tangible action surface
* drawer → slides from an edge
* map marker → spatial marker
* handle → draggable affordance

But do not overdo skeuomorphism.

Use metaphor to improve comprehension.

---

# 55. DESIGNING FOR STATES

Every important component should be considered in:

```txt

Default

Hover

Focus

Active

Selected

Disabled

Loading

Error

Success

Empty

```

A component that looks perfect only in its default state is incomplete.

---

# 56. LOADING STATES

Loading should preserve geometry.

Do not let a loading state suddenly:

* change radius
* change height
* jump position
* alter layout
* resize buttons

Prefer stable geometry.

---

# 57. ERROR STATES

Errors should explain:

1. What happened?
2. Where did it happen?
3. What should the user do?

Do not rely solely on red.

Use:

* text
* icon
* position
* semantics

together.

---

# 58. EMPTY STATES

Empty states should not become giant illustrations unless appropriate.

Communicate:

```txt

What is empty?

Why?

What can the user do?

```

Keep the action obvious.

---

# 59. CONTENT LENGTH

Design for real content.

Test:

* long names
* long emails
* long identifiers
* multiple roles
* long descriptions
* translated text
* missing data

Never design only for:

```txt

John Doe

```

and assume reality will cooperate.

---

# 60. OVERFLOW PHILOSOPHY

Never allow important content to collide.

Use intentionally:

* wrapping
* truncation
* stacking
* scrolling
* responsive layout

Do not simply hide overflow.

---

# 61. FORMULA FOR VISUAL REALITY

When diagnosing a visual defect, remember:

```txt

Visual Reality =

    Radius

  + Height

  + Width

  + Inset

  + Padding

  + Border

  + Shadow

  + Clipping

  + Neighbor Spacing

  + Typography

  + Color

```

Therefore:

> A visually incorrect component does not necessarily have an incorrect

> border-radius.

Always diagnose the whole object.

---

# 62. VISUAL FORENSICS

When something looks wrong:

DO NOT immediately edit CSS.

Use:

```txt

Observe

↓

Identify

↓

Render

↓

Diagnose

↓

Fix

↓

Render again

↓

Compare

↓

Verify

```

Ask:

> What exactly looks wrong?

Not:

> What CSS class can I change?

---

# 63. CODE INSPECTION IS NOT VISUAL QA

These do NOT prove visual correctness:

* TypeScript passes
* ESLint passes
* tests pass
* build passes
* grep is clean
* radius tokens are correct

They prove engineering correctness.

Visual correctness requires:

> actual rendering + actual inspection.

---

# 64. RENDERED UI IS THE FINAL AUTHORITY

If code says:

```txt

rounded-md

```

but the rendered component looks wrong because of:

* height
* border
* clipping
* pseudo-element
* shadow
* nested element

then the rendered result is wrong.

Fix the actual visual problem.

---

# 65. VISUAL REGRESSION RULE

After changing shared UI:

Always inspect affected screens.

Especially after changing:

* buttons
* cards
* inputs
* navigation
* modal/sheet
* radius tokens
* spacing tokens
* typography
* colors

One shared change can create dozens of visual regressions.

---

# 66. BROWSER-FIRST VALIDATION

For important UI work:

```txt

Source

↓

Browser

↓

Screenshot

↓

Inspection

```

not merely:

```txt

Source

↓

Tests

↓

Done

```

---

# 67. RESPONSIVE VISUAL QA

At minimum inspect:

```txt

375px

390px

430px

768px

1024px

1440px

```

when applicable.

Look for:

* wrapping
* clipping
* overflow
* button compression
* inconsistent radius perception
* drawer behavior
* bottom-sheet behavior
* navigation changes
* card stacking

---

# 68. THE "DO NOT OVER-CORRECT" RULE

Once the interface is visually coherent:

STOP.

Do not keep changing it because:

> "Maybe this could be even better."

Every change has regression risk.

A visually correct system with a few intentional exceptions is better than

an endlessly modified system.

---

# 69. THE "MINIMUM NECESSARY CHANGE" RULE

When fixing a visual issue:

Prefer:

```txt

smallest change

+

largest improvement

```

Avoid:

```txt

rewrite entire component

```

unless the architecture itself is the problem.

---

# 70. DESIGN MATURITY TEST

Before approving a screen, ask:

### Geometry

Do the curves belong together?

### Hierarchy

Can I immediately tell what matters?

### Spacing

Does the layout breathe?

### Typography

Does text establish hierarchy?

### Color

Does color communicate meaning?

### Interaction

Can I tell what is clickable?

### Accessibility

Can everyone understand and operate it?

### Responsiveness

Does it work at narrow widths?

### Consistency

Does it look like the same product?

### Restraint

Can anything be removed without making it worse?

---

# 71. THE 5-SECOND TEST

Show the screen for approximately five seconds.

Ask:

1. What is this screen?
2. What is the most important thing?
3. What should I do?
4. What information matters?
5. Where should my eye go next?

If those answers are unclear:

the hierarchy needs work.

---

# 72. THE SQUINT TEST

Mentally or physically blur/squint the interface.

If the visual hierarchy still works:

good.

If everything becomes the same visual weight:

the hierarchy is weak.

This helps identify:

* excessive borders
* excessive badges
* excessive colors
* excessive shadows
* excessive cards

---

# 73. THE REMOVE-ONE-THING TEST

For every decorative element ask:

> "Would the interface become clearer if this disappeared?"

If yes:

remove it.

This is one of the strongest defenses against visual clutter.

---

# 74. THE FAMILY TEST

Place related components beside each other.

For example:

```txt

Button

Input

Card

Badge

Dialog

Navigation

```

Ask:

> "Do these look like they were designed by the same system?"

If not:

find the systemic inconsistency.

Do not patch each component independently.

---

# 75. UI/UX PRO MAX PHILOSOPHY

When the `ui-ux-pro-max` skill is available:

Use it as an expert review layer.

It should help evaluate:

* hierarchy
* spacing
* typography
* color
* accessibility
* interaction
* responsive behavior
* component patterns
* usability

But do NOT blindly follow generated recommendations.

The project-specific `RULE.md` and design system remain authoritative.

---

# 76. UNLAZY PHILOSOPHY

When the `unlazy` skill is available:

Use it to improve implementation quality and visual polish.

Do not interpret "unlazy" as:

> "Add more design."

Interpret it as:

> "Do the careful work required to make the interface actually excellent."

That includes:

* checking states
* checking responsive layouts
* checking spacing
* checking alignment
* checking content
* checking interactions
* checking edge cases
* checking actual rendering

---

# 77. EXTERNAL SKILLS ARE REVIEWERS, NOT AUTHORITIES

Tools and skills may recommend:

* different spacing
* different components
* different colors
* different radii
* different layouts

Do not blindly accept them.

Priority order:

```txt

Project RULE.md

      ↓

Project Design System

      ↓

Existing Product Language

      ↓

Accessibility

      ↓

Established Component Patterns

      ↓

External UX Recommendations

      ↓

Personal Preference

```

Personal preference is last.

---

# 78. NO DESIGN DRIFT

Over time, projects accumulate small inconsistencies.

Examples:

```txt

Component A → 12px

Component B → 14px

Component C → 16px

Component D → 18px

```

or:

```txt

Button A → 40px

Button B → 42px

Button C → 44px

```

or:

```txt

Shadow A → subtle

Shadow B → huge

Shadow C → glow

```

Periodically audit the system.

The goal is to eliminate accidental drift.

---

# 79. DOCUMENT EXCEPTIONS

If something intentionally violates the normal system:

document why.

Example:

```md

### Exception: Credential Card

Uses rounded-2xl because the object represents a physical credential

and requires a more prominent surface treatment.

```

Intentional exceptions are healthy.

Undocumented exceptions become design debt.

---

# 80. DESIGN DEBT

Design debt includes:

* arbitrary radius values
* duplicate components
* inconsistent button heights
* inconsistent icon sizes
* inconsistent spacing
* random colors
* duplicate shadows
* undocumented exceptions
* one-off CSS hacks
* visual fixes that only work at one viewport

Treat design debt similarly to technical debt.

---

# 81. BEFORE ADDING A NEW COMPONENT

Ask:

> Does an existing component already solve this?

If yes:

reuse it.

If not:

ask:

> Is this actually a new component family?

If yes:

define its design rules before implementing it.

Do not create 20 visually unrelated one-off components.

---

# 82. BEFORE ADDING A NEW TOKEN

Ask:

> Can an existing token represent this correctly?

If yes:

use it.

If no:

determine whether the new token represents a genuine semantic category.

Do not create tokens for individual pixels.

---

# 83. BEFORE CHANGING A SHARED TOKEN

Ask:

> How many components depend on this?

Then:

1. identify affected components
2. render representative screens
3. make the change
4. re-render
5. inspect for regression

Never make global design changes blindly.

---

# 84. DESIGN SYSTEM EVOLUTION

The system may evolve.

But evolution must be deliberate.

A new token should:

* solve a real repeated problem
* have semantic meaning
* improve consistency
* reduce exceptions
* be documented

Do not create a new token because:

> "This one component needs 18px."

---

# 85. PERFORMANCE PHILOSOPHY

Visual quality should not unnecessarily harm performance.

Avoid excessive:

* animations
* filters
* blur
* box shadows
* DOM nesting
* decorative SVGs
* JavaScript-driven motion

Beautiful UI must still be fast.

---

# 86. MOTION PHILOSOPHY

Motion should have hierarchy.

Micro:

```txt

100–200ms

```

Normal interaction:

```txt

200–300ms

```

Larger transitions:

```txt

300–500ms

```

These are guidelines, not laws.

Avoid unnecessarily slow UI.

---

# 87. REDUCED MOTION

Respect:

```css

prefers-reduced-motion

```

Users should not be forced to experience unnecessary motion.

---

# 88. SECURITY / TRUST VISUALS

For products involving:

* accounts
* credentials
* payments
* permissions
* identity
* sensitive information

visual clarity is especially important.

Do not use decorative ambiguity around:

* security warnings
* permission changes
* destructive actions
* credential changes

The user must understand consequences.

---

# 89. TRUST PHILOSOPHY

A professional product should visually communicate:

* stability
* predictability
* clarity
* restraint

Avoid visual tricks that reduce trust.

Examples:

* excessive animations
* misleading colors
* fake loading states
* confusing buttons
* unclear disabled states
* ambiguous destructive actions

---

# 90. FINAL QUALITY GATE

A feature is NOT finished simply because:

```txt

code works

```

It is finished when:

```txt

code works

+

visual system is coherent

+

responsive behavior works

+

states work

+

accessibility works

+

actual rendering has been inspected

```

---

# 91. FINAL DESIGN CHECKLIST

Before declaring a feature complete:

## Geometry

* [ ] Radius uses semantic tokens
* [ ] No arbitrary radius hacks
* [ ] Curves feel related
* [ ] Nested curves are coherent
* [ ] Pills are intentional
* [ ] Circles are intentional

## Layout

* [ ] Alignment is consistent
* [ ] Spacing has rhythm
* [ ] No accidental overflow
* [ ] Mobile layout works
* [ ] Desktop layout works

## Surfaces

* [ ] Borders are purposeful
* [ ] Shadows are purposeful
* [ ] No excessive nested cards
* [ ] Surface hierarchy is clear

## Typography

* [ ] Heading hierarchy is clear
* [ ] Metadata is appropriately subdued
* [ ] No unnecessary bolding
* [ ] No excessive uppercase

## Color

* [ ] Colors are semantic
* [ ] Accent color is controlled
* [ ] Destructive states are clear
* [ ] Contrast is sufficient
* [ ] No decorative color noise

## Interaction

* [ ] Buttons communicate hierarchy
* [ ] Focus states work
* [ ] Hover states work
* [ ] Disabled states are clear
* [ ] Loading states preserve geometry
* [ ] Error states are understandable

## Responsive

* [ ] 375px
* [ ] 390px
* [ ] 430px
* [ ] 768px
* [ ] 1024px
* [ ] 1440px

where applicable.

## Visual QA

* [ ] Actual browser rendering inspected
* [ ] Screenshots inspected
* [ ] Shared components checked
* [ ] Regression checked
* [ ] No speculative changes remain

---

# 92. THE FINAL RULE

## DESIGN LESS. DESIGN BETTER.

Do not add visual treatment because the interface feels empty.

Do not add cards because information needs "a container."

Do not add pills because they look modern.

Do not add gradients because the screen needs color.

Do not add shadows because the UI needs depth.

Do not add animations because the page feels static.

Do not add radius because the corner looks too sharp.

First ask:

> What does the user need?

Then:

> What does the hierarchy require?

Then:

> What does the design system allow?

Then:

> What is the smallest visual treatment that solves the problem?

The best interface is not the one with the most design.

It is the one where every design decision feels inevitable.

---

# 93. MASTER PRINCIPLE

When in doubt:

```txt

CLARITY

    >

DECORATION

INTENTION

    >

TREND

SYSTEM

    >

PERSONAL PREFERENCE

CONSISTENCY

    >

UNIFORMITY

ACCESSIBILITY

    >

AESTHETICS

REAL RENDERING

    >

THEORETICAL CSS

SIMPLICITY

    >

VISUAL NOISE

PURPOSE

    >

ORNAMENT

```

And above all:

> Build a system that can explain why every visual decision exists.

````