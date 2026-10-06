# Generates evals/golden/topic-tag-v1.json, the golden set for the topic_tag stage (syllabus map).
#
# Synthetic only: every question and answer is original and written for this eval. No student data,
# no past-paper text, no board text beyond the objective codes the labels point at. Each case names
# the syllabus it is tagged against and the objective codes a teacher would accept:
#   primary   codes any one of which is a correct primary tag (the same skill can sit in two units,
#             e.g. logarithms in Pure 1 and Pure 3)
#   also_ok   codes that are fair secondary tags; a strong tag outside primary + also_ok is wrong
#   control   "off_syllabus" / "no_context": the right answer is no strong tag at all
# Labels were drafted by Claude and confirmed by the owner on 2026-10-06 (eval run 7ca49ba7 matched
# every one); they are human labels now. A new or changed case starts as a draft again.
import json, uuid

NS = uuid.UUID("3b8e5c1a-7d24-4f0e-9a61-2c5d8e7f1b40")
cases = []


def case(key, code, label, marks, q, ans, primary=(), also_ok=(), control=None, traps=()):
    cases.append({
        "id": str(uuid.uuid5(NS, key)),
        "key": key,
        "syllabus_code": code,
        "label": label,
        "marks_available": marks,
        "question_text": q,
        "student_answer": ans,
        "expected": {"primary": list(primary), "also_ok": list(also_ok), "control": control},
        "traps": list(traps),
        "needs_human_label": False,
    })


# ---------------- 9709 Mathematics ----------------
case("m-complete-square", "9709", "1(a)", 3,
     "Express 2x^2 - 12x + 7 in the form a(x + b)^2 + c, where a, b and c are constants. Hence state the coordinates of the minimum point of y = 2x^2 - 12x + 7.",
     "2(x-3)^2 - 11, min point (3, -11)", ["1.1.1"], ["1.3.5"])
case("m-discriminant-line-curve", "9709", "4", 5,
     "Find the set of values of k for which the line y = kx - 3 does not meet the curve y = x^2 + 2x + 1.",
     "x^2 + (2-k)x + 4 = 0, b^2 - 4ac < 0, (2-k)^2 < 16, -2 < k < 6", ["1.1.2"], ["1.1.3", "1.1.4", "1.3.4"],
     traps=["shares words with straight lines; the marks are for the discriminant"])
case("m-sector", "9709", "6", 4,
     "The diagram shows a sector OAB of a circle with centre O and radius 8 cm. The angle AOB is 1.2 radians. Find the perimeter and the area of the sector.",
     "arc = 9.6, perimeter = 25.6 cm, area = 0.5 x 64 x 1.2 = 38.4 cm^2", ["1.4.2"], ["1.4.1"])
case("m-trig-equation", "9709", "5", 5,
     "Solve the equation 3 sin^2 θ - 2 cos θ - 2 = 0 for 0° ≤ θ ≤ 360°.",
     "3(1 - cos^2 θ) - 2cos θ - 2 = 0, 3cos^2 θ + 2cos θ - 1 = 0, cos θ = 1/3 or -1, θ = 70.5°, 180°, 289.5°",
     ["1.5.5", "1.5.4"], ["1.5.4", "1.5.5", "1.1.5", "2.3.2", "3.3.2"])
case("m-binomial", "9709", "2", 3,
     "Find the coefficient of x^3 in the expansion of (2 - x/2)^7.",
     "7C3 x 2^4 x (-1/2)^3 = 35 x 16 x -1/8 = -70", ["1.6.1"], [])
case("m-gp-sum-infinity", "9709", "7(b)", 4,
     "The first term of a geometric progression is 24 and the sum to infinity is 96. Find the common ratio and the fourth term.",
     "24/(1-r) = 96, r = 3/4, fourth term = 24 x (3/4)^3 = 10.125", ["1.6.4"], ["1.6.2", "1.6.3"])
case("m-stationary-points", "9709", "9", 6,
     "The curve y = x^3 - 6x^2 + 9x + 2 has two stationary points. Find their coordinates and determine the nature of each.",
     "dy/dx = 3x^2 - 12x + 9 = 0, x = 1 or 3, (1, 6) max, (3, 2) min using second derivative",
     ["1.7.4"], ["1.7.2", "1.7.3"])
case("m-area-under-curve", "9709", "8", 4,
     "Find the area of the region bounded by the curve y = 6x - x^2 and the x-axis.",
     "integral from 0 to 6 of 6x - x^2 = [3x^2 - x^3/3] = 108 - 72 = 36", ["1.8.4"], ["1.8.1", "1.8.3"])
case("m-log-equation", "9709", "3", 4,
     "Use logarithms to solve the equation 5^(2x - 1) = 3^(x + 2), giving x correct to 3 significant figures.",
     "(2x-1)ln5 = (x+2)ln3, x(2ln5 - ln3) = 2ln3 + ln5, x = 1.62", ["2.2.3", "3.2.3"], ["2.2.1", "3.2.1"])
case("m-by-parts", "9709", "6", 5,
     "Use integration by parts to find the exact value of the integral of x e^(2x) from 0 to 1.",
     "[x e^(2x)/2] - integral e^(2x)/2 = (e^2 + 1)/4", ["3.5.5"], ["3.5.1", "2.5.1"])
case("m-skew-lines", "9709", "10(b)", 4,
     "The lines l and m have equations r = i + 2j - k + s(2i - j + 3k) and r = 3i + j + 2k + t(i + j - k). Show that l and m are skew.",
     "not parallel since direction vectors not multiples; equating components gives inconsistent equations so skew",
     ["3.7.5"], ["3.7.4"])
case("m-normal-distribution", "9709", "5(a)", 3,
     "The masses of apples from an orchard are normally distributed with mean 152 g and standard deviation 11 g. Find the probability that a randomly chosen apple has a mass greater than 170 g.",
     "z = (170-152)/11 = 1.636, P = 1 - 0.949 = 0.0509", ["5.5.2"], ["5.5.1"])
case("m-friction", "9709", "3", 4,
     "A box of mass 5 kg rests on a rough horizontal floor. The coefficient of friction between the box and the floor is 0.3. A horizontal force of 20 N is applied to the box. Determine whether the box moves, justifying your answer.",
     "R = 50, max friction = 15 N < 20 N so box moves", ["4.1.6"], ["4.1.1", "4.1.3", "4.1.4", "4.4.1"])
case("m-hypothesis-binomial", "9709", "6", 5,
     "A coin is thrown 12 times and shows heads 10 times. Test at the 5% significance level whether the coin is biased towards heads.",
     "H0 p = 0.5, H1 p > 0.5, P(X ≥ 10) = 0.0193 < 0.05, reject H0, evidence of bias", ["6.5.2"], ["6.5.1", "5.4.2"])
case("m-no-context", "9709", "7(ii)", 2,
     "(ii) Hence find the value of k.",
     "k = 4", control="no_context",
     traps=["a part with no stem cannot be placed; an empty answer beats a guess"])
case("m-off-syllabus", "9709", "2", 3,
     "Describe the role of mitochondria in a eukaryotic cell.",
     "they release energy by respiration", control="off_syllabus")

# ---------------- 9231 Further Mathematics ----------------
case("f-roots", "9231", "1", 4,
     "The roots of the equation x^3 - 4x^2 + 2x - 7 = 0 are α, β and γ. Find the value of α^2 + β^2 + γ^2.",
     "Σα = 4, Σαβ = 2, Σα^2 = 16 - 4 = 12", ["1.1.1"], [])
case("f-differences", "9231", "3", 5,
     "Use the method of differences to find the sum of 1/(r(r + 1)) for r = 1 to n, and deduce the sum to infinity.",
     "1/r - 1/(r+1), sum = 1 - 1/(n+1), sum to infinity = 1", ["1.3.2"], ["1.3.3"])
case("f-induction", "9231", "2", 5,
     "Prove by mathematical induction that 7^n - 1 is divisible by 6 for every positive integer n.",
     "n=1 gives 6; assume 7^k - 1 = 6m; 7^(k+1) - 1 = 7(6m+1) - 1 = 42m + 6", ["1.7.1"], [])
case("f-eigen", "9231", "5(a)", 5,
     "Find the eigenvalues of the matrix with rows (3, 1) and (2, 2), and a corresponding eigenvector for each eigenvalue.",
     "λ^2 - 5λ + 4 = 0, λ = 1, 4; eigenvectors (1, -2) and (1, 1)", ["2.2.4"], ["2.2.3"])
case("f-de-moivre", "9231", "6", 6,
     "Use de Moivre's theorem to express cos 5θ in terms of powers of cos θ.",
     "Re((c + is)^5) = c^5 - 10c^3 s^2 + 5cs^4, cos5θ = 16c^5 - 20c^3 + 5c", ["2.5.3"], ["2.5.1"])
case("f-second-order-de", "9231", "8", 8,
     "Find the general solution of the differential equation d^2y/dx^2 - 5 dy/dx + 6y = 2x.",
     "CF A e^(2x) + B e^(3x), PI y = x/3 + 5/18", ["2.6.3", "2.6.4"], ["2.6.2", "2.6.3", "2.6.4"])
case("f-projectile", "9231", "1", 4,
     "A particle is projected from a point on horizontal ground with speed 20 m s^-1 at an angle of 30° above the horizontal. Find the greatest height reached by the particle.",
     "vertical component 10, v^2 = u^2 - 2gs, s = 100/20 = 5 m", ["3.1.2"], ["3.1.1"])
case("f-maclaurin", "9231", "4", 5,
     "Find the Maclaurin series for ln(1 + sin x) up to and including the term in x^2.",
     "f(0) = 0, f'(0) = 1, f''(0) = -1, so x - x^2/2", ["2.3.3"], [])
case("f-vertical-circle", "9231", "5", 6,
     "One end of a light inextensible string of length 0.8 m is attached to a fixed point O and a particle of mass 0.2 kg is attached to the other end. The particle moves in a complete vertical circle with speed 5 m s^-1 at its lowest point. Find the tension in the string at the lowest point.",
     "T - mg = mv^2/r, T = 2 + 0.2 x 25/0.8 = 8.25 N", ["3.3.4"], ["3.3.2"])
case("f-unreadable", "9231", "4(b)", 3,
     "4 (b) Hence [illegible] the value of [illegible] as n tends to [illegible].",
     "", control="no_context",
     traps=["unreadable stem: never tag from the surviving words"])

# ---------------- 9702 Physics ----------------
case("p-suvat", "9702", "2(b)", 3,
     "A car accelerates uniformly from 5.0 m s^-1 to 25 m s^-1 in 8.0 s. Calculate the distance travelled by the car in this time.",
     "s = (u + v)t/2 = 15 x 8 = 120 m", ["2.1.7"], ["2.1.1", "2.1.6"])
case("p-state-momentum", "9702", "3(a)", 2,
     "State the principle of conservation of momentum.",
     "total momentum of a system stays constant if no resultant external force acts", ["3.3.1"], [])
case("p-collision", "9702", "3(b)", 4,
     "A ball of mass 0.20 kg moving at 6.0 m s^-1 collides head-on with a stationary ball of mass 0.30 kg. After the collision the first ball is at rest. Calculate the speed of the second ball and state, with a reason, whether the collision is elastic.",
     "1.2 = 0.3v, v = 4.0; KE before 3.6 J, after 2.4 J so inelastic", ["3.3.2"], ["3.3.3", "3.1.3", "5.2.4"])
case("p-moments", "9702", "4(b)", 3,
     "A uniform beam of length 2.0 m is pivoted at its centre. A weight of 30 N hangs 0.40 m from the pivot. Calculate the distance from the pivot, on the other side, at which a 20 N weight must hang for the beam to balance.",
     "30 x 0.4 = 20 x d, d = 0.60 m", ["4.2.1"], ["4.1.2", "4.2.2"])
case("p-hydrostatic", "9702", "4(c)", 2,
     "Calculate the increase in pressure at a depth of 12 m below the surface of seawater of density 1030 kg m^-3.",
     "Δp = ρgΔh = 1030 x 9.81 x 12 = 1.2 x 10^5 Pa", ["4.3.4"], ["4.3.2", "4.3.3"])
case("p-resistivity", "9702", "5(a)", 3,
     "A wire of length 2.0 m and cross-sectional area 0.20 mm^2 has a resistance of 3.4 Ω. Calculate the resistivity of the material of the wire.",
     "ρ = RA/L = 3.4 x 0.2 x 10^-6 / 2 = 3.4 x 10^-7 Ω m", ["9.3.6"], ["9.3.2"])
case("p-combined-resistance", "9702", "6(a)", 3,
     "A 6.0 Ω resistor and a 3.0 Ω resistor are connected in parallel. This combination is connected in series with a 4.0 Ω resistor. Calculate the total resistance.",
     "parallel 2.0 Ω, total 6.0 Ω", ["10.2.6", "10.2.4"], ["10.2.4", "10.2.6", "10.2.7"])
case("p-doppler-explain", "9702", "4(a)", 3,
     "Explain why the frequency of the siren heard by a stationary observer is higher than the emitted frequency while the ambulance moves towards the observer.",
     "the waves get squashed, wavelength shorter so frequency higher", ["7.3.1"], ["7.3.2"])
case("p-photoelectric", "9702", "7(b)", 3,
     "Light of wavelength 450 nm is incident on a metal surface of work function 2.3 eV. Calculate the maximum kinetic energy of the emitted electrons.",
     "E = hc/λ = 4.42 x 10^-19 J, Φ = 3.68 x 10^-19 J, KE max = 7.4 x 10^-20 J", ["22.2.4"], ["22.1.3", "22.1.4", "22.2.3"])
case("p-half-life", "9702", "8(b)", 4,
     "A radioactive isotope has a half-life of 8.0 days. Calculate its decay constant, in s^-1, and the fraction of the original nuclei remaining after 20 days.",
     "λ = 0.693/(8 x 86400) = 1.0 x 10^-6 s^-1, fraction = e^(-λt) = 0.18", ["23.2.5", "23.2.6"], ["23.2.3", "23.2.5", "23.2.6"])
case("p-uniform-field", "9702", "6(a)", 2,
     "Two parallel metal plates are 4.0 mm apart and have a potential difference of 600 V between them. Calculate the electric field strength between the plates.",
     "E = V/d = 600 / 0.004 = 1.5 x 10^5 V m^-1", ["18.2.1"], ["18.1.1"])
case("p-capacitor-discharge", "9702", "7(c)", 4,
     "A 470 μF capacitor charged to 12 V discharges through a 10 kΩ resistor. Calculate the time constant and the potential difference across the capacitor after 3.0 s.",
     "τ = RC = 4.7 s, V = 12 e^(-3/4.7) = 6.3 V", ["19.3.2", "19.3.3"], ["19.3.2", "19.3.3", "19.3.1"])
case("p-latent-heat-define", "9702", "2(a)", 2,
     "Define specific latent heat of vaporisation.",
     "energy to change unit mass from liquid to gas without a change in temperature", ["14.3.2"], [])
case("p-off-syllabus", "9702", "1", 3,
     "Write a balanced equation for the reaction between magnesium and dilute hydrochloric acid, and name the salt formed.",
     "Mg + 2HCl -> MgCl2 + H2, magnesium chloride", control="off_syllabus",
     traps=["a chemistry question on a physics paper: no physics objective is assessed"])

# ---------------- 9618 Computer Science ----------------
case("c-number-bases", "9618", "1(a)", 3,
     "Convert the denary number 173 into 8-bit binary and into hexadecimal.",
     "10101101, AD", ["1.1.2"], ["1.1.1"])
case("c-bitmap-size", "9618", "2(b)", 3,
     "A bitmap image is 1200 pixels wide and 800 pixels high and uses a colour depth of 24 bits. Calculate the file size of the image in mebibytes, showing your working.",
     "1200 x 800 x 24 / 8 = 2 880 000 bytes = 2.75 MiB", ["1.2.2"], ["1.2.1", "1.1.1"])
case("c-compression", "9618", "3", 4,
     "Explain the difference between lossy and lossless compression. Give one situation in which each would be the better choice.",
     "lossy removes data permanently e.g. streaming video; lossless keeps all data e.g. text files", ["1.3.2"], ["1.3.1", "1.3.3"])
case("c-truth-table", "9618", "4(a)", 4,
     "Complete the truth table for the logic expression X = (A AND B) OR NOT C.",
     "table with 8 rows, X = 1 when C = 0 or when A and B are both 1", ["3.2.5", "3.2.3"], ["3.2.2", "3.2.3", "3.2.5", "3.2.6"])
case("c-fetch-execute", "9618", "5", 5,
     "Describe the stages of the fetch-execute cycle, using register transfer notation where appropriate.",
     "MAR <- [PC], PC <- [PC] + 1, MDR <- [[MAR]], CIR <- [MDR], decode, execute", ["4.1.7"], ["4.1.2"])
case("c-normalise", "9618", "6(b)", 5,
     "The table ORDER(OrderID, CustomerName, CustomerPhone, ProductID, ProductName, Quantity) is not in third normal form. Explain why, and produce a set of tables in third normal form.",
     "repeating product data and customer phone depends on name not key; split into ORDER, CUSTOMER, PRODUCT, ORDER_LINE",
     ["8.1.6", "8.1.7"], ["8.1.5", "8.1.6", "8.1.7", "8.1.3"])
case("c-binary-search", "9618", "7", 6,
     "Write pseudocode for a function that performs a binary search for a given value in a 1D array of 100 integers sorted in ascending order. The function returns the index of the value, or -1 if it is not found.",
     "Low <- 1, High <- 100, WHILE Low <= High, Mid <- (Low + High) DIV 2, ... ENDWHILE, RETURN -1",
     ["19.1.1"], ["10.2.4", "9.2.4", "11.3.4"])
case("c-stack-array", "9618", "8(a)", 4,
     "Explain how a stack can be implemented using a 1D array and a top-of-stack pointer, describing what happens when an item is pushed.",
     "array holds items, pointer starts at 0, push checks full, increments pointer, stores item", ["10.4.4"], ["10.4.2", "10.4.3", "19.1.3"])
case("c-router", "9618", "2(a)", 2,
     "Describe the role of a router in a network.",
     "it forwards packets between networks using IP addresses", ["2.1.9"], ["2.1.1"])
case("c-off-syllabus", "9618", "1", 4,
     "Discuss two long-term causes of the First World War.",
     "the alliance system and militarism", control="off_syllabus")

json.dump({
    "golden_set_version": "topic-tag-synthetic-v1",
    "stage": "topic_tag",
    "labels": "Drafted by Claude, confirmed by the owner on 2026-10-06",
    "cases": cases,
}, open(__file__.replace("build_topic_tag_v1.py", "topic-tag-v1.json"), "w"), ensure_ascii=False, indent=1)
print(len(cases), "cases")
