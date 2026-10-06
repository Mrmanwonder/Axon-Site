# Generates evals/golden/scheme-check-v1.json, the golden set for the scheme_check stage
# (owner decision 6 Oct 2026: an unmarked Cambridge past paper is checked against its exact mark
# scheme and gets feedback plus an estimated mark, always labelled as Axon's estimate).
#
# Synthetic only. Every question, student answer AND scheme section below is original, written for
# this eval in an examiner's style. None of it is Cambridge or Pearson text: hard rule 2 forbids
# board scheme text in fixtures, so the "scheme" here is an invented stand-in with the same shape
# (marks per step, method/accuracy/independent marks, follow-through).
#
# Each case states what an examiner applying that invented scheme would accept:
#   can_check   false when the scheme section is for a different question, or the answer is unreadable
#   est         [min, max] estimated marks an examiner could defensibly give (inclusive)
# Controls the stage must get right every time:
#   blank       an empty answer must be estimated at exactly 0
#   mismatch    a scheme for a different question must give can_check false
#   verbatim    a scheme with long lines the model is tempted to copy; the validator rejects copying
# Labels are drafts written by Claude and await owner confirmation (needs_human_label true).
import json, uuid

NS = uuid.UUID("9c41f7a2-5b8d-4e36-a0c7-1d2e3f4a5b6c")
cases = []


def case(key, code, paper, label, marks, q, ans, scheme, can_check=True, est=None, control=None, traps=()):
    cases.append({
        "id": str(uuid.uuid5(NS, key)),
        "key": key,
        "syllabus_code": code,
        "paper": paper,
        "label": label,
        "marks_available": marks,
        "question_text": q,
        "student_answer": ans,
        "scheme": scheme,
        "conventions": "M: method mark, earned for a valid method even with an arithmetic slip. A: accuracy mark, needs the M mark it depends on. B: independent mark. FT: follow through from an earlier error.",
        "expected": {"can_check": can_check, "est": list(est) if est is not None else None, "control": control},
        "traps": list(traps),
        "needs_human_label": True,
    })


P1 = "9709/12 Synthetic eval paper"
P2 = "9231/11 Synthetic eval paper"
PH = "9702/22 Synthetic eval paper"
CS = "9618/12 Synthetic eval paper"

# ---------------- 9709 Mathematics ----------------
case("m-square-full", "9709", P1, "1", 3,
     "Express 4x^2 - 24x + 11 in the form a(x - b)^2 + c.",
     "4(x^2 - 6x) + 11 = 4(x - 3)^2 - 36 + 11 = 4(x - 3)^2 - 25",
     "a = 4 stated or used | B1\nb = 3 from halving the linear coefficient after taking out 4 | M1\nc = -25 | A1",
     est=(3, 3))
case("m-square-slip", "9709", P1, "1", 3,
     "Express 4x^2 - 24x + 11 in the form a(x - b)^2 + c.",
     "4(x - 3)^2 - 9 + 11 = 4(x - 3)^2 + 2",
     "a = 4 stated or used | B1\nb = 3 from halving the linear coefficient after taking out 4 | M1\nc = -25 | A1",
     est=(2, 2), traps=["forgot to multiply the 9 by 4; method and a are right, c is wrong"])
case("m-diff-tangent", "9709", P1, "4", 4,
     "Find the equation of the tangent to y = x^3 - 2x + 5 at the point where x = 2.",
     "dy/dx = 3x^2 - 2 = 10 at x = 2, y = 9, y - 9 = 10(x - 2), y = 10x - 11",
     "Differentiate correctly | B1\nSubstitute x = 2 into the derivative to get a gradient | M1\nFind y = 9 and use a line through (2, 9) with their gradient | M1\ny = 10x - 11 | A1",
     est=(4, 4))
case("m-diff-tangent-normal", "9709", P1, "4", 4,
     "Find the equation of the tangent to y = x^3 - 2x + 5 at the point where x = 2.",
     "dy/dx = 3x^2 - 2 = 10, normal gradient -1/10, y - 9 = -1/10 (x - 2)",
     "Differentiate correctly | B1\nSubstitute x = 2 into the derivative to get a gradient | M1\nFind y = 9 and use a line through (2, 9) with their gradient | M1\ny = 10x - 11 | A1",
     est=(2, 3), traps=["found the normal instead of the tangent; an examiner may or may not credit the line method"])
case("m-integral-area", "9709", P1, "6", 4,
     "Find the area enclosed between y = 9 - x^2 and the x-axis.",
     "integral of 9 - x^2 from -3 to 3 = [9x - x^3/3] = (27 - 9) - (-27 + 9) = 36",
     "Correct limits x = -3 and x = 3 | B1\nIntegrate to 9x - x^3/3 | M1\nSubstitute limits and subtract | M1\nArea = 36 | A1",
     est=(4, 4))
case("m-integral-no-limits", "9709", P1, "6", 4,
     "Find the area enclosed between y = 9 - x^2 and the x-axis.",
     "9x - x^3/3",
     "Correct limits x = -3 and x = 3 | B1\nIntegrate to 9x - x^3/3 | M1\nSubstitute limits and subtract | M1\nArea = 36 | A1",
     est=(1, 1))
case("m-gp-blank", "9709", P1, "7", 4,
     "A geometric progression has first term 50 and sum to infinity 200. Find the common ratio and the third term.",
     "",
     "Use S = a/(1 - r) with a = 50 | M1\nr = 3/4 | A1\nUse ar^2 with their r | M1\nThird term = 28.125 | A1",
     est=(0, 0), control="blank")
case("m-trig-solve", "9709", P1, "5", 5,
     "Solve 2cos^2 x + 3sin x = 3 for 0 <= x <= 180 degrees.",
     "2(1 - sin^2 x) + 3 sin x - 3 = 0, 2sin^2 x - 3sin x + 1 = 0, sin x = 1/2 or 1, x = 30, 90, 150",
     "Use cos^2 = 1 - sin^2 | M1\nForm a three-term quadratic in sin x | A1\nSolve to sin x = 1/2 or 1 | M1\nx = 30 and 150 | A1\nx = 90 and no others in range | A1",
     est=(5, 5))
case("m-trig-missing-root", "9709", P1, "5", 5,
     "Solve 2cos^2 x + 3sin x = 3 for 0 <= x <= 180 degrees.",
     "2sin^2 x - 3 sin x + 1 = 0, sin x = 1/2, x = 30",
     "Use cos^2 = 1 - sin^2 | M1\nForm a three-term quadratic in sin x | A1\nSolve to sin x = 1/2 or 1 | M1\nx = 30 and 150 | A1\nx = 90 and no others in range | A1",
     est=(2, 3), traps=["missed sin x = 1 and the second angle"])
case("m-mismatch", "9709", P1, "3", 3,
     "Find the coefficient of x^2 in the expansion of (3 - 2x)^5.",
     "5C2 x 3^3 x (-2)^2 = 10 x 27 x 4 = 1080",
     "Use S = a/(1 - r) with a = 50 | M1\nr = 3/4 | A1\nUse ar^2 with their r | M1\nThird term = 28.125 | A1",
     can_check=False, control="mismatch")
case("m-binomial-sign", "9709", P1, "3", 3,
     "Find the coefficient of x^2 in the expansion of (3 - 2x)^5.",
     "10 x 27 x (-2) = -540",
     "Correct binomial coefficient 10 | B1\nCombine 3^3 with (-2x)^2 | M1\nCoefficient = 1080 | A1",
     est=(1, 1), traps=["did not square the -2"])

# ---------------- 9231 Further Mathematics ----------------
case("f-induction", "9231", P2, "2", 5,
     "Prove by induction that 1 + 3 + 5 + ... + (2n - 1) = n^2 for every positive integer n.",
     "n = 1: 1 = 1^2 true. Assume true for n = k: sum = k^2. Then sum to k+1 = k^2 + 2k + 1 = (k+1)^2. So true for k+1. Since true for n=1 and true for k implies true for k+1, true for all positive integers.",
     "Base case shown | B1\nState the inductive hypothesis for n = k | B1\nAdd the (k+1)th term to the hypothesis | M1\nReach (k+1)^2 | A1\nCorrect conclusion | A1",
     est=(5, 5))
case("f-induction-no-conclusion", "9231", P2, "2", 5,
     "Prove by induction that 1 + 3 + 5 + ... + (2n - 1) = n^2 for every positive integer n.",
     "k^2 + 2k + 1 = (k+1)^2",
     "Base case shown | B1\nState the inductive hypothesis for n = k | B1\nAdd the (k+1)th term to the hypothesis | M1\nReach (k+1)^2 | A1\nCorrect conclusion | A1",
     est=(1, 2), traps=["no base case, no hypothesis, no conclusion"])
case("f-roots", "9231", P2, "1", 4,
     "The roots of x^3 - 4x^2 + 2x - 7 = 0 are a, b, c. Find a^2 + b^2 + c^2.",
     "sum = 4, sum of pairs = 2, a^2+b^2+c^2 = 16 - 4 = 12",
     "a + b + c = 4 | B1\nab + bc + ca = 2 | B1\nUse (sum)^2 - 2(sum of pairs) | M1\n12 | A1",
     est=(4, 4))
case("f-roots-sign", "9231", P2, "1", 4,
     "The roots of x^3 - 4x^2 + 2x - 7 = 0 are a, b, c. Find a^2 + b^2 + c^2.",
     "sum = -4, pairs = 2, 16 - 4 = 12",
     "a + b + c = 4 | B1\nab + bc + ca = 2 | B1\nUse (sum)^2 - 2(sum of pairs) | M1\n12 | A1",
     est=(3, 4), traps=["wrong sign on the sum but the square hides it; correct final value"])
case("f-matrix-inverse", "9231", P2, "3", 3,
     "Find the inverse of the matrix M = [[2, 1], [5, 3]].",
     "det = 6 - 5 = 1, M^-1 = [[3, -1], [-5, 2]]",
     "Determinant = 1 | B1\nSwap and negate | M1\nCorrect inverse | A1",
     est=(3, 3))
case("f-unreadable", "9231", P2, "3", 3,
     "Find the inverse of the matrix M = [[2, 1], [5, 3]].",
     "[illegible] ... ?? ]] [[ ...",
     "Determinant = 1 | B1\nSwap and negate | M1\nCorrect inverse | A1",
     can_check=False, control="unreadable")

# ---------------- 9702 Physics ----------------
case("p-kinematics", "9702", PH, "2(b)", 3,
     "A ball is dropped from rest and falls 20 m. Ignoring air resistance, calculate its speed just before it hits the ground. Take g = 9.81 m s^-2.",
     "v^2 = u^2 + 2as = 0 + 2(9.81)(20) = 392.4, v = 19.8 m/s",
     "Use v^2 = u^2 + 2as or energy | C1\nSubstitution with u = 0 | C1\nv = 19.8 m s^-1 | A1",
     est=(3, 3))
case("p-kinematics-no-root", "9702", PH, "2(b)", 3,
     "A ball is dropped from rest and falls 20 m. Ignoring air resistance, calculate its speed just before it hits the ground. Take g = 9.81 m s^-2.",
     "v^2 = 2 x 9.81 x 20 = 392 m/s",
     "Use v^2 = u^2 + 2as or energy | C1\nSubstitution with u = 0 | C1\nv = 19.8 m s^-1 | A1",
     est=(2, 2), traps=["did not take the square root"])
case("p-resistance", "9702", PH, "5(a)", 2,
     "Two resistors of 6.0 ohm and 3.0 ohm are connected in parallel. Calculate the combined resistance.",
     "1/R = 1/6 + 1/3 = 1/2, R = 2.0 ohm",
     "Use 1/R = 1/R1 + 1/R2 | C1\nR = 2.0 ohm | A1",
     est=(2, 2))
case("p-resistance-series", "9702", PH, "5(a)", 2,
     "Two resistors of 6.0 ohm and 3.0 ohm are connected in parallel. Calculate the combined resistance.",
     "R = 6 + 3 = 9 ohm",
     "Use 1/R = 1/R1 + 1/R2 | C1\nR = 2.0 ohm | A1",
     est=(0, 0))
case("p-explain-words", "9702", PH, "3(a)", 2,
     "State what is meant by the moment of a force.",
     "force times the perpendicular distance from the pivot to the line of action of the force",
     "Force multiplied by distance | B1\nDistance is perpendicular from the pivot to the line of action | B1",
     est=(2, 2))
case("p-explain-partial", "9702", PH, "3(a)", 2,
     "State what is meant by the moment of a force.",
     "force times distance",
     "Force multiplied by distance | B1\nDistance is perpendicular from the pivot to the line of action | B1",
     est=(1, 1))
case("p-blank", "9702", PH, "6", 3,
     "Calculate the energy of a photon of wavelength 500 nm.",
     "   ",
     "Use E = hc / wavelength | C1\nConvert 500 nm to metres | C1\nE = 3.98 x 10^-19 J | A1",
     est=(0, 0), control="blank")
case("p-verbatim-trap", "9702", PH, "4", 2,
     "Explain why the current in a filament lamp is not proportional to the potential difference across it.",
     "as the current increases the filament gets hotter so its resistance increases",
     "Temperature of the filament rises as the current increases, so the lattice ions vibrate more strongly | B1\nResistance increases with temperature, so the graph of current against potential difference is not a straight line | B1",
     est=(1, 2), control="verbatim", traps=["long scheme lines tempt copying; feedback must use its own words"])

# ---------------- 9618 Computer Science ----------------
case("c-binary", "9618", CS, "1(a)", 2,
     "Convert the denary number 77 into an 8-bit binary number.",
     "01001101",
     "Correct bits for 64, 8, 4, 1 | B1\nWritten as 8 bits with leading zero | B1",
     est=(2, 2))
case("c-binary-7bit", "9618", CS, "1(a)", 2,
     "Convert the denary number 77 into an 8-bit binary number.",
     "1001101",
     "Correct bits for 64, 8, 4, 1 | B1\nWritten as 8 bits with leading zero | B1",
     est=(1, 1))
case("c-pseudocode", "9618", CS, "5", 4,
     "Write pseudocode to output the total of the integers from 1 to N, where N is input by the user.",
     "INPUT N\nTotal <- 0\nFOR i <- 1 TO N\n  Total <- Total + i\nNEXT i\nOUTPUT Total",
     "Input N | B1\nInitialise a total to 0 | B1\nLoop from 1 to N adding the counter | M1\nOutput the total after the loop | A1",
     est=(4, 4))
case("c-pseudocode-no-init", "9618", CS, "5", 4,
     "Write pseudocode to output the total of the integers from 1 to N, where N is input by the user.",
     "INPUT N\nFOR i <- 1 TO N\n  Total <- Total + i\n  OUTPUT Total\nNEXT i",
     "Input N | B1\nInitialise a total to 0 | B1\nLoop from 1 to N adding the counter | M1\nOutput the total after the loop | A1",
     est=(2, 2), traps=["no initialisation and output inside the loop"])
case("c-mismatch", "9618", CS, "2", 2,
     "State two differences between RAM and ROM.",
     "RAM is volatile, ROM is not. RAM can be written to, ROM is read only.",
     "Input N | B1\nInitialise a total to 0 | B1\nLoop from 1 to N adding the counter | M1\nOutput the total after the loop | A1",
     can_check=False, control="mismatch")

json.dump({
    "golden_set_version": "scheme-check-synthetic-v1",
    "stage": "scheme_check",
    "labels": "Drafted by Claude; await owner confirmation",
    "note": "Questions, answers and scheme sections are all invented for this eval; no board text.",
    "cases": cases,
}, open(__file__.replace("build_scheme_check_v1.py", "scheme-check-v1.json"), "w"), indent=1, ensure_ascii=False)
print(len(cases), "cases")
