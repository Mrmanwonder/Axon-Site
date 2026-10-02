# Generates evals/golden/explain-v1.json. Synthetic only: every question and answer here is
# original and invented for the eval. No student data, no board text. Marks are the "teacher's",
# fixed by construction, so a contradiction check against them is exact. Causes are DRAFT
# labels (needs_human_label) and are never the release gate.
import json, uuid

NS = uuid.UUID("6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f")
cases = []

def case(key, curriculum, subject, level, label, q, ans, got, of, remark, draft_cause, traps, parts=None, shapes=None):
    cases.append({
        "id": str(uuid.uuid5(NS, key)),
        "key": key,
        "curriculum": curriculum,
        "subject": subject,
        "class_level": level,
        "label": label,
        "question_text": q,
        "student_answer": ans,
        "marks_awarded": got,
        "marks_available": of,
        "teacher_remark": remark,
        "mark_shapes": shapes or ["cross"],
        "prior_parts": parts or [],
        "draft_cause": draft_cause,        # DRAFT: needs a human label before it can be truth
        "traps": traps,                    # what this case is designed to catch
        "needs_human_label": True,
    })

# ---------------- Cambridge (IGCSE / AS / A Level) ----------------
case("cam-phys-unit", "cambridge", "Physics 0625", 10, "3(b)",
     "A trolley of mass 2.5 kg accelerates uniformly from rest to 4.0 m/s in 8.0 s. Calculate the resultant force on the trolley.",
     "a = 4.0 / 8.0 = 0.5. F = ma = 2.5 x 0.5 = 1.25",
     2, 3, "No unit on the final answer.", "presentation", ["answer right, unit missing: lead with what is right"])
case("cam-phys-sigfig", "cambridge", "Physics 9702", 11, "2(a)(i)",
     "A wire of length 1.20 m and cross-sectional area 0.50 mm^2 has resistance 0.36 ohm. Calculate the resistivity of the wire. Give your answer to an appropriate number of significant figures.",
     "rho = RA/L = (0.36 x 0.50 x 10^-6) / 1.20 = 1.5 x 10^-7 ohm m = 0.00000015 ohm m",
     2, 3, "Final answer given to too few s.f. / wrong form; not standard form.", "presentation", ["mark withheld for form, not method"])
case("cam-chem-keyword", "cambridge", "Chemistry 0620", 10, "5(c)",
     "Explain why the boiling point of water is much higher than that of hydrogen sulfide.",
     "Water has hydrogen bonding but hydrogen sulfide does not.",
     1, 2, "Compare the strength of the forces and say more energy is needed to overcome them.", "incomplete", ["explain needs a reason chain"])
case("cam-bio-command", "cambridge", "Biology 0610", 10, "4(a)",
     "State two differences between arteries and veins.",
     "Arteries carry blood away from the heart under high pressure and have thick walls with narrow lumen, while veins return blood to the heart in a different way.",
     1, 2, "State means one clear difference each. Second difference is vague.", "keyword_miss", ["command word State; marks lost for vagueness"])
case("cam-math-slip", "cambridge", "Mathematics 0580", 10, "7(a)",
     "Solve 3(2x - 5) = 4x + 7.",
     "6x - 15 = 4x + 7 → 2x = 22 → x = 11",
     3, 3, "", "none", ["fully correct but nothing lost: a case that must not be explained"])
case("cam-math-slip2", "cambridge", "Mathematics 9709", 11, "4",
     "Differentiate y = 3x^2 − 5x + 2 and find the gradient at x = 2.",
     "dy/dx = 6x − 5. At x = 2, gradient = 12 − 5 = 8.",
     1, 3, "Arithmetic: 12 − 5 = 7.", "procedural_slip", ["single slip after correct method"])
case("cam-chem-dispute", "cambridge", "Chemistry 9701", 12, "3(b)",
     "Predict the effect on the equilibrium position of increasing the pressure for N2(g) + 3H2(g) ⇌ 2NH3(g). Explain your answer.",
     "It moves right because there are fewer moles of gas on the right so it makes more ammonia. I think this should get full marks because it is correct.",
     1, 2, "Reason not linked to reducing the pressure.", "incomplete", ["student asserts they deserve more: must not adjudicate"])
case("cam-phys-dep", "cambridge", "Physics 9702", 12, "5(b)(ii)",
     "Use your answer to (b)(i) to calculate the energy stored in the capacitor.",
     "E = 1/2 x 4.7 x 10^-6 x 9.0^2 = 1.9 x 10^-4 J",
     0, 2, "Wrong value of V used; see (b)(i).", "conceptual_gap",
     ["depends on an earlier part that is supplied"],
     parts=[{"label": "5(b)(i)", "questionText": "The capacitor is charged through a 12 V cell and 3.0 V is lost across the resistor. State the potential difference across the capacitor.", "studentAnswer": "9.0 V", "marksAwarded": 1, "marksAvailable": 1}])

# ---------------- CBSE ----------------
case("cbse-phys-case", "cbse", "Physics", 12, "17",
     "A convex lens of focal length 20 cm forms a real image of an object kept 30 cm from it. Find the image distance and the magnification.",
     "1/v - 1/u = 1/f, u = -30, f = 20: 1/v = 1/20 - 1/30 = 1/60, v = 60 cm. m = v/u = 60/-30 = -2",
     2, 3, "Nature of image not stated (real, inverted, magnified).", "incomplete", ["method and numbers right; a statement missing"])
case("cbse-chem-ar", "cbse", "Chemistry", 12, "21",
     "Assertion: Aniline is less basic than ethylamine. Reason: The lone pair on nitrogen in aniline is delocalised into the benzene ring. Choose the correct option and justify.",
     "Both A and R are true and R explains A, because the lone pair is not available.",
     1, 2, "Justification too brief — mention resonance and reduced availability for protonation.", "keyword_miss", ["assertion–reason format"])
case("cbse-math-slip", "cbse", "Mathematics", 12, "9",
     "Find the area bounded by the curve y = x^2, the x-axis and the lines x = 1 and x = 3.",
     "Area = integral of x^2 from 1 to 3 = [x^3/3] = 27/3 - 1/3 = 26/3 square units. Final answer 26/3 = 8.33",
     2, 3, "Correct. Final answer to be left as 26/3; decimal approximation not required.", "presentation", ["right answer, mark lost for form"])
case("cbse-bio-diag", "cbse", "Biology", 12, "28",
     "Describe the process of double fertilisation in an angiosperm.",
     "Two male gametes enter the embryo sac. One fuses with the egg to form the zygote and the other fuses with the polar nuclei.",
     2, 3, "Name the products: triploid PEN and zygote, and say this is why it is double.", "incomplete", ["terms expected but missing"])
case("cbse-eng-misread", "cbse", "Mathematics", 12, "14",
     "A fair die is thrown twice. Find the probability that the sum is 8 given that at least one throw shows 3.",
     "Sum is 8: (2,6),(3,5),(4,4),(5,3),(6,2) = 5/36",
     0, 3, "You found P(sum=8). Question asks for the conditional probability.", "misread_question", ["answered a different question"])
case("cbse-phys-timed", "cbse", "Physics", 12, "30",
     "A 12 V cell of internal resistance 1 ohm is connected to two resistors of 3 ohm and 6 ohm in parallel. Find the current drawn from the cell and the terminal voltage.",
     "Req = 3x6/(3+6) = 2. Total R = 3",
     0, 3, "Incomplete — ran out of time.", "timed_out", ["blank after the first step; remark says out of time"])
case("cbse-chem-noremark", "cbse", "Chemistry", 12, "12",
     "Write the IUPAC name of CH3-CH(OH)-CH2-CH3 and state whether it is a primary, secondary or tertiary alcohol.",
     "Butan-2-ol, tertiary",
     1, 2, "", "conceptual_gap", ["mark lost, no remark at all: must not invent what the teacher thought"])
case("cbse-math-dispute", "cbse", "Mathematics", 12, "5",
     "Evaluate the integral of (2x + 3) dx from 0 to 2.",
     "[x^2 + 3x] from 0 to 2 = 4 + 6 = 10. My teacher marked this wrong but I think 10 is correct.",
     0, 2, "Check the lower limit.", "procedural_slip", ["student claims the teacher is wrong; the answer is in fact 10 so the model must still defer"])

# ---------------- IBDP ----------------
case("ib-bio-outline", "ibdp", "Biology SL", 11, "B2",
     "Outline the role of ATP synthase in the mitochondrion.",
     "ATP synthase makes ATP in the mitochondria.",
     1, 2, "Outline needs the mechanism: protons flow through it down their gradient and this drives phosphorylation of ADP.", "incomplete", ["command term Outline"])
case("ib-phys-discuss", "ibdp", "Physics HL", 12, "A3",
     "Discuss whether the speed of a satellite in circular orbit increases or decreases as its orbital radius increases.",
     "It decreases because gravity gets weaker further away so it does not need to go as fast.",
     2, 4, "Link gravitational force to centripetal force, v^2 = GM/r, and conclude explicitly.", "incomplete", ["command term Discuss; partly right"])
case("ib-chem-calc", "ibdp", "Chemistry SL", 11, "S1.4",
     "Calculate the amount, in mol, of hydrogen produced when 1.20 g of magnesium reacts completely with excess dilute hydrochloric acid. Ar(Mg) = 24.3.",
     "n(Mg) = 1.20 / 24.3 = 0.0494 mol. Mg + 2HCl → MgCl2 + H2, so 2 x 0.0494 = 0.0988 mol H2",
     1, 2, "Mole ratio is 1:1.", "conceptual_gap", ["wrong ratio from a correct equation"])
case("ib-math-ai", "ibdp", "Mathematics AI SL", 11, "5(a)",
     "The temperature T (°C) of a drink is modelled by T = 20 + 65 e^{-0.08t}. Find the temperature after 10 minutes.",
     "T = 20 + 65 e^{-0.8} = 20 + 29.2 = 49.2",
     1, 2, "Answer should be given to 3 s.f. in context with unit: 49.2 °C.", "presentation", ["answer right; unit/context missing"])
case("ib-econ-evaluate", "ibdp", "Economics HL", 12, "2(c)",
     "Evaluate the effectiveness of a carbon tax in reducing emissions.",
     "A carbon tax raises the price of polluting goods so people buy less of them. This reduces emissions. It is effective.",
     3, 8, "Needs a counter-argument (e.g. inelastic demand, leakage) and a justified judgement.", "incomplete", ["command term Evaluate; essay-style; no model answer should invent a rubric"])
case("ib-his-sources", "ibdp", "History SL", 12, "P1-3",
     "With reference to their origin and purpose, assess the value and limitations of Source B for a historian studying the causes of the 1929 stock market crash.",
     "Source B is a newspaper article so it is useful because it is from the time. A limitation is that it might be biased.",
     2, 5, "Say what the purpose is and how that shapes the content, not only that it may be biased.", "keyword_miss", ["OPCVL format; the source itself is not supplied"])
case("ib-cs-trace", "ibdp", "Computer Science SL", 11, "A1",
     "Trace the following algorithm for N = 5 and state the final value of S.  S = 0; loop I from 1 to N: if I mod 2 = 0 then S = S + I; end loop",
     "I=2: S=2, I=4: S=6, so S = 6.",
     2, 2, "", "none", ["fully correct; nothing to explain"])
case("ib-bio-natural-selection", "ibdp", "Biology HL", 12, "B5",
     "Explain how natural selection leads to a change in allele frequency.",
     "Individuals with a beneficial allele survive more often and pass it on so the frequency of that allele goes up in the next generation.",
     3, 4, "Mention differential reproduction and that the population evolves, not the individual.", "incomplete", ["close to full marks"])

json.dump({
    "golden_set_version": "explain-synthetic-v1",
    "stage": "explain",
    "note": "Synthetic. Draft causes only; needs_human_label on every case. Not student data.",
    "cases": cases,
}, open("evals/golden/explain-v1.json", "w"), indent=2, ensure_ascii=False)
print(len(cases), "cases", {c: sum(1 for x in cases if x["curriculum"] == c) for c in ("cambridge", "cbse", "ibdp")})
