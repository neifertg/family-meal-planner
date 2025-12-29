# AI Assistant Prompt: Receipt Scanning Accuracy Solutions

## Problem Statement

I'm using Claude Sonnet 4 Vision to extract grocery receipt line items with visual position indicators. Despite a two-pass verification system and extensive prompting (150+ lines), I'm facing two critical issues:

### Problem 1: Position Alignment Inaccuracy (±10-30% error)
**Current Approach**: Vision model measures vertical position of each item as percentage (0-100%) within the receipt's item section, excluding header/footer. UI displays position indicator when user hovers over extracted items.

**Issue**: Position indicators appear 10-30% off from actual item location, especially toward bottom of receipt. Alignment error compounds with receipt length.

**Current Prompt** (excerpt):
```
For position_percent: Measure the vertical position where the ITEM LINE BEGINS on
the receipt image. Start measuring from the very FIRST LINE OF ITEMS (skip store
header/logo), not from the top of the image. The first actual grocery item should
be around 0-5%, items in the middle around 40-60%, last item around 90-95%.
Be extremely precise - users will see a visual indicator at this exact position.
```

**Current Mapping**: `mappedPercent = 15 + (rawPercent * 0.7)` assumes 15% header, 70% items, 15% footer.

### Problem 2: Missing Line Items (85-92% capture rate, need >98%)
**Current Approach**: Two-pass system
- Pass 1: Extract all items with 150+ line prompt
- Pass 2: Verification prompt asks Claude to count total visible items and report any missed items

**Issue**: Long receipts (20+ items) still miss 1-3 items even after verification. Short receipts (5-10 items) are 98% accurate, but long receipts drop to 85%.

**Current Verification Prompt** (excerpt):
```
You previously extracted {N} items from this receipt.

VERIFICATION TASK:
1. Count the TOTAL number of visible line items on this receipt
2. Compare that count to the {N} items you extracted
3. If you missed any items, identify them with all fields
```

## Technical Constraints

**Must Keep**:
- Claude Sonnet 4 Vision (cost-effective at ~$0.08-0.15 per receipt)
- Two-pass architecture (works well)
- Learning system (user corrections improve future prompts)
- <15 second processing time
- <$0.20 per receipt cost

**Data Structure**:
```typescript
{
  name: string                 // "Yellow Banana"
  price: number               // 2.07
  position_percent: number    // 0-100 (vertical position in item section)
  line_number: number         // Sequential: 1, 2, 3...
  source_text: string         // Exact receipt text: "BANAN 4011 2.5LB"
  category: string            // produce/dairy/meat/pantry/frozen/non_food
  // ... other fields
}
```

## Questions for You

### On Position Alignment:
1. **Is vision-based position estimation fundamentally flawed?** Should I use OCR with bounding boxes instead for pixel-perfect positioning?

2. **Multi-pass options**: Would this work better?
   - Pass 1: OCR for structure/positions → Pass 2: Vision for extraction → Pass 3: Verify?
   - Or: Pass 1: Extract with positions → Pass 2: Re-measure positions only?

3. **Better coordinate systems**: Should I ask for:
   - Pixel coordinates instead of percentages?
   - Bounding boxes (top-left, bottom-right)?
   - Line numbers + estimated spacing?

4. **Prompt optimization**: Is the position instruction too vague? Should I:
   - Use chain-of-thought ("First, identify the item section boundaries. Then measure...")?
   - Provide visual examples in the prompt?
   - Ask Claude to identify header/footer boundaries explicitly first?

### On Missing Items:
1. **Root cause**: Is the issue in initial extraction (not seeing items) or verification (not catching missed items)? How can I diagnose this?

2. **Better verification**: Should verification pass:
   - See both the image AND the initial extraction (currently only sees image)?
   - Use different prompting (e.g., "Be especially careful with bottom half of receipt")?
   - Count items BEFORE extraction to set expectation?

3. **Prompt structure**: Is 150+ lines too long and diluting focus? Should I:
   - Split into multiple shorter, focused passes?
   - Use XML tags or structured formatting to organize instructions?
   - Prioritize position instructions vs item extraction vs verification?

4. **Alternative architectures**:
   - Hybrid: Traditional OCR (Tesseract) for structure + Vision for interpretation?
   - Different model: GPT-4 Vision, Gemini Pro Vision?
   - Image preprocessing: Deskew, contrast enhancement, noise reduction?

## Your Task

Propose **3-5 specific, actionable solutions** addressing position accuracy and/or missing items. For each:

1. **Solution description** - What changes (architecture, prompt, processing)?
2. **Implementation steps** - Concrete, ordered steps
3. **Expected improvement** - Quantify: "Position accuracy from ±15% to ±3%" or "Capture rate 85%→96%"
4. **Cost/complexity** - API cost change, dev time estimate (hours), maintenance burden
5. **Code/prompt examples** - Show exact prompt wording or architectural pattern
6. **Risks** - What could go wrong? What won't this solve?

**Prioritize**: Solutions with highest accuracy gain per unit of complexity/cost.

## Success Criteria

- ✅ Position indicators within ±3% (currently ±10-30%)
- ✅ >98% item capture on 30+ item receipts (currently 85%)
- ✅ <$0.20 per receipt (currently $0.08-0.15)
- ✅ <15 seconds processing (currently 8-12s)

## Context

**Testing observations**:
- Major chains (Walmart, Target): 90-95% accuracy
- Local/ethnic markets: 80-85% (more abbreviations)
- Warehouse stores (Costco): 85-90% (bulk items)
- Wrinkled receipts: 75-85%
- Flat, clear receipts: 95-98%

**Current architecture**:
- Next.js 13+ frontend, PostgreSQL (Supabase) backend
- Client-side image → base64 → API route → Claude Vision
- Two Claude API calls per receipt (extraction + verification)
- Learning system: stores user corrections, includes last 10 in future prompts

---

## Example Solution Format (What I'm Looking For)

**Solution 1: Three-Pass with Explicit Boundary Detection**

**Description**: Add a preliminary pass to detect receipt structure boundaries, then use those in extraction prompt.

**Steps**:
1. Pass 1 (new): "Identify the pixel coordinates where items section starts and ends. Ignore header and footer."
2. Pass 2: Use boundaries from Pass 1 to measure positions: "Items section spans pixels {Y1} to {Y2}. Calculate position as (item_Y - Y1) / (Y2 - Y1) * 100"
3. Pass 3: Existing verification

**Expected Improvement**: Position ±15% → ±5%, item capture 88% → 93%

**Cost/Complexity**: +1 API call (+$0.03-0.05), +6-8 hours dev time, low maintenance

**Code**:
```typescript
// Pass 1 prompt
const boundaryPrompt = `Return only JSON: {
  "items_section_start_y": <pixel>,
  "items_section_end_y": <pixel>
}`;

// Pass 2 prompt
const extractionPrompt = `Items section spans Y pixels ${start} to ${end}.
For each item position_percent, calculate: (item_y - ${start}) / (${end} - ${start}) * 100`;
```

**Risks**: Adds latency (+2-3s), boundary detection might fail on damaged receipts

---

**That's the level of detail and specificity I need for each solution. Please provide 3-5 solutions like this.**
