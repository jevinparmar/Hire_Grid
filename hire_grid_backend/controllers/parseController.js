const { GoogleGenAI } = require("@google/genai");

exports.parseMcq = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the backend." });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert at parsing raw exam text into structured questions and generating educational content.
Extract the multiple choice questions from the following text.

IMPORTANT: Any mathematical formulas, variables, and expressions inside the text or options MUST be enclosed in standard LaTeX math delimiters. 
Use inline math with single dollar signs (e.g., $x^2$ or $\\sqrt{x}$).
CRITICAL RULE: Every question MUST have exactly 4 options. If the text provides fewer than 4 options, append realistic distractors or options like "None of the above" to make exactly 4 options.

==================================================
PREMIUM SVG DIAGRAM STANDARDS
=============================
If a question requires a diagram, or describes a diagram-based problem, you MUST generate an educational-grade SVG diagram for it and include it in 'svg_code'.

CRITICAL INSTRUCTIONS FOR PREMIUM SVG GENERATION (MANDATORY):
1. USE SINGLE QUOTES FOR SVG ATTRIBUTES: To keep the JSON valid without complex escaping, ALWAYS use single quotes inside the SVG string (e.g. fill='#EFF6FF' not fill="...").
2. CANVAS & STRUCTURE: Always use viewBox='0 0 800 600'. 
   - Top area (y=0 to 300) is for the problem figure.
   - Bottom area (y=300 to 600) is for the 4 options.
3. SVG QUALITY & STYLING:
   - Apply highly polished aesthetics: stroke='#334155', stroke-width='3', fill='none' (or clean solid fills like '#EFF6FF').
   - Use semantic <g> tags for logical parts.
   - Use standard typography: <text font-family='sans-serif' font-size='20' fill='#475569'>
4. AVOID SLOP: All rotations, shapes, sequence patterns, or circuits MUST be mathematically precise. Use explicit coordinates. No placeholders!
5. 4 OPTION LAYOUT: Do not generate 4 separate SVGs. Generate ONE single SVG with the 4 options placed elegantly at the bottom. Use this EXACT SVG grouping structure for choices:
<g transform='translate(50, 400)'>
   <text x='0' y='-20' font-family='sans-serif' font-weight='bold' font-size='24' fill='#1E293B'>A</text>
   <rect x='0' y='0' width='140' height='140' fill='#F8FAFC' stroke='#E2E8F0' stroke-width='2' rx='12'/>
   <!-- Draw Choice A visual here inside the rect -->
</g>
(Do the same for B at transform='translate(230, 400)', C at transform='translate(410, 400)', D at transform='translate(590, 400)').
6. ANTI-SPOILER: The 4 option rectangles MUST visually look identical. DO NOT highlight the correct one. The ONLY record of the correct answer is "correctAnswerIndex" in JSON.
7. DIAGRAM VALIDATION: Every diagram must have exactly ONE logical and unambiguous correct answer.

In the JSON "options" array, simply use generic labels like ["Option A", "Option B", "Option C", "Option D"] since the pictures are inside the main SVG. NEVER generate "option_svg_ids", "svg_diagrams" array, or separate SVGs. Everything MUST be in the single 'svg_code' string.

DIAGRAM VALIDATION RULES (MANDATORY):
1. Every diagram question must have exactly one logically correct answer.
2. The correct answer must be derivable from a clear and objective rule.
3. Reject any pattern that allows multiple interpretations.
4. Before generating the final question, verify that only one option satisfies the pattern.
5. Do not generate random shape sequences without a mathematical, rotational, positional, numerical, directional, or logical relationship.
6. The reasoning used to derive the answer must be reproducible by a human test taker.
7. Each distractor (wrong option) must be plausible but demonstrably incorrect.
8. Avoid patterns that require guessing.
9. Mirror-image questions must use non-symmetrical figures so that only one mirror image is valid.
10. Rotation questions must specify the angle of rotation through the pattern itself.
11. Series-completion questions must contain enough steps to uniquely identify the next figure.
12. Folding and paper-cutting questions must obey real geometric constraints.
13. Circuit-diagram questions must follow actual electrical laws and component behavior.
14. Number-pattern diagrams must have a single mathematical relationship.
15. Shape-progression diagrams must use a consistent transformation rule.
16. Every SVG question must be internally validated before output generation.
17. If the pattern is ambiguous, regenerate the question instead of returning it.
18. The answer must be solvable without external assumptions.
19. No diagram should depend on color perception alone to determine the answer.
20. Premium placement-test standard: a candidate should be able to explain exactly why the correct answer is correct and why every other option is incorrect.

General SVG Quality Rules:
1. Use modern colors (e.g., Primary Blue: #2563EB, Green: #10B981, Amber: #F59E0B, Red: #EF4444, Gray: #64748B).
2. Use a card-style layout (Rounded border, Light background, Proper spacing).
3. Show all necessary labels and explicitly show dimensions whenever applicable.
4. Every SVG must be self-explanatory.
5. For reasoning diagrams: Include shape labels, sequence indicators, rotations, highlighted changes, pattern clues.
6. For technical diagrams: Use actual engineering symbols (Real AND gate, CMOS inverter, Op-Amp, RLC circuit, etc.).
7. Generate complete SVG code. Do NOT generate placeholder SVGs or generic simplified rectangles.
==================================================

Here is the raw input text:
${text}
`;

    let response;
    let retries = 3;
    let delay = 1000;
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correctAnswerIndex: { type: "NUMBER" },
                  svg_code: { type: "STRING", description: "If the question requires or refers to a diagram, provide the complete, high-quality raw SVG code here." }
                },
                required: ["question", "options", "correctAnswerIndex"]
              }
            }
          }
        });
        break; // Success
      } catch (error) {
        const is503 = error?.status === 503 || 
                      error?.status === "UNAVAILABLE" || 
                      (error?.message && error.message.includes("503"));
        
        if (is503 && retries > 1) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }
    
    let responseText = response.text || "[]";
    let parsed = [];
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse JSON", e);
      return res.status(400).json({ error: "Failed to process the text into questions." });
    }

    res.json({ questions: parsed });
  } catch (error) {
    console.error("Error formatting questions via Gemini API:", error);
    res.status(400).json({ error: "Temporary issue connecting to the AI model. Please try again." });
  }
};
