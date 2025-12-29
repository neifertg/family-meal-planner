# Receipt Scanning Accuracy & Alignment Problem Definition

## Context
I'm building a family meal planning app with a grocery receipt scanning feature that uses Claude Sonnet 4 with vision capabilities to extract line items from receipt photos. The feature includes a two-pass verification system and visual alignment indicators to help users review and correct extracted data.

## Current Implementation

### Technology Stack
- **Vision Model**: Claude Sonnet 4 (claude-sonnet-4-20250514) with vision
- **Processing Flow**: Two-pass extraction system
  - **Pass 1**: Initial extraction with detailed prompt (150+ lines of instructions)
  - **Pass 2**: Verification pass to catch missed items
- **Learning System**: Stores user corrections in database and includes recent corrections in future prompts (up to 10 examples)
- **Visual Alignment**: Items display a position indicator on hover using `position_percent` (0-100) to show where the item appears on the receipt image

### Data Structure
Each extracted item contains:
```typescript
{
  name: string                    // Normalized item name (e.g., "Yellow Banana")
  quantity: string                // Quantity with units (e.g., "2.5 lb", "3 cans")
  price: number                   // Total price for this line item
  unit_price?: number             // Price per unit if calculable
  category: string                // One of: produce, dairy, meat, pantry, frozen, non_food
  is_food: boolean                // True for groceries, false for bags/non-food items
  source_text: string             // EXACT text from receipt (e.g., "BANAN 4011 2.5LB")
  line_number: number             // Sequential line number (1, 2, 3...)
  position_percent: number        // Vertical position 0-100 (measured within item list section)
  consolidated_count?: number     // If duplicates merged, how many
  consolidated_details?: string   // Explanation of consolidation
}
```

### Current Prompt Strategy (Excerpts)

**Position Measurement Instructions (Current - Line 52)**:
```
For position_percent: ABSOLUTELY CRITICAL FOR VISUAL ALIGNMENT - Measure the vertical
position where the ITEM LINE BEGINS on the receipt image. Start measuring from the very
FIRST LINE OF ITEMS (skip store header/logo), not from the top of the image. The first
actual grocery item should be around 0-5%, items in the middle of the list around 40-60%,
and the last item before the total should be around 90-95%. DO NOT include the store
header, logo, or receipt footer in your measurements - only measure within the item list
section. Be extremely precise - users will hover over items and see a visual indicator
at this exact position.
```

**Duplicate Consolidation (Lines 74-82)**:
```
DUPLICATE CONSOLIDATION:
- If the SAME item appears multiple times on the receipt, consolidate into ONE entry
- Combine quantities: If "Chicken Breast" appears twice (2 lb and 1.5 lb),
  create one entry with quantity "3.5 lb"
- Sum prices: Add all prices for duplicate items
- When consolidating, include consolidated_count and consolidated_details fields
```

**Verification Pass (Lines 156-184)**:
```
You previously extracted {N} items from this receipt.

VERIFICATION TASK:
1. Count the TOTAL number of visible line items on this receipt
2. Compare that count to the {N} items you extracted
3. If you missed any items, identify them with all required fields
4. Return missed_items array with any items that were missed

Items you already extracted: {list of names}
```

### UI Implementation
- Receipt image displayed on left side of split-pane review interface
- Extracted items listed on right side with editable fields
- When user hovers over an item in the list, a blue indicator line appears on the receipt image at `position_percent` location
- Position mapping: Claude measures within item section (0-100%), UI maps to full image assuming 15% header + 70% items + 15% footer

## Problems Encountered

### 1. **Position Alignment Accuracy (CRITICAL)**
**Severity**: High - Impacts user trust and review efficiency

**Symptoms**:
- Position indicators often appear 10-30% off from actual item location on receipt
- Alignment gets progressively worse toward bottom of receipt (compounding error)
- Receipts with long headers/footers have worse alignment than compact receipts
- Position mapping algorithm assumes fixed 15/70/15 split which doesn't match reality

**Impact**:
- Users can't quickly verify which extracted item corresponds to which receipt line
- Defeats the purpose of the visual alignment feature
- Increases review time and cognitive load

**Example**:
- Item #15 (near bottom) might show indicator at 75% but actual position is at 85%
- First item might show at 18% but header was actually only 10% of image

### 2. **Missing Line Items (MODERATE-HIGH)**
**Severity**: High - Incomplete data defeats core purpose

**Symptoms**:
- Despite two-pass verification, some receipts still miss 1-3 items
- More common on receipts with:
  - 25+ items (long receipts)
  - Poor image quality (blur, wrinkles, shadows)
  - Unusual formatting (split items across lines, condensed spacing)
  - Handwritten notes or stamps overlapping items
- Verification pass catches some (25-40% improvement) but not all

**Impact**:
- Users must manually re-review entire receipt to find missing items
- Breaks trust in automated extraction
- Budget tracking becomes inaccurate

**Current Metrics** (estimated from testing):
- Short receipts (5-10 items): ~98% capture rate
- Medium receipts (11-20 items): ~92% capture rate
- Long receipts (21+ items): ~85% capture rate

### 3. **Inconsistent Position Measurement**
**Severity**: Moderate - Makes alignment unreliable

**Symptoms**:
- Same receipt scanned twice yields different position_percent values (±5-10%)
- Claude sometimes measures from top of image (wrong) vs top of item section (correct)
- Irregular spacing between items causes position values to cluster or spread incorrectly
- Items on wrinkled/curved receipts have especially poor position accuracy

**Impact**:
- Alignment can't be relied upon even when theoretically correct
- UI mapping algorithm can't compensate for inconsistent measurements

### 4. **Over-Consolidation of Similar Items**
**Severity**: Low-Moderate - Occasional data loss

**Symptoms**:
- Different variants sometimes merged: "Organic Milk" + "2% Milk" → "Organic Milk"
- Different sizes merged: "12oz Coffee" + "16oz Coffee" → "28oz Coffee" (incorrect)
- Happens ~5-10% of receipts with multiple similar items

**Impact**:
- Users must manually split items back apart
- Quantity tracking becomes incorrect

## Constraints & Requirements

### Must Maintain
1. **Two-pass architecture** - Works well for catch missed items
2. **Learning system** - User corrections should improve future extractions
3. **Claude Sonnet 4** - Current model is fast and cost-effective (~$0.05-0.15 per receipt)
4. **Position indicators** - Users love this feature when it works
5. **Non-food item detection** - Important for budget accuracy

### Performance Targets
- **Latency**: < 15 seconds per receipt (currently 8-12s average)
- **Cost**: < $0.20 per receipt (currently $0.08-0.15)
- **Accuracy Goals**:
  - Item capture: >98% for all receipt sizes
  - Position alignment: Within ±3% of actual position (currently ±10-30%)
  - Name normalization: >95% correct (currently ~90%)
  - Consolidation: <2% errors (currently ~8%)

### Cannot Change
- Frontend framework (Next.js 13+ with React Server Components)
- Database (PostgreSQL via Supabase)
- Image processing (client-side, base64 encoding)
- Max image size constraints (5MB after compression)

## Request for Solutions

I need robust, production-ready solutions to the problems above, particularly:

### Primary Focus Areas
1. **Position Alignment**: How can I achieve ±3% accuracy for visual indicators?
   - Should I use different coordinate systems?
   - Can OCR bounding boxes help?
   - Should I use multiple models/passes?
   - Better prompt engineering for position measurement?

2. **Missing Items**: How can I achieve >98% capture rate on long receipts?
   - Better verification strategies?
   - Different prompting approaches?
   - Post-processing validation?
   - Alternative two-pass architectures?

### Solution Requirements
- **Specific & actionable**: Provide concrete implementation details, not general advice
- **Cost-aware**: Consider API costs (prefer optimizations over brute-force)
- **Prompt examples**: If suggesting prompt changes, show exact wording
- **Architecture diagrams**: If suggesting multi-step flows, show the flow
- **Tradeoff analysis**: Explain costs/benefits of each approach
- **Implementation complexity**: Rate each solution (Low/Medium/High effort)
- **Expected improvements**: Quantify expected accuracy gains

### Questions to Address
1. **Position Accuracy**:
   - Is vision-model-based position estimation fundamentally limited? Should I use OCR with bounding boxes instead?
   - Could a three-pass system work: Pass 1 (OCR for positions) → Pass 2 (Vision for extraction) → Pass 3 (Verification)?
   - Would a different coordinate system (pixel coordinates, bounding boxes) be more reliable?

2. **Missing Items**:
   - Is the issue with the initial extraction or the verification pass (or both)?
   - Would asking Claude to count items BEFORE extracting help calibrate attention?
   - Should verification pass see both the image AND the initial extraction, or just the image?

3. **Prompt Engineering**:
   - Is 150+ lines too long? Does it dilute focus on critical tasks?
   - Should position measurement be a separate pass/model call?
   - Are there prompt techniques (like XML tags, chain-of-thought) that could help?

4. **Alternative Approaches**:
   - Should I combine Claude Vision with traditional OCR (like Tesseract)?
   - Would using GPT-4 Vision or other models improve accuracy?
   - Could image preprocessing (deskew, contrast enhancement) help?

## Success Metrics

An ideal solution would achieve:
- ✅ >98% item capture rate on receipts with 30+ items
- ✅ Position indicators within ±3% of actual location
- ✅ <$0.20 per receipt processing cost
- ✅ <15 second processing time
- ✅ <5% consolidation errors
- ✅ Works with variety of receipt formats (thermal, ink, different stores)

## Additional Context

### Current Testing Observations
- Large chain stores (Walmart, Target, Kroger): 90-95% accuracy
- Local/ethnic markets: 80-85% accuracy (more abbreviations, non-English)
- Warehouse stores (Costco, Sam's Club): 85-90% accuracy (bulk items, unusual formatting)
- Receipts with wrinkles/shadows: 75-85% accuracy
- High-quality flat receipts: 95-98% accuracy

### Code References
- Extraction logic: `/lib/receiptScanner/claudeExtractor.ts`
- UI component: `/components/ReceiptScanner.tsx`
- Review interface: Split-pane with image on left, editable items on right
- Position mapping: `mappedPercent = 15 + (rawPercent * 0.7)` (assumes 15% header, 70% items, 15% footer)

---

## Your Task

Please propose 3-5 comprehensive solution approaches that address the position alignment and missing items problems. For each approach:

1. **Describe the solution** - What changes to architecture, prompting, or processing?
2. **Implementation steps** - Specific, ordered steps to implement
3. **Expected improvements** - Quantify accuracy/performance gains
4. **Cost/complexity tradeoffs** - API costs, development time, maintenance
5. **Risks & limitations** - What could go wrong? What won't it solve?
6. **Code snippets** - Show key prompt changes or architectural patterns

Prioritize solutions that maximize accuracy improvement per unit of implementation complexity and API cost.
